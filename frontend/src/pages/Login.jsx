// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginOperator,
  registerOperator,
} from "../api/client";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"

  // Login form state
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmployeeId, setRegEmployeeId] = useState("");

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

      // Optionally store something in localStorage for later
      window.localStorage.setItem(
        "wind_granma_operator",
        JSON.stringify({
          operator_id: res.operator_id,
          email: res.email,
          employee_id: res.employee_id,
        })
      );

      setInfo("Login successful. Redirecting to fleet dashboard…");

      // Navigate to fleet overview
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

      // Show a friendly message with the generated ID
      setInfo(
        `Congratulations! You are now registered as a Wind Granma fleet operator. ` +
          `Your unique operator ID is ${operatorId}. It has also been emailed to you.`
      );

      // Pre-fill login form so user can log in immediately
      setLoginId(operatorId);
      setLoginPassword(regPassword);

      // Switch to login tab after a moment
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

  return (
    <div className="loginPage">
      {/* Left side: EV station GIF */}
      <div className="loginLeft">
        <div className="loginGifOverlay">
          {/* Put your GIF under public/assets/ev-station.gif or update the src */}
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

          <div className="loginTabs">
            <button
              type="button"
              className={
                mode === "login" ? "loginTab active" : "loginTab"
              }
              onClick={switchToLogin}
            >
              Sign in
            </button>
            <button
              type="button"
              className={
                mode === "register" ? "loginTab active" : "loginTab"
              }
              onClick={switchToRegister}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
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
                <input
                  type="password"
                  placeholder="Your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </label>

              <button type="submit" className="loginPrimaryBtn">
                Sign in
              </button>

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
          ) : (
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
                <input
                  type="password"
                  placeholder="Create a password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
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

          {error && <div className="loginAlert error">{error}</div>}
          {info && <div className="loginAlert info">{info}</div>}
        </div>
      </div>
    </div>
  );
}

export default Login;
