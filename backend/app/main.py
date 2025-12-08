# backend/app/main.py
from typing import Literal

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from email.message import EmailMessage
import smtplib

import base64
import hashlib
import hmac
import json
import time
from pathlib import Path  

from .config import (
    FEAT_DF_CSV,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    SECRET_KEY,
    RESET_TOKEN_EXP_MIN,
    FRONTEND_BASE_URL,
)
from .services import telemetry
from .services import auth
from .services import fleet_registry  
from . import ml_forecast


app = FastAPI(
    title="EV Fleet Battery Analytics API",
    description="Backend for 20-vehicle SoH analytics & forecasting",
    version="0.3.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


def send_operator_welcome_email(to_email: str, operator_id: str) -> None:
    """
    Fire-and-forget email sender used in BackgroundTasks.
    Sends the new operator their unique ID.
    """
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM and to_email):
        print("[email] SMTP not configured; skipping welcome email")
        return

    msg = EmailMessage()
    msg["Subject"] = "Your Wind Granma Fleet Operator ID"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    msg.set_content(
        f"""Hi,

Congratulations on registering as a fleet operator for Wind Granma.

Your unique Operator ID is: {operator_id}

Use this ID together with your chosen password to log into the fleet portal.

Happy monitoring,
Wind Granma – EV Fleet Analytics
"""
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"[email] Welcome email sent to {to_email}")
    except Exception as e:
        print(f"[email] Failed to send welcome email to {to_email}: {e}")


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """
    Email the user a password reset link.
    """
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM and to_email):
        print("[email] SMTP not configured; skipping password reset email")
        return

    msg = EmailMessage()
    msg["Subject"] = "Wind Granma Fleet – Password reset"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    msg.set_content(
        f"""Hi,

We received a request to reset the password for your Wind Granma fleet operator account.

To set a new password, click the link below (valid for {RESET_TOKEN_EXP_MIN} minutes):

{reset_url}

If you did not request this, you can safely ignore this email.

Best regards,
Wind Granma – EV Fleet Analytics
"""
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"[email] Password reset email sent to {to_email}")
    except Exception as e:
        print(f"[email] Failed to send password reset email to {to_email}: {e}")


#TOKEN HELPERS


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def create_reset_token(operator_id: str, email: str) -> str:
    """
    Create a signed, time-limited token containing operator_id + email.
    """
    payload = {
        "sub": operator_id,
        "email": email,
        "exp": int(time.time()) + RESET_TOKEN_EXP_MIN * 60,
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), body, hashlib.sha256).digest()
    return f"{_b64url_encode(body)}.{_b64url_encode(sig)}"


def verify_reset_token(token: str) -> dict:
    """
    Verify token signature + expiry and return the payload dict.
    Raises HTTPException(400) on failure.
    """
    try:
        body_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reset token format")

    try:
        body = _b64url_decode(body_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reset token encoding")

    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), body, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid or tampered reset token")

    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid reset token payload")

    exp = payload.get("exp")
    if exp is None or int(exp) < int(time.time()):
        raise HTTPException(status_code=400, detail="Reset link has expired")

    return payload


#VEHICLE LIST & TIMESERIES


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


# REGISTERED VEHICLES (PER-OPERATOR)

class RegisteredVehicleOut(BaseModel):
    """
    Shape matches the objects returned by /vehicles so the frontend
    VehicleCard can render them without any special casing.
    """
    vehicle_id: str
    display_name: str
    reg_number: str | None = None
    owner_name: str | None = None
    monitoring_mode: str | None = None
    consent_file: str | None = None
    n_samples: int
    cap_min: float | None = None
    cap_max: float | None = None
    t_min: float | None = None
    t_max: float | None = None
    source: str


@app.post(
    "/operators/{operator_id}/vehicles",
    response_model=RegisteredVehicleOut,
    summary="Register a new vehicle for a given operator",
)
async def register_vehicle_for_operator(
    operator_id: str,
    vehicle_name: str = Form(...),
    reg_number: str = Form(""),
    owner_name: str = Form(""),
    monitoring_mode: str = Form("monthly"),
    consent_file: UploadFile | None = File(None),
):
    """
    Creates a persistent vehicle entry in fleet_registry.sqlite3 and
    (optionally) stores the uploaded consent PDF into DATA_DIR/consent_forms.
    """
    try:
        consent_filename: str | None = None

        if consent_file is not None:
            consent_dir = fleet_registry.get_consent_dir()
            consent_dir.mkdir(parents=True, exist_ok=True)

            original = consent_file.filename or "consent.pdf"
            ext = Path(original).suffix or ".pdf"
            safe_name = f"{operator_id}_{int(time.time())}{ext}"
            dest_path = consent_dir / safe_name

            contents = await consent_file.read()
            with dest_path.open("wb") as f:
                f.write(contents)

            consent_filename = safe_name

        vehicle = fleet_registry.register_vehicle(
            operator_id=operator_id,
            display_name=vehicle_name,
            reg_number=reg_number or None,
            owner_name=owner_name or None,
            monitoring_mode=monitoring_mode,
            consent_filename=consent_filename,
        )
        return vehicle

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register vehicle: {exc}",
        )


