/**
 * TWO-ARMED BANDIT TASK
 * Core Logic & State Management
 */

const APPS_SCRIPT_URL = ""; // Fill with your Google Apps Script URL

// --- Configuration ---
const TRIALS_PER_BLOCK = 80;
const PROB_HIGH = 0.7;
const PROB_LOW = 0.3;
const FIXATION_DURATION = 500;
const FEEDBACK_DURATION = 750;

// Reversal Schedules
const REVERSALS_STABLE = [17, 36, 57, 74];
const REVERSALS_VOLATILE = [9, 17, 25, 33, 42, 50, 59, 68, 75];

// --- State Variables ---
let pID = "";
let currentBlockIndex = 0;
let currentTrialInBlock = 0;
let globalTrialCounter = 0;
let blockSequence = [];
let trialData = [];
let isChoiceAllowed = false;
let stimulusOnset = 0;

let highRewardShape = "Circle"; // Default
let currentBlockType = ""; // Stable, Volatile, Attention

// --- Initialization & Counterbalancing ---
document.getElementById('btn-start').addEventListener('click', startExperiment);

function startExperiment() {
    const inputID = document.getElementById('participant-id').value.trim();
    pID = inputID || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    setupCounterbalancing(pID);
    showScreen('screen-transition');
    updateTransitionScreen();
}

function setupCounterbalancing(id) {
    // Simple hash for deterministic assignment
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // 1. Assign Block Order (6 possible orders)
    const orders = [
        ['Stable', 'Volatile', 'Attention'],
        ['Stable', 'Attention', 'Volatile'],
        ['Volatile', 'Stable', 'Attention'],
        ['Volatile', 'Attention', 'Stable'],
        ['Attention', 'Stable', 'Volatile'],
        ['Attention', 'Volatile', 'Stable']
    ];
    blockSequence = orders[hash % 6];

    // 2. Assign Initial High Reward Shape
    highRewardShape = (hash % 2 === 0) ? "Circle" : "Square";
}

// --- Task Flow Control ---
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

// --- Trial Logic ---
function runTrial() {
    isChoiceAllowed = false;
    currentTrialInBlock++;
    globalTrialCounter++;
    
    const container = document.getElementById('stimulus-container');
    const banditL = document.getElementById('bandit-left');
    const banditR = document.getElementById('bandit-right');
    const fixation = document.getElementById('fixation');
    
    // Reset View
    container.style.display = 'none';
    fixation.style.display = 'block';
    document.getElementById('feedback-text').innerText = '';

    // Determine Reversals
    const sched = (currentBlockType === 'Volatile') ? REVERSALS_VOLATILE : REVERSALS_STABLE;
    if (sched.includes(currentTrialInBlock)) {
        highRewardShape = (highRewardShape === "Circle") ? "Square" : "Circle";
    }

    // Set Visual State
    const visual = getVisualState(currentBlockType, currentTrialInBlock);
    applyVisualState(visual);

    // Timing: Fixation -> Stimulus
    setTimeout(() => {
        fixation.style.display = 'none';
        container.style.display = 'flex';
        stimulusOnset = Date.now();
        isChoiceAllowed = true;
    }, FIXATION_DURATION);
}

function getVisualState(type, trial) {
    // Default state
    let state = {
        axis: 'horizontal',
        circlePos: 'left',
        squarePos: 'right',
        circleCol: 'var(--circle-blue)',
        squareCol: 'var(--square-orange)',
        anchor: 'anchor-center',
        label: 'standard'
    };

    if (type === 'Attention') {
        if (trial >= 13 && trial < 31) {
            state.axis = 'vertical'; state.circlePos = 'top'; state.squarePos = 'bottom'; state.label = 'remap1';
        } else if (trial >= 31 && trial < 49) {
            state.axis = 'vertical'; state.circlePos = 'top'; state.squarePos = 'bottom'; 
            state.circleCol = 'var(--square-orange)'; state.squareCol = 'var(--circle-blue)';
            state.anchor = 'anchor-up'; state.label = 'remap2';
        } else if (trial >= 49 && trial < 67) {
            state.axis = 'horizontal'; state.circlePos = 'right'; state.squarePos = 'left';
            state.circleCol = 'var(--square-orange)'; state.squareCol = 'var(--circle-blue)';
            state.label = 'remap3';
        } else if (trial >= 67) {
            state.axis = 'horizontal'; state.circlePos = 'right'; state.squarePos = 'left';
            state.anchor = 'anchor-down'; state.label = 'remap4';
        }
    }
    return state;
}

function applyVisualState(s) {
    const container = document.getElementById('stimulus-container');
    const banditL = document.getElementById('bandit-left');
    const banditR = document.getElementById('bandit-right');

    container.className = `${s.axis} ${s.anchor}`;
    
    // Assign shapes and colors based on positions
    if (s.circlePos === 'left' || s.circlePos === 'top') {
        setupBandit(banditL, "Circle", s.circleCol);
        setupBandit(banditR, "Square", s.squareCol);
    } else {
        setupBandit(banditL, "Square", s.squareCol);
        setupBandit(banditR, "Circle", s.circleCol);
    }
    
    // Store current state for data logging
    window.currentVisualState = s;
}

