import numpy as np
import pandas as pd
from scipy.optimize import minimize

# ---------- Load data ----------
VERSION = 1
CSV_PATH = f"bandit_data_v{VERSION}.csv"  # change this to your filename
df = pd.read_csv(CSV_PATH)

# Keep only needed columns
required_cols = [
    "participant_id",
    "block_name",
    "trial_in_block",
    "chosen_shape",
    "outcome_rewarded"
]
missing = [c for c in required_cols if c not in df.columns]
if missing:
    raise ValueError(f"Missing required columns: {missing}")

# Standardize shape labels just in case
df["chosen_shape"] = df["chosen_shape"].astype(str).str.strip().str.lower()
df["outcome_rewarded"] = pd.to_numeric(df["outcome_rewarded"], errors="coerce")
df["trial_in_block"] = pd.to_numeric(df["trial_in_block"], errors="coerce")

# Keep only circle/square rows
df = df[df["chosen_shape"].isin(["circle", "square"])].copy()
df = df.sort_values(["participant_id", "block_name", "trial_in_block"])


# ---------- RW + softmax negative log-likelihood ----------
def neg_log_likelihood(params, choices, rewards):
    """
    params[0] = alpha in transformed space
    params[1] = beta in transformed space

    We transform them to enforce:
    alpha in (0,1)
    beta > 0
    """
    alpha = 1 / (1 + np.exp(-params[0]))   # logistic transform
    beta = np.exp(params[1])               # positive transform

    # Initialize values
    q_circle = 0.5
    q_square = 0.5

    nll = 0.0

    for choice, reward in zip(choices, rewards):
        # Softmax choice probability
        exp_c = np.exp(beta * q_circle)
        exp_s = np.exp(beta * q_square)
        p_circle = exp_c / (exp_c + exp_s)

        # Likelihood of observed choice
        if choice == "circle":
            p_choice = p_circle
            pe = reward - q_circle
            q_circle = q_circle + alpha * pe
        elif choice == "square":
            p_choice = 1 - p_circle
            pe = reward - q_square
            q_square = q_square + alpha * pe
        else:
            continue

        # Numerical safety
        p_choice = np.clip(p_choice, 1e-12, 1 - 1e-12)
        nll -= np.log(p_choice)

    return nll


# ---------- Fit one participant/block ----------
def fit_rw_softmax(subdf):
    choices = subdf["chosen_shape"].tolist()
    rewards = subdf["outcome_rewarded"].astype(float).tolist()

    # multiple starting points helps avoid local minima
    starts = [
        [0.0, 0.0],
        [-1.0, 0.0],
        [1.0, 0.0],
        [0.0, 1.0],
        [0.0, -1.0],
    ]

    best = None

    for start in starts:
        result = minimize(
            neg_log_likelihood,
            x0=np.array(start),
            args=(choices, rewards),
            method="L-BFGS-B"
        )

        if best is None or result.fun < best.fun:
            best = result

    alpha = 1 / (1 + np.exp(-best.x[0]))
    beta = np.exp(best.x[1])

    return {
        "alpha": alpha,
        "beta": beta,
        "neg_log_lik": best.fun,
        "n_trials": len(subdf)
    }


# ---------- Fit all participant x block combinations ----------
results = []

grouped = df.groupby(["participant_id", "block_name"], sort=False)

for (participant_id, block_name), subdf in grouped:
    subdf = subdf.sort_values("trial_in_block").copy()

    # skip very short blocks
    if len(subdf) < 10:
        continue

    fit = fit_rw_softmax(subdf)

    results.append({
        "participant_id": participant_id,
        "block_name": block_name,
        **fit
    })

results_df = pd.DataFrame(results)

# ---------- Summaries ----------
print("\nParticipant-level fits:\n")
print(results_df)

print("\nCondition means:\n")
condition_means = results_df.groupby("block_name")[["alpha", "beta"]].mean().reset_index()
print(condition_means)

# Save outputs
results_df.to_csv("participant_block_fits.csv", index=False)
condition_means.to_csv("condition_mean_fits.csv", index=False)

print("\nSaved:")
print("- participant_block_fits.csv")
print("- condition_mean_fits.csv")