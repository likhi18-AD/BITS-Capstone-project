# backend/app/services/telemetry.py

from functools import lru_cache
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from ..config import FEAT_DF_CSV

# ---- COLUMN MAPPING FOR YOUR feat_df_all_vehicles.csv ----
# From your screenshot the columns are:
# ['vehicle', 'month_ts', 'Month', 'Ca', 'I_ave', 'I_sum', 'I_std',
#  'Vpack_ave', 'Vpack_sum', 'Vpack_std', 'SOC_ave', 'SOC_sum', 'SOC_std',
#  'Vmax_ave', 'Vmax_sum', 'Vmax_std', 'Vmin_ave', 'Vmin_sum', 'Vmin_std',
#  'Tmax_ave', 'Tmax_sum', 'Tmax_std', 'Tmin_ave', 'Tmin_sum', 'Tmin_std',
#  'Vd_ave', 'Vd_sum', 'Vd_std', 'Td_ave', 'Td_sum', 'Td_std']

# We treat:
#   vehicle   -> vehicle id
#   month_ts  -> time (monthly timestamp)
#   Ca        -> capacity / SoH proxy
ID_COL = "vehicle"
TIME_COL = "month_ts"
CAPACITY_COL = "Ca"


@lru_cache
def load_feat_df() -> pd.DataFrame:
    """
    Load the master feature dataframe for all 20 vehicles.

    Parsed once and cached in memory for fast API calls.
    """
    df = pd.read_csv(FEAT_DF_CSV)

    # Ensure time column is parsed as datetime if present
    if TIME_COL in df.columns:
        df[TIME_COL] = pd.to_datetime(df[TIME_COL], errors="coerce")

    return df


def list_vehicles_with_stats() -> List[Dict[str, Any]]:
    """
    Return one row per vehicle with high-level stats:

    - vehicle_id
    - n_samples (months)
    - cap_min / cap_max (min/max capacity or SoH)
    - t_min / t_max (first and last month timestamp, as ISO strings)
    """
    df = load_feat_df()

    if ID_COL not in df.columns:
        raise RuntimeError(
            f"Expected '{ID_COL}' column in feat_df_all_vehicles.csv, "
            f"but got: {list(df.columns)}"
        )

    groups = df.groupby(ID_COL)
    vehicles: List[Dict[str, Any]] = []

    for vid, g in groups:
        # normalise vehicle_id type for API (int if numeric, else str)
        if np.issubdtype(g[ID_COL].dtype, np.number):
            vid_api: Any = int(vid)
        else:
            vid_api = str(vid)

        stats: Dict[str, Any] = {
            "vehicle_id": vid_api,
            "n_samples": int(len(g)),
        }

        # Capacity / SoH range
        if CAPACITY_COL in g.columns:
            stats["cap_min"] = float(g[CAPACITY_COL].min())
            stats["cap_max"] = float(g[CAPACITY_COL].max())

        # Time range
        if TIME_COL in g.columns:
            t_min = g[TIME_COL].min()
            t_max = g[TIME_COL].max()

            def _to_str(x):
                return x.isoformat() if hasattr(x, "isoformat") else str(x)

            stats["t_min"] = _to_str(t_min)
            stats["t_max"] = _to_str(t_max)

        vehicles.append(stats)

    # Stable ordering by vehicle_id
    vehicles.sort(key=lambda x: str(x["vehicle_id"]))
    return vehicles


def get_vehicle_timeseries(vehicle_id: Any) -> pd.DataFrame:
    """
    Filter the feature dataframe for a single vehicle.

    vehicle_id can be str or int. Returns a dataframe sorted by TIME_COL.
    """
    df = load_feat_df()

    if ID_COL not in df.columns:
        raise RuntimeError(
            f"Expected '{ID_COL}' column in feat_df_all_vehicles.csv, "
            f"but got: {list(df.columns)}"
        )

    # First attempt: direct equality
    mask = df[ID_COL] == vehicle_id

    # If empty, try casting to int (handles "1" vs 1)
    if not mask.any():
        try:
            v_int = int(vehicle_id)
            mask = df[ID_COL] == v_int
        except (ValueError, TypeError):
            pass

    ts = df.loc[mask].copy()

    if TIME_COL in ts.columns:
        ts = ts.sort_values(TIME_COL)

    return ts
