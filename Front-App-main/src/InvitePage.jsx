// src/InvitePage.jsx
import React, { useMemo, useState } from "react";

export default function InvitePage() {
  const [copied, setCopied] = useState(false);

  // Invite code: current user se lo; fallback = "120236"
  const rawUser = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  })();
  const inviteCode =
    rawUser?.user?.inviteCode ||
    rawUser?.inviteCode ||
    localStorage.getItem("inviteCode") ||
    "120236";

  // ✅ Share link: fixed host + param name `invite`
  const SHARE_BASE = "https://www.dhwin.app";
  const shareLink = useMemo(
    () => `${SHARE_BASE.replace(/\/$/, "")}/register?invite=${encodeURIComponent(inviteCode)}`,
    [inviteCode]
  );

  // QR uses the same shareLink
  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        shareLink
      )}`,
    [shareLink]
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert("Copy failed");
    }
  }

  return (
    <div className="page" style={{ background: "#f6f7fb", minHeight: "100%" }}>
      {/* topbar */}
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

        <h1>Invite friends</h1>
        <div style={{ width: 36 }} />
      </header>

      <main style={{ padding: 16 }}>
        <div
          style={{
            maxWidth: 520,
            margin: "10px auto",
            background: "#fff",
            border: "1px solid #e9ecf2",
            borderRadius: 16,
            padding: "24px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>My invitation code</div>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
            {inviteCode}
          </div>

          <div style={{ display: "grid", placeItems: "center", margin: "10px 0 4px" }}>
            <img
              src={qrUrl}
              alt="Invite QR"
              width={200}
              height={200}
              style={{ borderRadius: 8, background: "#fff", padding: 8, border: "1px solid #eef1f5" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#f97316", marginBottom: 16 }}>
            Long press to save the QR code
          </div>

          {/* Share link card */}
          <div
            style={{
              textAlign: "left",
              background: "#f8fafc",
              border: "1px solid #e9ecf2",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>Share link</div>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  fontSize: 13,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  padding: "6px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "#fff",
                border: "1px solid #e9ecf2",
                borderRadius: 8,
                fontSize: 13,
                wordBreak: "break-all",
              }}
            >
              {shareLink}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
