// src/WalletBind.jsx
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { persistWalletAll } from "./wdStore";

/* ---------- UID helper (STRICT: no fallback) ---------- */
function getUidStrict() {
  const u = localStorage.getItem("uid");
  return u ? String(u) : null;
}

const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{25,59}$/;

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

function CenterToast({ show, text = "Wallet Bind Successfully ✅" }) {
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
          letterSpacing: 0.2,
          minWidth: 240,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>,
    document.body
  );
}

export default function WalletBind() {
  const nav = useNavigate();
  const [walletName, setWalletName] = useState("");
  const protocol = "TRC-20";
  const [address, setAddress] = useState("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [okToast, setOkToast] = useState(false);

  // Guard: if not logged in, never guess uid → send to login
  useEffect(() => {
    if (!getUidStrict()) nav("/login", { replace: true });
  }, [nav]);

  const valid = useMemo(() => TRC20_RE.test(String(address).trim()), [address]);

  async function saveAndGo() {
    if (!valid || busy) return;

    const uid = getUidStrict();
    if (!uid) {
      nav("/login", { replace: true });
      return;
    }

    setBusy(true);
    try {
      const addr = String(address).trim();
      const name = walletName || "My wallet";
      const who = owner || "—";

      // Backend persist
      try {
        await fetch(`https://backend-app-jqla.onrender.com/api/wallet/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid, address: addr, network: protocol, walletName: name }),
        });
      } catch {}

      // Local mirrors + flags (restart-proof)
      persistWalletAll(uid, addr, protocol, name, who);
      localStorage.setItem(`wd:u:${uid}:addr`, "1");
      try { window.dispatchEvent(new Event("wd:wallet-change")); } catch {}

      setOkToast(true);
      setTimeout(() => {
        setOkToast(false);
        nav("/mine", { replace: true }); // next open → final page dikhega
      }, 600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wb-wrap">
      <header className="wb-topbar">
        <button className="wb-back" onClick={() => nav(-1)} aria-label="Back">‹</button>
        <h1>virtual currency</h1>
        <div style={{ width: 36 }} />
      </header>

      <main className="wb-main">
        <div className="wb-list">
          <label className="wb-row">
            <div className="wb-label">Wallet name</div>
            <input
              className="wb-input"
              placeholder="Please enter the wallet name"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
            />
          </label>

          <label className="wb-row">
            <div className="wb-label">Virtual Currency Protocol</div>
            <input className="wb-input" value={protocol} disabled />
          </label>

          <label className="wb-row">
            <div className="wb-label">Wallet address</div>
            <input
              className="wb-input"
              placeholder="Please enter the e-wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ fontFamily: "monospace" }}
            />
          </label>

          <label className="wb-row">
            <div className="wb-label">Names</div>
            <input className="wb-input" placeholder="Names" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: valid ? "#16a34a" : "#ef4444" }}>
          {valid ? "Valid TRC-20 address" : "Enter a valid TRC-20 address"}
        </div>

        <div className="wb-actions">
          <button className={`wb-ok ${valid ? "is-ready" : ""}`} disabled={!valid || busy} onClick={saveAndGo} type="button">
            {busy ? (<><LoaderIcon />Saving…</>) : "OK"}
          </button>
          <button className="wb-cancel" type="button" onClick={() => nav("/wallet")}>Cancel</button>
        </div>
      </main>

      <CenterToast show={okToast} />
    </div>
  );
}
