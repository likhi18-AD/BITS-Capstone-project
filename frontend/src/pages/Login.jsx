// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginOperator,
  registerOperator,
  requestPasswordReset,
} from "../api/client";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"

  // Login form state
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPwdVisible, setLoginPwdVisible] = useState(false);

  // Register form state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmployeeId, setRegEmployeeId] = useState("");
  const [regPwdVisible, setRegPwdVisible] = useState(false);

  // Forgot-password form state
  const [forgotEmail, setForgotEmail] = useState("");

  // Status messages
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const switchToLogin = () => {
    setMode("login");
    setError("");
    setInfo("");
  };

  const switchToRegister = () => {
    setMode("register");
    setError("");
    setInfo("");
  };

  const switchToForgot = () => {
    setMode("forgot");
    setError("");
    setInfo("");
  };

  // Handle login submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!loginId || !loginPassword) {
      setError("Please enter your operator ID and password.");
      return;
    }

    try {
      const res = await loginOperator({
        operator_id: loginId,
        password: loginPassword,
      });

      window.localStorage.setItem(
        "wind_granma_operator",
        JSON.stringify({
          operator_id: res.operator_id,
          email: res.email,
          employee_id: res.employee_id,
        })
      );

      setInfo("Login successful. Redirecting to fleet dashboard…");

      setTimeout(() => {
        navigate("/fleet");
      }, 500);
    } catch (err) {
      console.error("Login failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Login failed. Please check your ID and password.";
      setError(msg);
    }
  };

  // Handle registration submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!regEmail || !regPassword || !regEmployeeId) {
      setError("Please fill email, password and employee ID.");
      return;
    }

    try {
      const res = await registerOperator({
        email: regEmail,
        password: regPassword,
        employee_id: regEmployeeId,
      });

      const operatorId = res.operator_id;

      setInfo(
        `Congratulations! You are now registered as a Wind Granma fleet operator. ` +
          `Your unique operator ID is ${operatorId}. It has also been emailed to you.`
      );

      setLoginId(operatorId);
      setLoginPassword(regPassword);

      setTimeout(() => {
        setMode("login");
      }, 1200);
    } catch (err) {
      console.error("Registration failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Registration failed. Please check your details.";
      setError(msg);
    }
  };

  // Handle forgot-password submit
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!forgotEmail) {
      setError("Please enter the email you used for registration.");
      return;
    }

    try {
      const res = await requestPasswordReset(forgotEmail);
      setInfo(res.message || "If an account exists, a reset link has been sent.");
      setForgotEmail("");
    } catch (err) {
      console.error("Forgot password failed", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to process reset request. Please try again.";
      setError(msg);
    }
  };

  return (
    <div className="loginPage">
      {/* Left side: EV station GIF */}
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

      {/* Right side: auth card */}
      <div className="loginRight">
        <div className="loginCard">
          <h1 className="loginTitle">Fleet Operator Portal</h1>
          <p className="loginDesc">
            Log in with your <strong>Operator ID</strong> to monitor the health
            of your EV fleet, powered by ML-based battery forecasting.
          </p>

          {/* Tabs only switch between login and register */}
          <div className="loginTabs">
            <button
              type="button"
              className={mode === "login" ? "loginTab active" : "loginTab"}
              onClick={switchToLogin}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? "loginTab active" : "loginTab"}
              onClick={switchToRegister}
            >
              Register
            </button>
          </div>

          {/* LOGIN MODE */}
          {mode === "login" && (
            <form className="loginForm" onSubmit={handleLoginSubmit}>
              <label className="loginLabel">
                Operator ID
                <input
                  type="text"
                  placeholder="e.g. WG123"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                />
              </label>

              <label className="loginLabel">
                Password
                <div className="passwordFieldWrapper">
                  <input
                    type={loginPwdVisible ? "text" : "password"}
                    placeholder="Your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setLoginPwdVisible((v) => !v)}
                    aria-label={loginPwdVisible ? "Hide password" : "Show password"}
                  >
                    <span
                      className={
                        "passwordEyeIcon" +
                        (loginPwdVisible ? " passwordEyeIcon-open" : "")
                      }
                    />
                  </button>
                </div>
              </label>

              <button type="submit" className="loginPrimaryBtn">
                Sign in
              </button>

              <p className="loginHint">
                <button
                  type="button"
                  className="loginInlineLink"
                  onClick={switchToForgot}
                >
                  Forgot password?
                </button>
              </p>

              <p className="loginHint">
                New to Wind Granma?{" "}
                <button
                  type="button"
                  className="loginInlineLink"
                  onClick={switchToRegister}
                >
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* REGISTER MODE */}
          {mode === "register" && (
            <form className="loginForm" onSubmit={handleRegisterSubmit}>
              <label className="loginLabel">
                Operator email
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </label>

              <label className="loginLabel">
                Choose password
                <div className="passwordFieldWrapper">
                  <input
                    type={regPwdVisible ? "text" : "password"}
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setRegPwdVisible((v) => !v)}
                    aria-label={regPwdVisible ? "Hide password" : "Show password"}
                  >
                    <span
                      className={
                        "passwordEyeIcon" +
                        (regPwdVisible ? " passwordEyeIcon-open" : "")
                      }
                    />
                  </button>
                </div>
              </label>

              <label className="loginLabel">
                Employee ID
                <input
                  type="text"
                  placeholder="Company employee ID"
                  value={regEmployeeId}
                  onChange={(e) => setRegEmployeeId(e.target.value)}
                />
              </label>

              <button type="submit" className="loginPrimaryBtn">
                Register as fleet operator
              </button>

              <p className="loginHint">
                Already have an operator ID?{" "}
                <button
                  type="button"
                  className="loginInlineLink"
                  onClick={switchToLogin}
                >
                  Sign in instead
                </button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === "forgot" && (
            <form className="loginForm" onSubmit={handleForgotSubmit}>
              <label className="loginLabel">
                Registered email
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </label>

              <button type="submit" className="loginPrimaryBtn">
                Send reset link
              </button>

              <p className="loginHint">
                Remembered your password?{" "}
                <button
                  type="button"
                  className="loginInlineLink"
                  onClick={switchToLogin}
                >
                  Back to sign in
                </button>
              </p>
            </form>
          )}

          {error && <div className="loginAlert error">{error}</div>}
          {info && <div className="loginAlert info">{info}</div>}
        </div>
      </div>
    </div>
  );
}

export default Login;
