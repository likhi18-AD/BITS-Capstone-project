# backend/app/services/auth.py

"""
Simple operator registration & login service.

- Stores operators in a JSON file in artifacts/ (operators.json).
- Optionally validates employee IDs against artifacts/employee_ids.txt
  (one ID per line). If that file does not exist, ANY non-empty employee_id
  is accepted (so the API still works for now).

Passwords are hashed with SHA-256 for basic safety (NOT production-grade).
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import random
import string
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from ..config import FEAT_DF_CSV

ART_DIR: Path = FEAT_DF_CSV.parent
OPERATORS_DB_PATH: Path = ART_DIR / "operators.json"
EMPLOYEE_IDS_PATH: Path = ART_DIR / "employee_ids.txt"

class EmployeeNotFound(Exception):
    pass


class OperatorAlreadyExists(Exception):
    pass


class OperatorNotFound(Exception):
    """Raised when an operator cannot be located in the JSON DB."""
    pass


@dataclass
class Operator:
  operator_id: str
  email: str
  employee_id: str
  password_hash: str

def _load_operators() -> List[Dict]:
    if not OPERATORS_DB_PATH.exists():
        return []
    with OPERATORS_DB_PATH.open("r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        return []
    return data


def _save_operators(ops: List[Dict]) -> None:
    os.makedirs(OPERATORS_DB_PATH.parent, exist_ok=True)
    with OPERATORS_DB_PATH.open("w", encoding="utf-8") as f:
        json.dump(ops, f, indent=2)


def _hash_password(password: str) -> str:
    
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _generate_operator_id(existing: List[str]) -> str:
    """
    Generate a unique ID of the form LLDDD (2 letters + 3 digits),
    e.g. 'WG123' or 'AB045'.
    """
    while True:
        letters = "".join(random.choice(string.ascii_uppercase) for _ in range(2))
        digits = "".join(random.choice(string.digits) for _ in range(3))
        op_id = f"{letters}{digits}"
        if op_id not in existing:
            return op_id


def _load_valid_employee_ids() -> Optional[set]:
    """
    Read allowed employee IDs from artifacts/employee_ids.txt
    (one ID per line). If the file does not exist, return None,
    in which case ANY non-empty ID is accepted.
    """
    if not EMPLOYEE_IDS_PATH.exists():
        return None
    ids = set()
    with EMPLOYEE_IDS_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                ids.add(line)
    return ids


def register_operator(email: str, password: str, employee_id: str) -> Operator:
    """
    Register a new operator if employee_id is valid and not already registered.

    Returns an Operator object (including the generated operator_id).
    Raises:
      - EmployeeNotFound
      - OperatorAlreadyExists
    """
    email = email.strip().lower()
    employee_id = employee_id.strip()

    if not email or not password or not employee_id:
        raise ValueError("Email, password and employee_id are required.")

    valid_ids = _load_valid_employee_ids()
    if valid_ids is not None and employee_id not in valid_ids:
        raise EmployeeNotFound(
            f"Employee ID '{employee_id}' is not in company records."
        )

    ops = _load_operators()

    for o in ops:
        if o.get("employee_id") == employee_id:
            raise OperatorAlreadyExists(
                f"An operator is already registered for employee ID '{employee_id}'."
            )
        if o.get("email") == email:
            raise OperatorAlreadyExists(
                f"An operator with email '{email}' is already registered."
            )

    existing_ids = [o.get("operator_id", "") for o in ops]
    operator_id = _generate_operator_id(existing_ids)
    pwd_hash = _hash_password(password)

    op = {
        "operator_id": operator_id,
        "email": email,
        "employee_id": employee_id,
        "password_hash": pwd_hash,
    }
    ops.append(op)
    _save_operators(ops)

    _log_fake_email(email, operator_id)

    return Operator(
        operator_id=operator_id,
        email=email,
        employee_id=employee_id,
        password_hash=pwd_hash,
    )


def login_operator(operator_id: str, password: str) -> Operator:
    """
    Validate login credentials. Raises ValueError on failure.
    """
    operator_id = operator_id.strip().upper()
    if not operator_id or not password:
        raise ValueError("Operator ID and password are required.")

    ops = _load_operators()
    pwd_hash = _hash_password(password)

    for o in ops:
        if o.get("operator_id") == operator_id and o.get("password_hash") == pwd_hash:
            return Operator(
                operator_id=operator_id,
                email=o.get("email", ""),
                employee_id=o.get("employee_id", ""),
                password_hash=pwd_hash,
            )

    raise ValueError("Invalid operator ID or password.")


def find_operator_by_email(email: str) -> Operator:
    """
    Look up an operator by email. Raises OperatorNotFound if not present.
    """
    email = email.strip().lower()
    if not email:
        raise ValueError("Email is required.")

    ops = _load_operators()
    for o in ops:
        if o.get("email") == email:
            return Operator(
                operator_id=o.get("operator_id", ""),
                email=o.get("email", ""),
                employee_id=o.get("employee_id", ""),
                password_hash=o.get("password_hash", ""),
            )

    raise OperatorNotFound(f"No operator registered with email '{email}'.")


def reset_operator_password(operator_id: str, new_password: str) -> Operator:
    """
    Update the stored password_hash for an operator_id.
    Raises OperatorNotFound if no such operator exists.
    """
    operator_id = operator_id.strip().upper()
    if not operator_id or not new_password:
        raise ValueError("Operator ID and new password are required.")

    ops = _load_operators()
    target: Optional[Dict] = None
    for o in ops:
        if o.get("operator_id") == operator_id:
            target = o
            break

    if target is None:
        raise OperatorNotFound(f"Operator '{operator_id}' not found.")

    new_hash = _hash_password(new_password)
    target["password_hash"] = new_hash
    _save_operators(ops)

    return Operator(
        operator_id=operator_id,
        email=target.get("email", ""),
        employee_id=target.get("employee_id", ""),
        password_hash=new_hash,
    )


def _log_fake_email(email: str, operator_id: str) -> None:
    """
    For now we just log the "email" contents to the console.
    You can replace this with real SMTP integration later.
    """
    msg = f"""

    To      : {email}
    Subject : Welcome to Wind Granma Fleet Monitoring!

    Dear Operator,

    Congratulations on registering as a fleet operator for the company
    "Wind Granma". Your unique operator ID is:

        {operator_id}

    Please use this ID together with your chosen password to log into
    the EV fleet analytics dashboard.

    Wishing you efficient, safe and data-driven fleet monitoring!

    -- Wind Granma Analytics Platform
    """
    print(msg)
