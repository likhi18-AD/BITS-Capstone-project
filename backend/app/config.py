# backend/app/config.py
from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[2]

ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATA_DIR      = BASE_DIR / "data"

# Main feature table 
FEAT_DF_CSV   = ARTIFACTS_DIR / "feat_df_all_vehicles.csv"


FEATURES_CFG_JSON = ARTIFACTS_DIR / "features_f1.json"
SEQ2SEQ_MODEL     = ARTIFACTS_DIR / "seq2seq1_f1.keras"
GPR_RESIDUAL_PKL  = ARTIFACTS_DIR / "gpr_residual.pkl"
CA_SCALER_PKL     = ARTIFACTS_DIR / "ca_scaler.pkl"
F_SCALER_PKL      = ARTIFACTS_DIR / "f_scaler.pkl"
X2_SCALER_PKL     = ARTIFACTS_DIR / "x2_scaler.pkl"

# SMTP / email config
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER

# Password reset token config
SECRET_KEY = os.getenv("SECRET_KEY", "dev_change_me_secret_key")
RESET_TOKEN_EXP_MIN = int(os.getenv("RESET_TOKEN_EXP_MIN", "30"))

# Frontend base URL (for building password reset links)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
