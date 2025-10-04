import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { requestDeposit } from "./api";

/* ------------ helpers: userId ko kahin se pick karo ------------- */
function extractId(obj) {
  if (!obj || typeof obj !== "object") return "";
  if (obj.id != null) return String(obj.id).replace(/^u/i, "");
  if (obj.user && obj.user.id != null) return String(obj.user.id).replace(/^u/i, "");
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") {
      const r = extractId(v);
      if (r) return r;
    }
  }
  return "";
}
function getUserIdFromAnywhere(params) {
  const q = params.get("uid");
  if (q) return String(q).replace(/^u/i, "");

  // quick keys
  for (const k of ["uid", "userId"]) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v && String(v).trim()) return String(v).replace(/^u/i, "");
  }

  // deep objects stored in LS/SS
  try {
    const keys = ["user", "userInfo", "auth", "state", "currentUser", "login"];
    for (const k of keys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const id = extractId(obj);
        if (id) return id;
      } catch {}
    }
  } catch {}

  return "";
}

export default function DepositConfirm() {
  const nav = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);

  const amt = useMemo(() => {
    const v = Number(params.get("amt") || 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [search]);

  const userId = useMemo(() => getUserIdFromAnywhere(params), [search]);

  const [address, setAddress]   = useState("");
  const [deposit, setDeposit]   = useState(null); // whole deposit (id/status/address/amount)
  const [showBanner, setBanner] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);

  // address request (server existing PENDING ko reuse karega, warna naya banayega)
  useEffect(() => {
    let cancel = false;

    (async () => {
      if (!userId || !(amt > 0.1)) return;

      setLoading(true);
      try {
        const prevId = localStorage.getItem("lastDepositId") || "";

        const r = await requestDeposit(userId, amt);
        if (cancel) return;

        if (r?.ok && r.address && r.deposit) {
          const dep = r.deposit;
          setAddress(String(r.address));
          setDeposit(dep);

          // 🔸 Banner sirf tab show jab same pending id pe wapas aaya ho
          const isSamePending = dep && dep.status === "PENDING" && prevId && prevId === String(dep.id || "");
          setBanner(!!isSamePending);

          // current pending id save
          if (dep && dep.status === "PENDING") {
            localStorage.setItem("lastDepositId", String(dep.id || ""));
          } else {
            localStorage.removeItem("lastDepositId");
          }
        } else {
          setAddress("");
          setDeposit(null);
          setBanner(false);
          alert(r?.msg || "Failed to request deposit address");
        }
      } catch (e) {
        const msg =
          e?.message ||
          (e?.status === 404 && e?.lastURL
            ? `Endpoint not found: ${e.lastURL}`
            : "Network error requesting deposit address");
        alert(msg);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [userId, amt]);

  const qrUrl = useMemo(() => {
    return address
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(address)}`
      : "";
  }, [address]);

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(address || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert("Copy failed");
    }
  }

  // Guard: userId missing to login page/back
  useEffect(() => {
    if (!userId) {
      alert("Please login again (userId missing).");
      nav(-1);
    }
  }, [userId, nav]);

  return (
    <div className="dep-wrap dep-confirm">
      {/* topbar */}
      <header className="dep-topbar">
        <button className="dep-back dep-back--tint" type="button" onClick={() => nav(-1)} aria-label="Back">
          <svg viewBox="0 0 24 24" className="dep-back-ico" aria-hidden="true">
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff5f6d" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path d="M15 18l-6-6 6-6" fill="none" stroke="url(#depGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        </button>
        <h1>Deposit</h1>
        <div style={{ width: 36 }} />
      </header>

      <main className="dep-main">
        <div className="dep2-card">
          {/* Amount + tags */}
          <div className="dep2-head">
            <div className="dep2-amount">{amt ? amt.toLocaleString() : "—"}</div>
            <div className="dep2-tags">
              <span className="pill pill-muted"><span className="dot" /> Network</span>
              <span className="pill pill-brand">TRON (TRC-20)</span>
            </div>
          </div>

          {/* Warning banner (revisit same pending) */}
          {showBanner && (
            <div
              style={{
                marginTop: 8, marginBottom: 8,
                background: "#fff7ed", border: "1px solid #ffedd5",
                color: "#b45309", padding: "10px 12px", borderRadius: 10,
                fontSize: 14, display: "flex", alignItems: "center", gap: 8
              }}
            >
              <span aria-hidden>⚠</span>
              <span><b>You have an order that has not been paid</b></span>
            </div>
          )}

          {/* Title */}
          <div className="dep2-onetime">One Time Address:</div>

          {/* QR */}
          <div className="dep2-qr">
            {address ? <img src={qrUrl} alt="Deposit QR" /> : <div className="dep2-qr-skel">Preparing...</div>}
          </div>

          {/* Address row */}
          <div className="dep2-addr">
            <div className="dep2-addr-box" title={address || "-"}>{address || "-"}</div>
            <button type="button" className="dep2-copy" onClick={copyAddr} disabled={!address}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Status text */}
          <div className="dep2-wait">
            {loading ? "Preparing address..." : "Waiting for payment..."}
          </div>

          {/* Tips */}
          <div className="dep2-tips">
            <div className="dep2-tips-title">Tips:</div>
            <ol>
              <li>The recharge address is a <b className="hot">one-time address</b>, please do not leave it or transfer it repeatedly.</li>
              <li>The minimum recharge amount is <b className="hot">not less than 10 USDT</b>.</li>
              <li>After recharging, it will take about <b className="hot">1 to 2 minutes</b> to confirm the payment.</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
