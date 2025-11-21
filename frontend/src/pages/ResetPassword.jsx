// frontend/src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../api/client";
import "./Login.css";

function useResetToken() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  return params.get("token") || "";
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = useResetToken();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!token) {
      setError("Invalid or missing reset token. Please request a new link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const res = await resetPassword(token, newPassword);
      setInfo(res.message || "Password reset successfully.");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("Reset password failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Password reset failed. Your link may be expired.";
      setError(msg);
    }
  };

  return (
    <div className="loginPage">
      {/* Left side: reuse the same GIF + tagline */}
      <div className="loginLeft">
        <div className="loginGifOverlay">
          <img
            src="/assets/ev-station.gif"
            alt="EV charging station animation"
            className="loginGif"
          />
          <div className="loginGifGradient" />
          <div className="loginTagline">
            <span className="loginCompany">Wind Granma</span>
            <span className="loginSubtitle">
              Fleet health, forecasted — not guessed.
            </span>
          </div>
        </div>
      </div>

      {/* Right side: reset card */}
      <div className="loginRight">
        <div className="loginCard">
          <h1 className="loginTitle">Reset password</h1>
          <p className="loginDesc">
            Set a new password for your Wind Granma fleet operator account.
          </p>

          <form className="loginForm" onSubmit={handleSubmit}>
            <label className="loginLabel">
              New password
              <div className="passwordFieldWrapper">
                <input
                  type={showNewPwd ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="passwordToggleBtn"
                  onClick={() => setShowNewPwd((v) => !v)}
                  aria-label={showNewPwd ? "Hide password" : "Show password"}
                >
                  <span
                    className={
                      "passwordEyeIcon" +
                      (showNewPwd ? " passwordEyeIcon-open" : "")
                    }
                  />
                </button>
              </div>
            </label>

            <label className="loginLabel">
              Confirm new password
              <div className="passwordFieldWrapper">
                <input
                  type={showConfirmPwd ? "text" : "password"}
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="passwordToggleBtn"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  aria-label={
                    showConfirmPwd ? "Hide password" : "Show password"
                  }
                >
                  <span
                    className={
                      "passwordEyeIcon" +
                      (showConfirmPwd ? " passwordEyeIcon-open" : "")
                    }
                  />
                </button>
              </div>
            </label>

            <button type="submit" className="loginPrimaryBtn">
              Update password
            </button>

            <p className="loginHint">
              Changed your mind?{" "}
              <button
                type="button"
                className="loginInlineLink"
                onClick={() => navigate("/")}
              >
                Back to sign in
              </button>
            </p>
          </form>

          {error && <div className="loginAlert error">{error}</div>}
          {info && <div className="loginAlert info">{info}</div>}
        </div>
      </div>
    </div>
  );
}

