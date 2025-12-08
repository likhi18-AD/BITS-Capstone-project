# backend/app/ml_forecast.py

"""
ML rolling forecast utilities, adapted from your notebook.

Implements:
- Seq2Seq + residual GPR (paper model)
- Baseline GPR
- Baseline SVR

Used by the /ml/forecast FastAPI endpoint.
"""

from __future__ import annotations

import json
import os
import io
import base64
from functools import lru_cache
from typing import Dict, Literal, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.gaussian_process import GaussianProcessRegressor as _GPR
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR as _SVR

from .config import FEAT_DF_CSV

CSV_PATH = FEAT_DF_CSV
ART_DIR = FEAT_DF_CSV.parent  

@lru_cache(maxsize=1)
def load_feat_df() -> pd.DataFrame:
  """Load and clean the master feature dataframe."""
  if not CSV_PATH.exists():
      raise FileNotFoundError(f"Could not find feature CSV at {CSV_PATH}")

  df = pd.read_csv(CSV_PATH, parse_dates=["month_ts"])

  
  non_num = {"vehicle", "Month", "month_ts"}
  num_cols = [c for c in df.columns if c not in non_num]
  df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

  df = df.sort_values(["vehicle", "month_ts"]).drop_duplicates(
      ["vehicle", "month_ts"]
  )

  return df


@lru_cache(maxsize=1)
def _load_cfg_and_artifacts():
  """
  Load features_f1.json and ML artifacts (seq2seq, residual GPR, scalers).
  """
  cfg_path = ART_DIR / "features_f1.json"
  if not cfg_path.exists():
      raise FileNotFoundError(f"features_f1.json not found in {ART_DIR}")

  with cfg_path.open("r") as f:
      cfg = json.load(f)

  use_features = cfg["USE_FEATURES"]
  n_known_default = int(cfg.get("N_KNOWN", 6))

  paths = {
      "seq2seq": ART_DIR / "seq2seq1_f1.keras",
      "gpr_res": ART_DIR / "gpr_residual.pkl",
      "ca_sc": ART_DIR / "ca_scaler.pkl",
      "f_sc": ART_DIR / "f_scaler.pkl",
      "x2_sc": ART_DIR / "x2_scaler.pkl",
  }

  #schema check
  df = load_feat_df()
  needed_cols = {"Tmax_ave", "Tmin_ave"}
  missing = [c for c in needed_cols if c not in df.columns]
  if missing:
      raise RuntimeError(
          f"feat_df is missing columns needed by residual GPR: {missing}"
      )

  return use_features, n_known_default, paths


def _rmse(a, b) -> float:
  a = np.asarray(a, float)
  b = np.asarray(b, float)
  return float(np.sqrt(np.mean((a - b) ** 2)))


def _build_vehicle_slice(
  df: pd.DataFrame, vid: int, use_features
) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
  """
  Extract one vehicle's time series and return:
      d  : vehicle dataframe (sorted)
      c  : capacity / Ca vector
      X  : feature matrix
      mon: Month column (for residual GPR)
  """
  d = (
      df.loc[df["vehicle"] == vid]
      .sort_values("month_ts")
      .dropna(subset=["Ca"])
      .copy()
  )

  if d.empty:
      raise ValueError(f"No rows found for vehicle {vid} in feat_df.")

  miss = [c for c in use_features if c not in d.columns]
  if miss:
      raise RuntimeError(f"Missing features in feat_df for this run: {miss}")

  c = d["Ca"].values.astype(float)
  X = d[use_features].values.astype(float)
  mon = d["Month"].astype(int).values

  return d, c, X, mon


# Seq2Seq-I + residual GPR-I 


