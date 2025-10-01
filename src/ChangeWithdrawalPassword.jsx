// src/ChangeWithdrawalPassword.jsx
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wdChangePassword, wdSetPassword } from "./api";

export default function ChangeWithdrawalPassword() {
  const nav = useNavigate();

  // form state
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // visibility
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ---- HARD FOCUS-LOCK ----
  const refOld = useRef(null);
  const refNew = useRef(null);
  const refConf = useRef(null);
  const keepFocus = (ref, value) => {
    // next tick so re-render ke baad chale
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus({ preventScroll: true });
      try {
        const caret = typeof value === "string" ? value.length : ref.current.value.length;
        ref.current.setSelectionRange(caret, caret);
      } catch {}
    });
  };

  // centered toast
  const [toast, setToast] = useState({ open: false, kind: "success", text: "" });
  function showToast(kind, text, ms = 1600, after) {
    setToast({ open: true, kind, text });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      setToast((t) => ({ ...t, open: false }));
      after && after();
    }, ms);
  }

  const okLen = newPwd.length >= 6;
  const okMatch = newPwd === confirm && confirm.length > 0;
  const canSubmit = !!newPwd && !!confirm && okLen && okMatch && !busy;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    const userId = String(localStorage.getItem("uid") || "").trim();
    if (!userId) {
      showToast("error", "User ID missing. Please login again.");
      return nav("/login", { replace: true });
    }

    try {
      setBusy(true);
      // try change first
      await wdChangePassword(userId, oldPwd, newPwd);
      showToast("success", "Withdrawal password changed successfully.", 1400, () => nav(-1));
    } catch (err) {
      const msg = String(err?.message || "");
      const notSet = /not\s*set\s*yet/i.test(msg) || err?.status === 409;
      if (notSet || !oldPwd) {
        try {
          await wdSetPassword(userId, newPwd);
          showToast("success", "Withdrawal password set successfully.", 1400, () => nav(-1));
        } catch (e2) {
          showToast("error", e2?.message || "Failed to set withdrawal password.");
        }
      } else {
        showToast("error", msg || "Failed to change withdrawal password.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Eye button that never steals focus
  const Eye = ({ onClick }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label="Toggle visibility"
      style={{
        position: "absolute",
        right: 6,
        top: "50%",
        transform: "translateY(-50%)",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="#64748b" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.5" fill="none" stroke="#475569" strokeWidth="1.6" />
      </svg>
    </button>
  );

  const Field = ({
    label,
    typeIsText,
    onToggle,
    value,
    onChange,
    placeholder,
    inputRef,
    autoComplete = "new-password",
  }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#0f172a", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type={typeIsText ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={busy}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            height: 48,
            lineHeight: "48px",
            padding: "0 48px 0 16px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            outline: "none",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,.02)",
          }}
          required
        />
        <Eye onClick={onToggle} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          type="button"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            border: "1px solid #eef0f4",
            background: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
          Change Withdrawal Password
        </h1>
        <div style={{ flex: 1 }} />
      </div>

      {/* Card */}
      <form
        onSubmit={onSubmit}
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 16,
          padding: 22,
          marginTop: 0,
          boxShadow: "0 14px 30px rgba(16,24,40,.12), 0 2px 8px rgba(16,24,40,.06)",
        }}
      >
        <Field
          label="Old Password"
          typeIsText={showOld}
          onToggle={() => setShowOld((s) => !s)}
          value={oldPwd}
          onChange={(e) => {
            const v = e.target.value;
            setOldPwd(v);
            keepFocus(refOld, v);
          }}
          placeholder="Enter old password (leave blank if first time)"
          inputRef={refOld}
          autoComplete="current-password"
        />

        <Field
          label="New Password"
          typeIsText={showNew}
          onToggle={() => setShowNew((s) => !s)}
          value={newPwd}
          onChange={(e) => {
            const v = e.target.value;
            setNewPwd(v);
            keepFocus(refNew, v);
          }}
          placeholder="Enter new password"
          inputRef={refNew}
        />

        <Field
          label="Confirm New Password"
          typeIsText={showConfirm}
          onToggle={() => setShowConfirm((s) => !s)}
          value={confirm}
          onChange={(e) => {
            const v = e.target.value;
            setConfirm(v);
            keepFocus(refConf, v);
          }}
          placeholder="Re-enter new password"
          inputRef={refConf}
        />

        {/* hints */}
        <div style={{ margin: "6px 0 12px 0" }}>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ color: okLen ? "#16a34a" : "#dc2626", fontSize: 14, lineHeight: "20px" }}>
              At least 6 characters
            </li>
            <li style={{ color: okMatch ? "#16a34a" : "#dc2626", fontSize: 14, lineHeight: "20px" }}>
              Both passwords match
            </li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            fontWeight: 700,
            color: "#fff",
            background: canSubmit
              ? "linear-gradient(90deg,#7aa2ff,#aa7bff)"
              : "linear-gradient(90deg,#e8ecff,#eee6ff)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            border: "1px solid rgba(99,102,241,.15)",
          }}
        >
          {busy ? "Saving..." : "Change Password"}
        </button>

        {!canSubmit && (
          <div style={{ marginTop: 8, color: "#ef4444", fontSize: 13 }}>Fill all fields</div>
        )}
      </form>

      {/* Centered Toast */}
      {toast.open && (
        <div
          role="alert"
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              minWidth: 280,
              maxWidth: "90vw",
              padding: "14px 16px",
              borderRadius: 16,
              background: "#fff",
              border: "1px solid #eef0f4",
              boxShadow: "0 18px 40px rgba(0,0,0,.15)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "auto",
            }}
          >
            {toast.kind === "success" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#16a34a" opacity=".15" />
                <path d="M7 12.5l3 3 7-7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" opacity=".15" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            <div style={{ fontWeight: 600, color: toast.kind === "success" ? "#065f46" : "#7f1d1d" }}>
              {toast.text || (toast.kind === "success" ? "Success" : "Failed")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
