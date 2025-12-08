# backend/app/services/fleet_registry.py

from __future__ import annotations

import sqlite3
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from ..config import DATA_DIR


DB_PATH = DATA_DIR / "fleet_registry.sqlite3"

APP_DIR = Path(__file__).resolve().parent.parent  # backend/app
CONSENT_DIR = APP_DIR / "data" / "consent_forms"

DELETION_DIR = APP_DIR / "data" / "deletion_forms"


def _get_conn() -> sqlite3.Connection:
  DB_PATH.parent.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  return conn


def _init_db() -> None:
  """Create tables if they don't exist yet."""
  with _get_conn() as conn:
    cur = conn.cursor()

    cur.execute(
      """
      CREATE TABLE IF NOT EXISTS vehicles (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          operator_id     TEXT NOT NULL,
          vehicle_uid     TEXT NOT NULL UNIQUE,
          display_name    TEXT,
          reg_number      TEXT,
          owner_name      TEXT,
          monitoring_mode TEXT,
          consent_file    TEXT,
          created_at      TEXT NOT NULL
      );
      """
    )

    cur.execute(
      """
      CREATE TABLE IF NOT EXISTS telemetry_monthly (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_uid TEXT NOT NULL,
          month_ts    TEXT NOT NULL,
          Month       INTEGER,
          Ca          REAL,
          I_ave       REAL,
          I_sum       REAL,
          I_std       REAL,
          Vpack_ave   REAL,
          Vpack_sum   REAL,
          Vpack_std   REAL,
          SOC_ave     REAL,
          SOC_sum     REAL,
          SOC_std     REAL,
          Vmax_ave    REAL,
          Vmax_sum    REAL,
          Vmax_std    REAL,
          Vmin_ave    REAL,
          Vmin_sum    REAL,
          Vmin_std    REAL,
          Tmax_ave    REAL,
          Tmax_sum    REAL,
          Tmax_std    REAL,
          Tmin_ave    REAL,
          Tmin_sum    REAL,
          Tmin_std    REAL,
          Vd_ave      REAL,
          Vd_sum      REAL,
          Vd_std      REAL,
          Td_ave      REAL,
          Td_sum      REAL,
          Td_std      REAL
      );
      """
    )

    conn.commit()


_init_db()


def get_consent_dir() -> Path:
  """Used by main.py to know where to drop consent PDFs."""
  CONSENT_DIR.mkdir(parents=True, exist_ok=True)
  return CONSENT_DIR


def get_deletion_dir() -> Path:
  """
  Used by main.py to know where to drop deregistration PDFs.
  This is kept separate from consent_forms.
  """
  DELETION_DIR.mkdir(parents=True, exist_ok=True)
  return DELETION_DIR


def _row_to_vehicle_dict(row: sqlite3.Row) -> Dict:
  """
  Shape matches the objects returned by /vehicles so VehicleCard
  can render these without any special handling.
  """
  return {
    "vehicle_id": row["vehicle_uid"],
    "display_name": row["display_name"],
    "reg_number": row["reg_number"],
    "owner_name": row["owner_name"],
    "monitoring_mode": row["monitoring_mode"],
    "consent_file": row["consent_file"],
    # placeholders until we ingest real telemetry for this vehicle
    "n_samples": 0,
    "cap_min": None,
    "cap_max": None,
    "t_min": None,
    "t_max": None,
    "source": "registered",
  }


def register_vehicle(
  *,
  operator_id: str,
  display_name: str,
  reg_number: Optional[str] = None,
  owner_name: Optional[str] = None,
  monitoring_mode: Optional[str] = None,
  consent_filename: Optional[str] = None,
) -> Dict:
  """
  Create a new vehicle row and return a dict shaped like the
  existing /vehicles endpoint (so the frontend can keep its shape).
  """
  vehicle_uid = _generate_vehicle_uid(operator_id)
  created_at = datetime.utcnow().isoformat() + "Z"

  with _get_conn() as conn:
    cur = conn.cursor()
    cur.execute(
      """
      INSERT INTO vehicles (
          operator_id, vehicle_uid, display_name, reg_number,
          owner_name, monitoring_mode, consent_file, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      """,
      (
        operator_id,
        vehicle_uid,
        display_name,
        reg_number,
        owner_name,
        monitoring_mode,
        consent_filename,
        created_at,
      ),
    )
    conn.commit()

    cur.execute(
      "SELECT * FROM vehicles WHERE vehicle_uid = ?;",
      (vehicle_uid,),
    )
    row = cur.fetchone()

  return _row_to_vehicle_dict(row)


def list_vehicles_for_operator(operator_id: str) -> List[Dict]:
  """Return all vehicles registered by a given operator_id."""
  with _get_conn() as conn:
    cur = conn.cursor()
    cur.execute(
      "SELECT * FROM vehicles WHERE operator_id = ? ORDER BY created_at ASC;",
      (operator_id,),
    )
    rows = cur.fetchall()

  return [_row_to_vehicle_dict(r) for r in rows]


def delete_vehicle(operator_id: str, vehicle_uid: str) -> Dict:
  """
  Delete a vehicle (and its monthly telemetry) for a given operator.

  Raises ValueError if the vehicle is not found for this operator.
  """
  with _get_conn() as conn:
    cur = conn.cursor()

    cur.execute(
      "SELECT * FROM vehicles WHERE operator_id = ? AND vehicle_uid = ?;",
      (operator_id, vehicle_uid),
    )
    row = cur.fetchone()
    if row is None:
      raise ValueError(
        f"Vehicle '{vehicle_uid}' not found for operator '{operator_id}'"
      )

    cur.execute(
      "DELETE FROM telemetry_monthly WHERE vehicle_uid = ?;",
      (vehicle_uid,),
    )

    cur.execute(
      "DELETE FROM vehicles WHERE operator_id = ? AND vehicle_uid = ?;",
      (operator_id, vehicle_uid),
    )

    conn.commit()

  return {
    "operator_id": operator_id,
    "vehicle_id": vehicle_uid,
    "removed": True,
    "display_name": row["display_name"],
  }


def _generate_vehicle_uid(operator_id: str) -> str:
  """
  Generate a short, nice-looking vehicle ID, tied to the operator prefix.
  Example: HX-3F9A for operator_id 'HX381'.
  """
  prefix = operator_id[:2].upper()
  suffix = secrets.token_hex(2).upper()
  return f"{prefix}-{suffix}"