def _forecast_seq2seq_gpr(
  df: pd.DataFrame,
  vehicle: int,
  n_known: int,
  max_h: int,
  use_features,
  paths,
):
  """
  Rolling multi-step forecast using:
    - Seq2Seq to predict Ca
    - residual GPR on (Month, Tmax_ave, Tmin_ave) for correction
  """

  import tensorflow as tf  
  from tensorflow import keras  

  # Load artifacts
  seq2seq = keras.models.load_model(paths["seq2seq"])
  gpr_res = joblib.load(paths["gpr_res"])
  ca_sc = joblib.load(paths["ca_sc"])
  f_sc = joblib.load(paths["f_sc"])
  x2_sc = joblib.load(paths["x2_sc"])

  d, c, X, mon = _build_vehicle_slice(df, vehicle, use_features)

  if len(c) <= n_known:
      raise ValueError(
          f"Vehicle {vehicle}: not enough months ({len(c)}) for n_known={n_known}."
      )

  H = min(max_h, len(c) - n_known)
  c_win = c[:n_known].copy()
  pred = []

  for k in range(n_known, n_known + H):
      # window of known Ca + HI features
      W = np.c_[c_win[-n_known:].reshape(-1, 1), X[k - n_known : k, :]]

      # scale Ca and features separately
      Wc = ca_sc.transform(W[:, [0]])
      Wf = f_sc.transform(W[:, 1:])
      x_in = np.concatenate([Wc, Wf], axis=1)[None, ...]

      # seq2seq prediction
      yhat_s = seq2seq.predict(x_in, verbose=0).ravel()[0]

      # residual GPR correction
      tmax = float(d["Tmax_ave"].iloc[k])
      tmin = float(d["Tmin_ave"].iloc[k])
      x2 = np.array([[mon[k], tmax, tmin]], float)
      rhat = gpr_res.predict(x2_sc.transform(x2))[0]

      # back-transform Ca
      y_next = ca_sc.inverse_transform([[yhat_s + rhat]])[0, 0]

      pred.append(y_next)
      c_win = np.r_[c_win, y_next]

  t_all = np.arange(1, len(c) + 1)
  y_pred = np.full_like(c, np.nan, dtype=float)
  y_pred[n_known : n_known + H] = pred

  return t_all, c, y_pred

# Static SVR / GPR baselines

def _get_or_train_static(model_name, df, use_features, save_name: str):
  """
  Train (or load) a static regressor that predicts Ca from one-step features.
  """
  save_path = ART_DIR / save_name

  if save_path.exists():
      return joblib.load(save_path)

  # Use first 10 vehicles for training 
  vids = sorted(df["vehicle"].unique())[:10]
  train = df[df["vehicle"].isin(vids)].dropna(subset=["Ca"]).copy()

  X = train[use_features].values.astype(float)
  y = train["Ca"].values.astype(float)

  if model_name == "svr":
      model = _SVR(C=10.0, epsilon=0.2, kernel="rbf", gamma="scale")
  elif model_name == "gpr":
      kernel = RBF(length_scale=5.0) + WhiteKernel(noise_level=1.0)
      model = _GPR(kernel=kernel, normalize_y=True, random_state=0)
  else:
      raise ValueError("model_name must be 'svr' or 'gpr'")

  xsc = StandardScaler().fit(X)
  Xs = xsc.transform(X)
  model.fit(Xs, y)

  os.makedirs(save_path.parent, exist_ok=True)
  joblib.dump({"model": model, "xsc": xsc}, save_path)

  return {"model": model, "xsc": xsc}


def _predict_static_curve(df, vehicle, n_known, max_h, use_features, bundle):
  d, c, X, _ = _build_vehicle_slice(df, vehicle, use_features)

  if len(c) <= n_known:
      raise ValueError(
          f"Vehicle {vehicle}: not enough months ({len(c)}) for n_known={n_known}."
      )

  H = min(max_h, len(c) - n_known)

  model = bundle["model"]
  xsc = bundle["xsc"]

  idx = np.arange(n_known, n_known + H)
  Xf = X[idx, :]
  yhat = model.predict(xsc.transform(Xf))

  t_all = np.arange(1, len(c) + 1)
  y_pred = np.full_like(c, np.nan, dtype=float)
  y_pred[idx] = yhat

  return t_all, c, y_pred


# Public API

ModelKey = Literal["seq2seq_gpr", "gpr", "svr"]


