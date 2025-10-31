
import json, joblib, numpy as np, tensorflow as tf

class SOHPredictor:
    def __init__(self, artifacts_dir="artifacts"):
        self.model = tf.keras.models.load_model(f"{artifacts_dir}/seq2seq_f1.keras")
        self.z_scaler = joblib.load(f"{artifacts_dir}/z_scaler.pkl")
        self.x2_scaler = joblib.load(f"{artifacts_dir}/x2_scaler.pkl")
        self.gpr = joblib.load(f"{artifacts_dir}/gpr_residual.pkl")
        with open(f"{artifacts_dir}/features_f1.json") as f:
            self.features = json.load(f)
        self.N_KNOWN = 6
        self.P_FUTURE = 23

    def predict_future(self, known_capacity_6, known_feature_6, future_months, future_tmax=None, future_tmin=None):
        # known_capacity_6: (6,) array
        # known_feature_6:  (6, len(features)) array
        # future_months:    (p,) integers in [1..12]
        # future_tmax/min:  (p,) arrays; if None, they are set to the last known values
        p = min(self.P_FUTURE, len(future_months))
        X_in = np.c_[ np.asarray(known_capacity_6).reshape(-1,1), np.asarray(known_feature_6) ]
        X_in_s = self.z_scaler.transform(X_in)
        X = X_in_s[None, ...]  # (1,6,1+m)
        Y_hat = self.model.predict(X, verbose=0)[0,:p,0]  # (p,)

        if future_tmax is None: future_tmax = np.repeat(known_feature_6[-1, self.features.index("Tmax_sum")] if "Tmax_sum" in self.features else 0.0, p)
        if future_tmin is None: future_tmin = np.repeat(0.0, p)

        X2 = np.c_[ np.asarray(future_months[:p]), np.asarray(future_tmax)[:p], np.asarray(future_tmin)[:p] ]
        X2s = self.x2_scaler.transform(X2)
        resid = self.gpr.predict(X2s)
        return (Y_hat + resid).astype(float)