@app.get(
    "/operators/{operator_id}/vehicles",
    summary="List vehicles registered by this operator",
)
def list_vehicles_for_operator(operator_id: str):
    vehicles = fleet_registry.list_vehicles_for_operator(operator_id)
    return {"vehicles": vehicles}


@app.post(
    "/operators/{operator_id}/vehicles/{vehicle_id}/delete",
    summary="Delete a registered vehicle with a deregistration PDF",
)
async def delete_vehicle_for_operator(
    operator_id: str,
    vehicle_id: str,
    deletion_consent: UploadFile = File(...),
):
    """
    Delete a vehicle registration (and its telemetry) for this operator.

    - Stores the owner's deletion request PDF under backend/app/data/deletion_forms
    - Removes the vehicle from fleet_registry.sqlite3
    - Deletes telemetry_monthly rows for this vehicle
    """
    try:
        # Store deletion consent PDF in a separate directory
        deletion_dir = fleet_registry.get_deletion_dir()
        deletion_dir.mkdir(parents=True, exist_ok=True)

        original = deletion_consent.filename or "deletion.pdf"
        ext = Path(original).suffix or ".pdf"
        safe_name = f"{operator_id}_{vehicle_id}_{int(time.time())}{ext}"
        dest_path = deletion_dir / safe_name

        contents = await deletion_consent.read()
        with dest_path.open("wb") as f:
            f.write(contents)

        # Delete from registry + telemetry
        result = fleet_registry.delete_vehicle(
            operator_id=operator_id,
            vehicle_uid=vehicle_id,
        )

        # Return combined info
        return {
            "ok": True,
            "operator_id": operator_id,
            "vehicle_id": vehicle_id,
            "deletion_file": safe_name,
            "removed": result.get("removed", True),
            "display_name": result.get("display_name"),
        }

    except ValueError as e:
        # Vehicle not found for this operator
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete vehicle: {e}",
        )


# AUTH: REGISTER & LOGIN

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


class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    message: str


@app.post("/auth/register", response_model=RegisterResponse)
def register_operator(req: RegisterRequest, background_tasks: BackgroundTasks):
    """
    Register a new fleet operator.

    - Validates employee_id against artifacts/employee_ids.txt if present.
    - Ensures no duplicate employee_id or email.
    - Generates a unique operator_id like 'AB123'.
    - Sends a welcome email with the operator_id (SMTP).
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

    background_tasks.add_task(
        send_operator_welcome_email,
        to_email=op.email,
        operator_id=op.operator_id,
    )

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
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")

    return LoginResponse(
        operator_id=op.operator_id,
        email=op.email,
        employee_id=op.employee_id,
        message="Login successful.",
    )


@app.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """
    Request a password reset link to be sent to the operator's email.
    For security, the response is the same whether or not the email exists.
    """
    try:
        op = auth.find_operator_by_email(req.email)
    except auth.OperatorNotFound:
        return ForgotPasswordResponse(
            message="If an account exists for this email, a reset link has been sent."
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {e}")

    token = create_reset_token(op.operator_id, op.email)
    reset_url = f"{FRONTEND_BASE_URL}/reset-password?token={token}"

    background_tasks.add_task(
        send_password_reset_email,
        to_email=op.email,
        reset_url=reset_url,
    )

    return ForgotPasswordResponse(
        message="If an account exists for this email, a reset link has been sent."
    )


@app.post("/auth/reset-password", response_model=ResetPasswordResponse)
def reset_password(req: ResetPasswordRequest):
    """
    Verify reset token, update password in JSON and allow login with new password.
    """
    try:
        payload = verify_reset_token(req.token)
        operator_id = payload.get("sub")
        if not operator_id:
            raise HTTPException(status_code=400, detail="Invalid reset token payload")

        auth.reset_operator_password(operator_id=operator_id, new_password=req.new_password)
    except HTTPException:
        raise
    except auth.OperatorNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {e}")

    return ResetPasswordResponse(
        message="Password has been reset. You can now sign in with your new password."
    )


# ML ROLLING FORECAST


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
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {e}")

    return result
