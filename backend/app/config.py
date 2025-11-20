# backend/app/config.py
from pathlib import Path

# Base dir is .../gpr_model
BASE_DIR = Path(__file__).resolve().parents[2]

ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATA_DIR      = BASE_DIR / "data"

# Main feature table (from your notebook export)
FEAT_DF_CSV   = ARTIFACTS_DIR / "feat_df_all_vehicles.csv"

# Later we’ll also use:
FEATURES_CFG_JSON = ARTIFACTS_DIR / "features_f1.json"
SEQ2SEQ_MODEL     = ARTIFACTS_DIR / "seq2seq1_f1.keras"
GPR_RESIDUAL_PKL  = ARTIFACTS_DIR / "gpr_residual.pkl"
CA_SCALER_PKL     = ARTIFACTS_DIR / "ca_scaler.pkl"
F_SCALER_PKL      = ARTIFACTS_DIR / "f_scaler.pkl"
X2_SCALER_PKL     = ARTIFACTS_DIR / "x2_scaler.pkl"