def run_forecast(
  vehicle: int,
  model: ModelKey,
  n_known: int | None,
  max_h: int,
) -> Dict:
  """
  Core function used by the FastAPI endpoint.

  Returns JSON-serialisable dict with:
    - time index (t)
    - actual Ca
    - predicted Ca
    - MAE / RMSE
    - degradation metrics
    - plot_png (base64-encoded PNG of actual vs predicted)
  """
  df = load_feat_df()
  use_features, n_known_default, paths = _load_cfg_and_artifacts()

  if n_known is None or n_known <= 0:
      n_known = n_known_default

  if model == "seq2seq_gpr":
      t, y_true, y_pred = _forecast_seq2seq_gpr(
          df, vehicle, n_known, max_h, use_features, paths
      )
      model_label = "Seq2Seq-I + GPR-I"
  elif model in ("svr", "gpr"):
      bundle = _get_or_train_static(
          model, df, use_features, f"{model}_static.pkl"
      )
      t, y_true, y_pred = _predict_static_curve(
          df, vehicle, n_known, max_h, use_features, bundle
      )
      model_label = model.upper()
  else:
      raise ValueError(f"Unknown model key: {model}")

  # Metrics over forecast window
  mask = ~np.isnan(y_pred)
  mae = mean_absolute_error(y_true[mask], y_pred[mask]) if mask.any() else None
  rmse = _rmse(y_true[mask], y_pred[mask]) if mask.any() else None

  current_ca = float(y_true[n_known - 1])
  last_pred = float(y_pred[mask][-1]) if mask.any() else float(y_true[-1])
  degr_ah = current_ca - last_pred
  degr_pct = (degr_ah / current_ca * 100.0) if current_ca > 0 else None

  # Convert numpy arrays to plain lists, NaN → None
  def _to_list(arr):
      out = []
      for x in arr:
          if isinstance(x, (float, int)) and np.isnan(x):
              out.append(None)
          else:
              out.append(float(x))
      return out

  result: Dict = {
      "vehicle_id": int(vehicle),
      "model": model,
      "model_label": model_label,
      "n_known": int(n_known),
      "horizon": int(max_h),
      "t": [int(i) for i in t],
      "actual": _to_list(y_true),
      "predicted": _to_list(y_pred),
      "mae": float(mae) if mae is not None else None,
      "rmse": float(rmse) if rmse is not None else None,
      "current_ca": current_ca,
      "last_predicted_ca": last_pred,
      "degradation_ah": degr_ah,
      "degradation_pct": degr_pct,
  }

  # base64-encoded PNG plot of actual vs predicted Ca
  try:
      import matplotlib.pyplot as plt  

      fig, ax = plt.subplots(figsize=(4.2, 2.3), dpi=120)
      fig.patch.set_facecolor("#020617")
      ax.set_facecolor("#020617")

      t_arr = np.asarray(t, float)
      y_true_arr = np.asarray(y_true, float)
      y_pred_arr = np.asarray(y_pred, float)

      mask_true = ~np.isnan(y_true_arr)
      mask_pred = ~np.isnan(y_pred_arr)

      # Actual Ca 
      if mask_true.any():
          ax.plot(
              t_arr[mask_true],
              y_true_arr[mask_true],
              label="Actual Ca",
              linewidth=2.2,
              color="#38bdf8",  # sky-400
          )

      # Predicted Ca 
      if mask_pred.any():
          ax.plot(
              t_arr[mask_pred],
              y_pred_arr[mask_pred],
              label=model_label or "Predicted",
              linestyle="--",
              linewidth=2.0,
              color="#eab308",  # amber-500
          )

      # Axes + grid styling
      ax.set_xlabel("Month index", color="#e5e7eb", fontsize=8)
      ax.set_ylabel("Ca (Ah)", color="#e5e7eb", fontsize=8)

      ax.grid(True, alpha=0.25, color="#1f2937", linewidth=0.6)
      ax.tick_params(colors="#9ca3af", labelsize=7)

      for spine in ax.spines.values():
          spine.set_color("#374151")
          spine.set_linewidth(0.8)

      leg = ax.legend(
          fontsize=7,
          frameon=True,
          facecolor="#020617",
          edgecolor="#1f2937",
          loc="upper right",
      )
      for text in leg.get_texts():
          text.set_color("#e5e7eb")

      fig.tight_layout(pad=1.2)

      buf = io.BytesIO()
      fig.savefig(
          buf,
          format="png",
          facecolor="#020617",
          edgecolor="none",
          transparent=False,
      )
      plt.close(fig)
      buf.seek(0)
      result["plot_png"] = base64.b64encode(buf.read()).decode("ascii")
  except Exception:
    
      result["plot_png"] = None

  return result
