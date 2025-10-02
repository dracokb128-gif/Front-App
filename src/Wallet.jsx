// src/Wallet.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiEye, FiEyeOff, FiLock, FiX } from "react-icons/fi";
import { isBound, wdEnsureFreshOnLogin, syncWalletFromServer } from "./wdStore";
import { wdSetPassword } from "./api"; // ✅ still saves WD password on server

/* ---------- UID: strict (NO guessing, NO fallback) ---------- */
function getUidStrict() {
  const u = localStorage.getItem("uid");
  return u ? String(u).replace(/^u/i, "") : null;
}

/* ---------- tiny inline SVG loader (no CSS needed) ---------- */
function LoaderIcon({ size = 16, color = "#fff", style }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 50 50" style={{ marginRight: 8, verticalAlign: "-2px", ...style }}>
      <circle cx="25" cy="25" r="20" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="6" />
      <path fill="none" stroke={color} strokeWidth="6" d="M45 25a20 20 0 0 0-20-20">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/* ---------------- Home: Wallet ---------------- */
export default function Wallet() {
  const nav = useNavigate();

  useEffect(() => {
    const uid = getUidStrict();
    if (!uid) {
      // no logged-in user → never guess; go to login
      nav("/login", { replace: true });
      return;
    }

    wdEnsureFreshOnLogin(uid);

    (async () => {
      // Authoritative sync: backend → local mirrors
      await syncWalletFromServer(uid);

      // ✅ Redirect ONLY on address presence (password-flag par dependency hata di)
      const addrSet = isBound(uid);
      if (addrSet) {
        nav("/wallet/final", { replace: true });
      }
    })();
  }, [nav]);

  return (
    <div className="wd-wrap">
      <div className="wd-topbar">
        <button className="wd-back" onClick={() => nav(-1)} aria-label="Back">‹</button>
        <div className="wd-title">Wallet</div>
        <div className="wd-spacer" />
      </div>

      {/* Wallet card */}
      <div
        className="wd-card"
        style={{
          marginTop: 12, marginLeft: 16, marginRight: 16,
          width: "calc(100% - 32px)",
          display: "flex", alignItems: "center", gap: 12,
          boxSizing: "border-box",
        }}
      >
        <div
          className="wd-coin"
          style={{
            width: 56, height: 56, borderRadius: 12, background: "#f2f7ff",
            display: "grid", placeItems: "center", overflow: "hidden"
          }}
        >
          <img
            src="https://static.vecteezy.com/system/resources/previews/026/362/270/non_2x/virtual-currency-icon-vector.jpg"
            alt="virtual currency"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="wd-coin-text">
          <div className="wd-coin-title">Virtual</div>
          <div className="wd-coin-sub">Currency</div>
        </div>

        <div className="wd-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <FiCheckCircle className="wd-check" style={{ fontSize: 22, color: "#3B82F6" }} />
        </div>
      </div>

      {/* Add e-wallet */}
      <button
        className="wd-add"
        onClick={() => nav("/wallet/password")}
        type="button"
        style={{ marginTop: 14, marginLeft: 16, marginRight: 16, width: "calc(100% - 32px)" }}
      >
        <span className="wd-plus">＋</span>
        <span>Add e-wallet</span>
      </button>

      <p className="wd-hint" style={{ marginLeft: 16, marginRight: 16, width: "calc(100% - 32px)" }}>
        Please bind an electronic wallet for withdrawal
      </p>
    </div>
  );
}

/* ---------- Center Toast (shared) ---------- */
function CenterToast({ show, text = "Success ✅" }) {
  if (!show) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 9999, pointerEvents: "none" }}>
      <div
        style={{
          padding: "10px 16px",
          borderRadius: 999,
          background: "#16a34a",
          color: "#fff",
          fontWeight: 800,
          boxShadow: "0 20px 40px rgba(22,163,74,.35)",
          letterSpacing: .2,
          minWidth: 180,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>,
    document.body
  );
}

/* ---------------- Password Modal: /wallet/password ---------------- */
export function WalletPassword() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [okToast, setOkToast] = useState(false);

  useEffect(() => {
    // guard: if no uid, bounce to login
    const uid = getUidStrict();
    if (!uid) nav("/login", { replace: true });
  }, [nav]);

  const validLen = pwd.length >= 6;
  const match = pwd.length > 0 && pwd === pwd2;
  const canContinue = validLen && match && !busy;

  async function handleContinue(e) {
    e?.preventDefault();
    if (!canContinue) return;

    const uid = getUidStrict();
    if (!uid) {
      nav("/login", { replace: true });
      return;
    }

    setBusy(true);
    try {
      // ✅ Save the withdrawal password to the backend.
      try {
        await wdSetPassword(uid, pwd);
      } catch (err) {
        // If it's already set (409) we treat it as success to avoid blocking UX.
        if (err?.status !== 409) throw err;
      }

      // Keep the tiny local flag (not used for gating anymore, but harmless).
      localStorage.setItem(`wd:u:${uid}:pwd`, "1");

      setOkToast(true);
      setTimeout(() => {
        setOkToast(false);
        window.location.assign("/wallet/bind");
      }, 750);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="wd-dim" onClick={() => window.history.back()} />
      <div className="wd-sheet wd-sheet--center" role="dialog" aria-modal="true" style={{ paddingBottom: 8 }}>
        <div className="wd-sheet-head">
          <div className="wd-sheet-title"><FiLock /> Set withdrawal password</div>
          <button className="wd-sheet-close" onClick={() => window.history.back()} aria-label="Close"><FiX /></button>
        </div>

        <form onSubmit={handleContinue}>
          <label className="wd-field">
            <span className="wd-field-label">Password</span>
            <div className="wd-input">
              <input
                type={show1 ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
              <button
                type="button"
                className="wd-eye"
                onClick={() => setShow1((s) => !s)}
                aria-label={show1 ? "Hide password" : "Show password"}
              >
                {show1 ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <small className={`wd-hintline ${validLen ? "ok" : ""}`}>At least 6 characters</small>
          </label>

          <label className="wd-field">
            <span className="wd-field-label">Confirm password</span>
            <div className="wd-input">
              <input
                type={show2 ? "text" : "password"}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                placeholder="Re-enter password"
              />
              <button
                type="button"
                className="wd-eye"
                onClick={() => setShow2((s) => !s)}
                aria-label={show2 ? "Hide password" : "Show password"}
              >
                {show2 ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {pwd2.length > 0 && (
              <small className={`wd-hintline ${match ? "ok" : "err"}`}>
                {match ? "Passwords match" : "Passwords do not match"}
              </small>
            )}
          </label>

          <button className="wd-primary" type="submit" disabled={!canContinue} style={{ marginTop: 10, marginBottom: 0 }}>
            {busy ? (<><LoaderIcon />Saving…</>) : "Continue"}
          </button>
        </form>
      </div>

      <CenterToast show={okToast} text="Success ✅" />
    </>
  );
}
