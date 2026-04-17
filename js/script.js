/**
 * TWO-ARMED BANDIT TASK - FRONTEND
 */

// 1. PASTE YOUR GOOGLE WEB APP URL HERE
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5LRdFJP2sLEpTNSQfjtxBsBjuMc6KRCu6YcMoIhLav0BTTKsGtUvpInV2ktwckW6f/exec"; 

const TRIALS_PER_BLOCK = 80; // Set to 5 or 8 for testing, 80 for real study
const PROB_HIGH = 0.7;
const PROB_LOW = 0.3;
const FIXATION_DURATION = 500;
const FEEDBACK_DURATION = 750;

const REVERSALS_STABLE = [17, 36, 57, 74];
const REVERSALS_VOLATILE = [9, 17, 25, 33, 42, 50, 59, 68, 75];

let pID = "";
let currentBlockIndex = 0;
let currentTrialInBlock = 0;
let globalTrialCounter = 0;
let blockSequence = [];
let trialData = [];
let isChoiceAllowed = false;
let stimulusOnset = 0;
let highRewardShape = "Circle";
let currentBlockType = "";

// --- Initialization ---
document.getElementById('btn-start').addEventListener('click', () => {
    const inputID = document.getElementById('participant-id').value.trim();
    pID = inputID || Math.random().toString(36).substring(2, 8).toUpperCase();
    setupCounterbalancing(pID);
    showScreen('screen-transition');
    updateTransitionScreen();
});

