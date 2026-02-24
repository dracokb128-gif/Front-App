// src/DepositPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// USDT icon (base64)
const USDT_IMG =
  "data:image/png;base64,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";

export default function DepositPage({ onBack }) {
  const [amount, setAmount] = useState("");
  const min = 0.1;
  const nav = useNavigate();

  const num = useMemo(() => Number(amount || 0), [amount]);
  const valid = Number.isFinite(num) && num >= min;

  // read userId from localStorage
  const uid = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return "";
      const u = JSON.parse(raw);
      return String(u?.id || u?.user?.id || "");
    } catch {
      return "";
    }
  }, []);

  function gotoConfirm() {
    const url = uid
      ? `/deposit/confirm?amt=${num.toFixed(2)}&uid=${encodeURIComponent(uid)}`
      : `/deposit/confirm?amt=${num.toFixed(2)}`;
    nav(url);
  }

  return (
    <div className="dep-wrap">
      <header className="dep-topbar">
        <button
          className="dep-back dep-back--tint"
          type="button"
          onClick={onBack ?? (() => window.history.back())}
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="dep-back-ico" aria-hidden="true">
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff5f6d" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="url(#depGrad)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
        <h1>Deposit</h1>
        <div style={{ width: 36 }} />
      </header>

      <main className="dep-main">
        {/* Payment method */}
        <section className="dep-section">
          <h3>Payment method</h3>
          <div className="dep-grid">
            <div className="dep-tile dep-selected">
              <div className="dep-coin">
                <img src={USDT_IMG} alt="USDT" className="dep-usdt-img" />
              </div>
              <div className="dep-txt">USDT</div>
              <span className="dep-ribbon" />
            </div>
          </div>
        </section>

        {/* Protocol */}
        <section className="dep-section">
          <h3>Select the protocol to use</h3>
          <div className="dep-grid">
            <div className="dep-tile dep-selected">
              <div className="dep-txt">TRC-20</div>
              <span className="dep-ribbon" />
            </div>
          </div>
        </section>

        {/* Currency */}
        <section className="dep-section">
          <h3>Currency selection</h3>
          <div className="dep-grid">
            <div className="dep-tile dep-selected">
              <div className="dep-txt">ALL</div>
              <span className="dep-ribbon" />
            </div>
          </div>
        </section>

        {/* Amount */}
        <section className="dep-section">
          <h3>Deposit amount</h3>
          <div className="dep-amount">
            <div className="dep-unit">USDT</div>
            <input
              className="dep-input"
              inputMode="decimal"
              placeholder="Deposit amount must be greater than 0.1USDT"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>

          <div className="dep-meta">
            <div className="dep-meta-row">
              <span>Estimated payment：</span>
              <strong>USDT</strong>
            </div>
            <div className="dep-hint">Reference rate: 1 USDT ≈ 1 USDT</div>
            <p className="dep-note">
              The payment amount and exchange rate are subject to the actual payment
            </p>
          </div>
        </section>

        <button
          type="button"
          className={`dep-btn ${valid ? "is-ready" : ""}`}
          disabled={!valid}
          onClick={gotoConfirm}
        >
          Deposit now
        </button>
      </main>
    </div>
  );
}
