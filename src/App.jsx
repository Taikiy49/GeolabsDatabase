// src/App.jsx
import { Routes, Route } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles/app.css";

import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/PNP";
import OCRLookup from "./pages/OCRLookup";

import geolabsLogo from "./assets/geolabs.png";

import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

import { setUserContext } from "./api/client"; // ✅ NEW

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [msalReady, setMsalReady] = useState(false);

  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const pushToast = useCallback((title, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [{ id, title, message }, ...t].slice(0, 4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const email = useMemo(() => {
    return (accounts?.[0]?.username || "").toLowerCase();
  }, [accounts]);

  // ✅ push MSAL user context into API client (email/name/oid)
  useEffect(() => {
    const acct = accounts?.[0] || null;
    const claims = acct?.idTokenClaims || {};

    setUserContext({
      email: (acct?.username || claims?.preferred_username || claims?.upn || "").toLowerCase(),
      name: claims?.name || acct?.name || "",
      oid: claims?.oid || "",
    });
  }, [accounts]);

  // ✅ Ensure MSAL is initialized before we try redirect calls
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (typeof instance?.initialize === "function") {
          await instance.initialize();
        }
        if (alive) setMsalReady(true);
      } catch (e) {
        console.error(e);
        if (alive) setMsalReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [instance]);

  const login = useCallback(async () => {
    try {
      if (!msalReady) {
        pushToast("Hold up", "MSAL is still initializing. Try again in a second.");
        return;
      }
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error(e);
      pushToast("Login failed", String(e?.message || "Could not start sign-in."));
    }
  }, [instance, msalReady, pushToast]);

  const logout = useCallback(async () => {
    try {
      if (!msalReady) return;
      await instance.logoutRedirect();
    } catch (e) {
      console.error(e);
      pushToast("Logout failed", "Could not sign out. Try again.");
    }
  }, [instance, msalReady, pushToast]);

  // Warn on wrong domain
  useEffect(() => {
    if (!isAuthenticated) return;
    if (email && !email.endsWith("@geolabs.net")) {
      pushToast("Access Denied", "Please sign in with your @geolabs.net account.");
    }
  }, [isAuthenticated, email, pushToast]);

  if (!msalReady) {
    return (
      <div className="login-screen app-fade-in">
        <div className="login-card">
          <img src={geolabsLogo} alt="Geolabs" className="login-logo" />
          <h2 className="login-title">Geolabs Internal Portal</h2>
          <p className="login-subtitle">Loading authentication…</p>
        </div>
        <Toast toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-screen app-fade-in">
        <div className="login-card">
          <img src={geolabsLogo} alt="Geolabs" className="login-logo" />
          <h2 className="login-title">Geolabs Internal Portal</h2>
          <p className="login-subtitle">
            Sign in with your Microsoft <b>@geolabs.net</b> account to continue.
          </p>
          <button className="login-button" onClick={login}>
            Login with Microsoft
          </button>
        </div>

        <Toast toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  if (!email.endsWith("@geolabs.net")) {
    return (
      <div className="login-screen app-fade-in">
        <div className="login-card login-denied">
          <img src={geolabsLogo} alt="Geolabs" className="login-logo" />
          <h2 className="login-title">Access Denied</h2>
          <p className="login-subtitle">
            You must be signed in with a <b>@geolabs.net</b> Microsoft account.
          </p>
          <button className="login-button" onClick={logout}>
            Sign out
          </button>
        </div>

        <Toast toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="app-shell app-fade-in">
      <Sidebar logoSrc={geolabsLogo} userEmail={email} onLogout={logout} />

      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects pushToast={pushToast} />} />
          <Route path="/ocr" element={<OCRLookup pushToast={pushToast} />} />
        </Routes>
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  );
}