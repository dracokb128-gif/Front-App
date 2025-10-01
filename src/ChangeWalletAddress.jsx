import React, { useMemo, useState } from "react";
import { FiChevronLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { getUsers } from "./api";
import API from "./api";

/* ---------------- Toast (center) ---------------- */
function Toast({ open, type = "success", message = "", onClose }) {
  if (!open) return null;
  return (
    <div
      role="alert"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
      }}
    >
      <div
        style={{
          minWidth: 260,
          maxWidth: 360,
          background: "#0b1020",
          color: "#fff",
          borderRadius: 14,
          padding: "16px 18px",
          boxShadow: "0 10px 40px rgba(0,0,0,.3)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, marginBottom: 6 }}>
          {type === "success" ? "✅ Success" : "❌ Failed"}
        </div>
        <div style={{ fontSize: 14, opacity: 0.95 }}>{message}</div>
      </div>
    </div>
  );
}

/* -------- TRC-20 quick check -------- */
function isLikelyTRC20(v) {
  const s = String(v || "").trim();
  if (!/^T/.test(s)) return false;
  return /^T[1-9A-HJ-NP-Za-km-z]{25,59}$/.test(s);
}

/* -------- helpers to read/persist wallet -------- */
function readPayload() {
  try {
    return JSON.parse(localStorage.getItem("wd_address_payload") || "{}");
  } catch {
    return {};
  }
}
function persistWalletAll(uid, address, network = "TRC-20") {
  const old = readPayload();
  const name = old.walletName || localStorage.getItem("wd_addr_label") || "My wallet";
  const owner = old.owner || localStorage.getItem("wd_addr_owner") || "—";

  // 1) main payload
  const next = { walletName: name, protocol: network, address, owner };
  localStorage.setItem("wd_address_payload", JSON.stringify(next));

  // 2) flags / legacy keys
  localStorage.setItem("wd_address_set", "1");
  localStorage.setItem("wd_wallet_addr", address);
  localStorage.setItem("wd_addr_address", address);
  localStorage.setItem("wd_addr_chain", network);
  localStorage.setItem("wd_addr_label", name);
  localStorage.setItem("wd_addr_owner", owner);

  // 3) per-user mirror (so Wallet pages can target current user)
  const mirror = { address, network, name, owner };
  if (uid) localStorage.setItem(`user_wallet:${uid}`, JSON.stringify(mirror));

  // 🔔 notify any open screen
  window.dispatchEvent(new Event("wd:wallet-change"));
}

export default function ChangeWalletAddress() {
  const nav = useNavigate();
  const [addr, setAddr] = useState("");
  const valid = useMemo(() => isLikelyTRC20(addr), [addr]);
  const [busy, setBusy] = useState(false);

  // toast state
  const [toast, setToast] = useState({ open: false, type: "success", message: "" });
  const showToast = (type, message) => setToast({ open: true, type, message });

  async function getCurrentUserId() {
    // same pattern jaisa app me hai
    const stored = localStorage.getItem("uid");
    if (stored) return String(stored);
    const users = await getUsers().catch(() => []);
    if (users && users.length) {
      const uid = String(users[0].id);
      localStorage.setItem("uid", uid);
      return uid;
    }
    return "";
  }

  async function handleSave() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("User not found");

      // server (if available)
      if (typeof API.setWalletAddress === "function") {
        await API.setWalletAddress(uid, addr);
      }

      // local persistence (UI + refresh proof)
      persistWalletAll(uid, addr, "TRC-20");

      showToast("success", "Wallet address updated successfully.");
      setTimeout(() => nav("/wallet/final", { replace: true }), 700);
    } catch (e) {
      const msg =
        e?.data?.message || e?.data?.error || e?.message || "Unable to save wallet address.";
      showToast("error", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page wrap">
      <div className="subhead">
        <button className="back" onClick={() => nav(-1)} aria-label="Back">
          <FiChevronLeft />
        </button>
        <div className="title">Change Wallet Address</div>
        <div className="right-space" />
      </div>

      <div className="wa-card">
        {/* Network row */}
        <div className="wa-row between">
          <span className="wa-label">Network:</span>
          <span className="net-pill" title="TRON USDT (TRC-20)">
            <span className="net-ico" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 4l9 4 9-4-9 16-9-16Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>TRC-20 (USDT)</span>
          </span>
        </div>

        {/* Address input */}
        <div className="wa-field">
          <label className="wa-label">New Wallet Address</label>
          <input
            className="wa-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="Enter TRC-20 address (starts with T)"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) setTimeout(() => setAddr(text), 0);
            }}
          />
        </div>

        {/* hint */}
        <ul className="wa-hints" style={{ color: valid ? "#16a34a" : "#ef4444" }}>
          <li>
            {valid
              ? "TRC-20 format detected."
              : "Must be a valid TRC-20 address (usually starts with T)"}
          </li>
        </ul>

        <button
          type="button"
          className={`wa-btn ${valid && !busy ? "active" : "disabled"}`}
          disabled={!valid || busy}
          onClick={handleSave}
        >
          {busy ? "Saving..." : "Save Address"}
        </button>
      </div>

      <div className="bottom-space" />

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