function setupBandit(el, shape, color) {
    el.className = `bandit shape-${shape.toLowerCase()}`;
    el.style.backgroundColor = color;
    el.dataset.shape = shape;
}

// --- Interaction & Feedback ---
document.querySelectorAll('.bandit').forEach(el => {
    el.addEventListener('click', (e) => {
        if (!isChoiceAllowed) return;
        handleChoice(e.currentTarget.dataset.shape, e.currentTarget.dataset.pos);
    });
});

function handleChoice(chosenShape, chosenPos) {
    isChoiceAllowed = false;
    const rt = Date.now() - stimulusOnset;
    
    // Determine Outcome
    const isHighProb = (chosenShape === highRewardShape);
    const pSuccess = isHighProb ? PROB_HIGH : PROB_LOW;
    const rewarded = Math.random() < pSuccess ? 1 : 0;

    // Display Feedback
    const fbText = document.getElementById('feedback-text');
    fbText.innerText = rewarded ? "+1" : "No Reward";
    fbText.className = rewarded ? "reward" : "no-reward";

    // Log Data
    logTrialData(chosenShape, chosenPos, rewarded, rt, pSuccess);

    // Next Step
    setTimeout(() => {
        if (currentTrialInBlock < TRIALS_PER_BLOCK) {
            runTrial();
        } else {
            endBlock();
        }
    }, FEEDBACK_DURATION);
}

function logTrialData(chosenShape, chosenPos, rewarded, rt, pChosen) {
    const s = window.currentVisualState;
    const sched = (currentBlockType === 'Volatile') ? REVERSALS_VOLATILE : REVERSALS_STABLE;
    
    const row = {
        participant_id: pID,
        assigned_block_order: blockSequence.join('-'),
        block_index: currentBlockIndex + 1,
        block_name: currentBlockType,
        trial_in_block: currentTrialInBlock,
        global_trial: globalTrialCounter,
        timestamp_iso: new Date().toISOString(),
        chosen_shape: chosenShape,
        chosen_position: chosenPos,
        circle_position: s.circlePos,
        square_position: s.squarePos,
        axis: s.axis,
        anchor_state: s.anchor,
        circle_color: s.circleCol,
        square_color: s.squareCol,
        high_reward_shape: highRewardShape,
        reward_probability_chosen: pChosen,
        outcome_rewarded: rewarded,
        reaction_time_ms: rt,
        reward_reversal_on_this_trial: sched.includes(currentTrialInBlock) ? 1 : 0,
        visual_remap_on_this_trial: (currentBlockType === 'Attention' && [13, 31, 49, 67].includes(currentTrialInBlock)) ? 1 : 0,
        visual_state_label: s.label
    };
    trialData.push(row);
}

// --- End of Block / End of Task ---
async function endBlock() {
    // Upload Data
    if (APPS_SCRIPT_URL) {
        const blockData = trialData.filter(d => d.block_index === (currentBlockIndex + 1));
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(blockData)
        }).catch(err => console.log("Upload failed", err));
    }

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
    const summaryDiv = document.getElementById('summary-stats');
    
    const totalRewards = trialData.reduce((sum, r) => sum + r.outcome_rewarded, 0);
    
    let html = `<h3>Performance Summary</h3>`;
    html += `<p><strong>ID:</strong> ${pID}</p>`;
    html += `<p><strong>Total Rewards:</strong> ${totalRewards}</p><ul>`;
    
    blockSequence.forEach((name, idx) => {
        const bData = trialData.filter(d => d.block_index === (idx + 1));
        const rewards = bData.reduce((sum, r) => sum + r.outcome_rewarded, 0);
        const avgRT = (bData.reduce((sum, r) => sum + r.reaction_time_ms, 0) / bData.length).toFixed(0);
        const optimal = (bData.filter(r => r.chosen_shape === r.high_reward_shape).length / bData.length * 100).toFixed(1);
        
        html += `<li><strong>${name}:</strong> ${rewards} rewards, Avg RT: ${avgRT}ms, Optimal: ${optimal}%</li>`;
    });
    html += `</ul>`;
    summaryDiv.innerHTML = html;

    document.getElementById('btn-download').onclick = downloadCSV;
}

function downloadCSV() {
    const headers = Object.keys(trialData[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of trialData) {
        const values = headers.map(header => {
            const val = row[header];
            return `"${val}"`;
        });
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `task_data_${pID}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Debug toggle
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') {
        const panel = document.getElementById('debug-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
});

setInterval(() => {
    document.getElementById('debug-info').innerText = 
        `Trial: ${currentTrialInBlock} | Global: ${globalTrialCounter} | High: ${highRewardShape}`;
}, 100);
