// src/TeamsComingSoon.jsx
import React from "react";
import { FiUsers, FiClock } from "react-icons/fi";

export default function TeamsComingSoon() {
  return (
    <div className="page" style={{ background: "#f6f7fb", minHeight: "100%" }}>
      {/* Topbar (same style as records/deposit pages) */}
      <header className="dep-topbar" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <button
          className="dep-back dep-back--tint"
          type="button"
          onClick={() => window.history.back()}
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

        <h1>Teams</h1>
        <div style={{ width: 36 }} />
      </header>

      {/* Body */}
      <main style={{ padding: 16 }}>
        <div
          style={{
            maxWidth: 520,
            margin: "20px auto",
            background: "#fff",
            border: "1px solid #e9ecf2",
            borderRadius: 16,
            padding: "28px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>
            <FiUsers style={{ verticalAlign: "middle", opacity: 0.9 }} />
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 0.3,
              backgroundImage: "linear-gradient(90deg,#4f46e5,#06b6d4)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 8,
            }}
          >
            Coming Soon
          </div>

          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>
            We’re building the Teams area for you.
          </div>

          <div
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: "#475569",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <FiClock />
            <span>Stay tuned!</span>
          </div>
        </div>
      </main>
    </div>
  );
}
