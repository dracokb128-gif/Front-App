// src/ChangeLoginPassword.jsx
import React, { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { userChangePassword } from "./api";

export default function ChangeLoginPassword() {
  const nav = useNavigate();

  const [oldPwd, setOldPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- refs for stable focus ----
  const oldRef = useRef(null);
  const newRef = useRef(null);
  const confirmRef = useRef(null);

  // toast state
  const toastTimer = useRef(null);
  const [toast, setToast] = useState({ show: false, type: "ok", msg: "" });
  const showToast = (msg, type = "ok") => {
    setToast({ show: true, type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ show: false, type, msg: "" }), 1800);
  };

  // onChange helper: value set + focus preserve
  const keepFocus =
    (ref, setter) =>
    (e) => {
      const val = e.target.value;
      setter(val);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          const pos = el.value.length;
          el.focus({ preventScroll: true });
          try { el.setSelectionRange(pos, pos); } catch {}
        }
      });
    };

  const rules = { len: pwd.length >= 6, match: pwd === confirm && confirm.length > 0 };

  const validation = useMemo(() => {
    if (!oldPwd || !pwd || !confirm) return { ok: false, msg: "Fill all fields" };
    if (!rules.len) return { ok: false, msg: "New password must be 6+ characters" };
    if (!rules.match) return { ok: false, msg: "Passwords do not match" };
    return { ok: true, msg: "Looks good" };
  }, [oldPwd, pwd, confirm, rules.len, rules.match]);

  const submit = async (e) => {
    e.preventDefault();
    if (!validation.ok || saving) return;
    const userId = Number(localStorage.getItem("uid") || 0) || undefined;
    const username = localStorage.getItem("username") || undefined;

    setSaving(true);
    try {
      const res = await userChangePassword({ userId, username, oldPassword: oldPwd, newPassword: pwd });
      if (res?.ok) {
        showToast("Password updated successfully.", "ok");
        setOldPwd(""); setPwd(""); setConfirm("");
      } else {
        showToast(res?.message || "Old password incorrect", "err");
      }
    } catch (err) {
      showToast(err?.message || "Request failed", "err");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder, type, onToggle, shown, inputRef, autoComplete }) => (
    <div className="clp-field">
      <label className="clp-label">{label}</label>
      <div className="clp-input-wrap">
        <input
          ref={inputRef}
          className="clp-input"
          type={shown ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="clp-eye"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggle}
          aria-label="Toggle visibility"
          tabIndex={-1}
        >
          {shown ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 3l18 18" stroke="#64748b" strokeWidth="1.8" />
              <path d="M10.6 10.7a3 3 0 0 0 3.7 3.7" stroke="#64748b" strokeWidth="1.8" />
              <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6c-2.1 0-3.9-.7-5.3-1.7" stroke="#64748b" strokeWidth="1.8" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="#64748b" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="3" stroke="#64748b" strokeWidth="1.8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="clp-page">
      <div className="clp-topbar">
        <button className="clp-back" onClick={() => nav(-1)} aria-label="Back">‹</button>
        <h1 className="clp-title">Change Login Password</h1>
      </div>

      <form onSubmit={submit} className="clp-card">
        <Field
          label="Old Password"
          value={oldPwd}
          onChange={keepFocus(oldRef, setOldPwd)}
          placeholder="Enter old password"
          type="password"
          shown={showOld}
          onToggle={() => setShowOld((s) => !s)}
          inputRef={oldRef}
          autoComplete="current-password"
        />
        <Field
          label="New Password"
          value={pwd}
          onChange={keepFocus(newRef, setPwd)}
          placeholder="Enter new password"
          type="password"
          shown={showNew}
          onToggle={() => setShowNew((s) => !s)}
          inputRef={newRef}
          autoComplete="new-password"
        />
        <Field
          label="Confirm New Password"
          value={confirm}
          onChange={keepFocus(confirmRef, setConfirm)}
          placeholder="Re-enter new password"
          type="password"
          shown={showConfirm}
          onToggle={() => setShowConfirm((s) => !s)}
          inputRef={confirmRef}
          autoComplete="new-password"
        />

        <ul className="clp-req">
          <li className={rules.len ? "ok" : ""}>At least 6 characters</li>
          <li className={rules.match ? "ok" : ""}>Both passwords match</li>
        </ul>

        <button
          type="submit"
          disabled={!validation.ok || saving}
          className={`clp-btn ${validation.ok && !saving ? "" : "is-disabled"}`}
        >
          {saving ? "Saving..." : "Change Password"}
        </button>

        <p className={`clp-msg ${validation.ok ? "ok" : "err"}`}>{validation.msg}</p>
      </form>

      {/* Toast via PORTAL with inline styles to FORCE center */}
      {toast.show &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 250,
              display: "flex",
              justifyContent: "center",
              zIndex: 2147483647,
              pointerEvents: "none",
            }}
          >
            <div
              className={`clp-toast ${toast.type}`}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 13,
                boxShadow: "0 8px 30px rgba(2,6,23,.08)",
                maxWidth: "calc(100vw - 32px)",
              }}
            >
              {toast.type === "ok" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="2" />
                  <path d="M12 7v6M12 16v1" stroke="#ef4444" strokeWidth="2" />
                </svg>
              )}
              <span>{toast.msg}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