function setupCounterbalancing(id) {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const orders = [
        ['Stable', 'Volatile', 'Attention'], ['Stable', 'Attention', 'Volatile'],
        ['Volatile', 'Stable', 'Attention'], ['Volatile', 'Attention', 'Stable'],
        ['Attention', 'Stable', 'Volatile'], ['Attention', 'Volatile', 'Stable']
    ];
    blockSequence = orders[hash % 6];
    highRewardShape = (hash % 2 === 0) ? "Circle" : "Square";
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateTransitionScreen() {
    currentBlockType = blockSequence[currentBlockIndex];
    document.getElementById('block-title').innerText = `Block ${currentBlockIndex + 1} of 3`;
    document.getElementById('btn-next-block').onclick = () => {
        showScreen('screen-task');
        runTrial();
    };
}

// --- Trial Engine ---
function runTrial() {
    isChoiceAllowed = false;
    currentTrialInBlock++;
    globalTrialCounter++;
    
    document.getElementById('stimulus-container').style.display = 'none';
    document.getElementById('fixation').style.display = 'block';
    document.getElementById('feedback-text').innerText = '';

    const sched = (currentBlockType === 'Volatile') ? REVERSALS_VOLATILE : REVERSALS_STABLE;
    if (sched.includes(currentTrialInBlock)) {
        highRewardShape = (highRewardShape === "Circle") ? "Square" : "Circle";
    }

    applyVisualState(getVisualState(currentBlockType, currentTrialInBlock));

    setTimeout(() => {
        document.getElementById('fixation').style.display = 'none';
        document.getElementById('stimulus-container').style.display = 'flex';
        stimulusOnset = Date.now();
        isChoiceAllowed = true;
    }, FIXATION_DURATION);
}

function getVisualState(type, trial) {
    let s = { axis: 'horizontal', circlePos: 'left', squarePos: 'right', circleCol: 'var(--circle-blue)', squareCol: 'var(--square-orange)', anchor: 'anchor-center', label: 'standard' };
    if (type === 'Attention') {
        if (trial >= 13 && trial < 31) { s.axis = 'vertical'; s.circlePos = 'top'; s.squarePos = 'bottom'; s.label = 'remap1'; }
        else if (trial >= 31 && trial < 49) { s.axis = 'vertical'; s.circlePos = 'top'; s.squarePos = 'bottom'; s.circleCol = 'var(--square-orange)'; s.squareCol = 'var(--circle-blue)'; s.anchor = 'anchor-up'; s.label = 'remap2'; }
        else if (trial >= 49 && trial < 67) { s.axis = 'horizontal'; s.circlePos = 'right'; s.squarePos = 'left'; s.circleCol = 'var(--square-orange)'; s.squareCol = 'var(--circle-blue)'; s.label = 'remap3'; }
        else if (trial >= 67) { s.axis = 'horizontal'; s.circlePos = 'right'; s.squarePos = 'left'; s.anchor = 'anchor-down'; s.label = 'remap4'; }
    }
    return s;
}

function applyVisualState(s) {
    const container = document.getElementById('stimulus-container');
    container.className = `${s.axis} ${s.anchor}`;
    const bL = document.getElementById('bandit-left');
    const bR = document.getElementById('bandit-right');
    if (s.circlePos === 'left' || s.circlePos === 'top') {
        setupBandit(bL, "Circle", s.circleCol); setupBandit(bR, "Square", s.squareCol);
    } else {
        setupBandit(bL, "Square", s.squareCol); setupBandit(bR, "Circle", s.circleCol);
    }
    window.currentVisualState = s;
}

function setupBandit(el, shape, color) {
    el.className = `bandit shape-${shape.toLowerCase()}`;
    el.style.backgroundColor = color;
    el.dataset.shape = shape;
}

document.querySelectorAll('.bandit').forEach(el => {
    el.addEventListener('click', (e) => {
        if (!isChoiceAllowed) return;
        isChoiceAllowed = false;
        const rt = Date.now() - stimulusOnset;
        const chosenShape = e.currentTarget.dataset.shape;
        const pSuccess = (chosenShape === highRewardShape) ? PROB_HIGH : PROB_LOW;
        const rewarded = Math.random() < pSuccess ? 1 : 0;

        const fb = document.getElementById('feedback-text');
        fb.innerText = rewarded ? "+1" : "No Reward";
        fb.className = rewarded ? "reward" : "no-reward";

        logTrialData(chosenShape, rewarded, rt, pSuccess);

        setTimeout(() => {
            if (currentTrialInBlock < TRIALS_PER_BLOCK) runTrial();
            else endBlock();
        }, FEEDBACK_DURATION);
    });
});

function logTrialData(chosenShape, rewarded, rt, pChosen) {
    const s = window.currentVisualState;
    const sched = (currentBlockType === 'Volatile') ? REVERSALS_VOLATILE : REVERSALS_STABLE;
    trialData.push({
        participant_id: pID, block_index: currentBlockIndex + 1, block_name: currentBlockType,
        trial_in_block: currentTrialInBlock, global_trial: globalTrialCounter, timestamp_iso: new Date().toISOString(),
        chosen_shape: chosenShape, circle_position: s.circlePos, square_position: s.squarePos,
        axis: s.axis, anchor_state: s.anchor, circle_color: s.circleCol, square_color: s.squareCol,
        high_reward_shape: highRewardShape, reward_probability_chosen: pChosen, outcome_rewarded: rewarded,
        reaction_time_ms: rt, reward_reversal_on_this_trial: sched.includes(currentTrialInBlock) ? 1 : 0,
        visual_remap_on_this_trial: (currentBlockType === 'Attention' && [13, 31, 49, 67].includes(currentTrialInBlock)) ? 1 : 0,
        visual_state_label: s.label
    });
}

// --- The Transition Logic ---
async function endBlock() {
    const blockIdx = currentBlockIndex + 1;
    const blockTrials = trialData.filter(d => d.block_index === blockIdx);

    // 1. Calculate Summary
    const summary = {
        block_total_rewards: blockTrials.reduce((s, r) => s + r.outcome_rewarded, 0),
        block_mean_rt: Math.round(blockTrials.reduce((s, r) => s + r.reaction_time_ms, 0) / blockTrials.length),
        block_optimal_rate: (blockTrials.filter(r => r.chosen_shape === (r.reward_probability_chosen === PROB_HIGH ? r.chosen_shape : '')).length / blockTrials.length).toFixed(2)
    };

    // 2. Background Upload
    if (APPS_SCRIPT_URL) {
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                participant_id: pID, assigned_block_order: blockSequence.join('-'),
                block_index: blockIdx, block_name: currentBlockType,
                upload_batch_number: blockIdx, block_summary: summary, trials: blockTrials
            })
        });
    }

    // 3. UI Transition
    if (currentBlockIndex < 2) {
        currentBlockIndex++;
        currentTrialInBlock = 0;
        showScreen('screen-transition');
        updateTransitionScreen();
    } else {
        showResults();
    }
}

function showResults() {
    showScreen('screen-results');
    const totalRewards = trialData.reduce((sum, r) => sum + r.outcome_rewarded, 0);
    document.getElementById('summary-stats').innerHTML = `<h3>Done!</h3><p>ID: ${pID}</p><p>Total Rewards: ${totalRewards}</p>`;
    document.getElementById('btn-download').onclick = downloadCSV;
}

function downloadCSV() {
    const headers = Object.keys(trialData[0]);
    const csvRows = [headers.join(','), ...trialData.map(row => headers.map(h => `"${row[h]}"`).join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `data_${pID}.csv`;
    a.click();
}
