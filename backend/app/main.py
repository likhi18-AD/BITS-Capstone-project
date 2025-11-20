# backend/app/main.py

from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import FEAT_DF_CSV
from .services import telemetry
from .services import auth  # <-- NEW: auth service
from . import ml_forecast


app = FastAPI(
    title="EV Fleet Battery Analytics API",
    description="Backend for 20-vehicle SoH analytics & forecasting",
    version="0.2.0",
)

# CORS: allow localhost frontends during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------- BASIC HEALTH & META -------------------


@app.get("/health")
def health_check():
    return {"status": "ok", "detail": "API is running"}


@app.get("/meta/artifacts")
def artifacts_meta():
    """Quick check that the backend sees your feature CSV / artifacts."""
    return {
        "feat_df_csv": str(FEAT_DF_CSV),
        "exists": FEAT_DF_CSV.exists(),
    }


@app.get("/debug/telemetry_mapping")
def telemetry_mapping():
    """
    Show how the backend interprets the feature dataframe schema.
    """
    df = telemetry.load_feat_df()
    mapping = {
        "id": telemetry.ID_COL,
        "time": telemetry.TIME_COL,
        "capacity": telemetry.CAPACITY_COL,
    }
    return {
        "mapping": mapping,
        "columns": list(df.columns),
        "n_rows": len(df),
    }


# ------------------- VEHICLE LIST & TIMESERIES -------------------


@app.get("/vehicles")
def list_vehicles():
    """
    List all vehicles present in feat_df_all_vehicles.csv with basic stats.
    Drives the Fleet Overview page.
    """
    vehicles = telemetry.list_vehicles_with_stats()
    return {"vehicles": vehicles}


@app.get("/vehicles/{vehicle_id}/timeseries")
def vehicle_timeseries(vehicle_id: str):
    """
    Full timeseries for a single vehicle.

    Returns a JSON-friendly subset of columns that we will plot
    (time, capacity, pack voltage, SOC, temperatures).
    """
    ts = telemetry.get_vehicle_timeseries(vehicle_id)

    if ts.empty:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    df = ts.copy()

    # Ensure time column is JSON-serialisable
    if telemetry.TIME_COL in df.columns:
        df[telemetry.TIME_COL] = df[telemetry.TIME_COL].astype(str)

    cols = [telemetry.ID_COL]

    for c in [
        telemetry.TIME_COL,
        telemetry.CAPACITY_COL,
        "SOC_ave",
        "Vpack_ave",
        "Tmax_ave",
        "Tmin_ave",
    ]:
        if c in df.columns and c not in cols:
            cols.append(c)

    records = df[cols].to_dict(orient="records")

    return {
        "vehicle_id": vehicle_id,
        "n_records": len(records),
        "columns": cols,
        "records": records,
    }


# ------------------- AUTH: REGISTER & LOGIN -------------------


class RegisterRequest(BaseModel):
    email: str
    password: str
    employee_id: str


class RegisterResponse(BaseModel):
    operator_id: str
    message: str


class LoginRequest(BaseModel):
    operator_id: str
    password: str


class LoginResponse(BaseModel):
    operator_id: str
    email: str
    employee_id: str
    message: str


@app.post("/auth/register", response_model=RegisterResponse)
def register_operator(req: RegisterRequest):
    """
    Register a new fleet operator.

    - Validates employee_id against artifacts/employee_ids.txt if present.
    - Ensures no duplicate employee_id or email.
    - Generates a unique operator_id like 'AB123'.
    - Logs a welcome email text with the operator_id to the backend console.
    """
    try:
        op = auth.register_operator(
            email=req.email,
            password=req.password,
            employee_id=req.employee_id,
        )
    except auth.EmployeeNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except auth.OperatorAlreadyExists as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")

    return RegisterResponse(
        operator_id=op.operator_id,
        message=(
            "Registration successful. "
            "Your unique operator ID has been emailed and is shown here for testing."
        ),
    )


@app.post("/auth/login", response_model=LoginResponse)
def login_operator(req: LoginRequest):
    """
    Login with operator_id + password.
    Returns basic operator profile on success.
    """
    try:
        op = auth.login_operator(
            operator_id=req.operator_id,
            password=req.password,
        )
    except ValueError as e:
        # invalid credentials
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")

    return LoginResponse(
        operator_id=op.operator_id,
        email=op.email,
        employee_id=op.employee_id,
        message="Login successful.",
    )


# ------------------- ML ROLLING FORECAST -------------------


class ForecastRequest(BaseModel):
    vehicle_id: int
    model: Literal["seq2seq_gpr", "gpr", "svr"]
    n_known: int | None = None
    horizon: int


@app.post("/ml/forecast")
def ml_forecast_endpoint(req: ForecastRequest):
    """
    Run ML rolling forecast for a given vehicle and model.
    Uses the same artifacts and feature engineering as your notebook.
    """
    try:
        result = ml_forecast.run_forecast(
            vehicle=req.vehicle_id,
            model=req.model,
            n_known=req.n_known,
            max_h=req.horizon,
        )
    except ValueError as e:
        # e.g. vehicle not found, not enough months, etc.
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        # missing CSV or artifacts
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # catch-all for unexpected errors (surfaced to client as 500)
        raise HTTPException(status_code=500, detail=f"Forecast failed: {e}")

    return result
