// src/RegistrationPage.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { FiUser, FiLock, FiKey, FiShield } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
// 👇 default import (API object)
import API from "./api";

/* ---------- Flags helpers (FlagCDN) ---------- */
const flagURL = (cc) => `https://flagcdn.com/24x18/${cc}.png`;
const flag2x = (cc) => `https://flagcdn.com/48x36/${cc}.png`;

/* ---------- Language list ---------- */
const LANGS = [
  { code: "en", country: "us", label: "English" },
  { code: "ar", country: "sa", label: "Arabic" },
  { code: "fa", country: "ir", label: "Persian" },
  { code: "tr", country: "tr", label: "Turkish" },
  { code: "fr", country: "fr", label: "French" },
  { code: "de", country: "de", label: "German" },
];

/* ---------- SVG Captcha ---------- */
function Captcha({ value, onRefresh }) {
  const glyphs = useMemo(
    () =>
      value.split("").map((d, i) => ({
        d,
        x: 20 + i * 20,
        rot: Math.random() * 26 - 13,
        dy: Math.random() * 6 - 3,
        scale: 0.96 + Math.random() * 0.08,
      })),
    [value]
  );

  const squiggle = useMemo(() => {
    const W = 110;
    const y1 = 8 + Math.random() * 10;
    const y2 = 20 + Math.random() * 10;
    const y3 = 10 + Math.random() * 20;
    return `M0,${y1} Q ${W * 0.33},${y2} ${W * 0.66},${y3} T ${W},${20 + Math.random() * 10}`;
  }, [value]);

  return (
    <button type="button" className="captcha-wrap" onClick={onRefresh} title="Tap to refresh">
      <svg viewBox="0 0 110 40" width="110" height="40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cg" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f2f4ff" />
            <stop offset="1" stopColor="#eef2ff" />
          </linearGradient>
          <filter id="fblur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.15" />
          </filter>
        </defs>
        <rect x="0" y="0" width="110" height="40" rx="8" fill="url(#cg)" />
        <g opacity="0.35" stroke="#dbe3ff" strokeWidth="1" filter="url(#fblur)">
          <path d="M-5 32 L 25 -5" />
          <path d="M15 45 L 55 -5" />
          <path d="M40 45 L 80 -5" />
          <path d="M65 45 L105 -5" />
        </g>
        <path d={squiggle} fill="none" stroke="#b7c3ff" strokeWidth="1.2" opacity="0.55" />
        <g
          fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          fontWeight="700"
          fontSize="18"
          fill="#1f2937"
        >
          {glyphs.map((g, i) => (
            <g key={i} transform={`translate(${g.x} ${22 + g.dy}) rotate(${g.rot}) scale(${g.scale})`}>
              <text textAnchor="middle">{g.d}</text>
            </g>
          ))}
        </g>
      </svg>
    </button>
  );
}

export default function RegistrationPage() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [invite, setInvite] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const makeCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const [captcha, setCaptcha] = useState(makeCode);
  const refreshCaptcha = () => { setCaptcha(makeCode()); setCodeInput(""); };

  const [lang, setLang] = useState(LANGS[0]);
  const [openLang, setOpenLang] = useState(false);
  const langRef = useRef(null);

  const [banner, setBanner] = useState(null);
  const timerRef = useRef(null);
  const show = (type, text, autoCloseMs = 3500) => {
    setBanner({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoCloseMs) timerRef.current = setTimeout(() => setBanner(null), autoCloseMs);
  };
  const showError = (t) => show("error", t);

  useEffect(() => {
    const onDoc = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setOpenLang(false); };
    const onKey = (e) => e.key === "Escape" && setOpenLang(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const [busy, setBusy] = useState(false);

  /* =====================  ADDED: auto-fill invite from URL/localStorage  ===================== */
  useEffect(() => {
    // support multiple param names + HashRouter
    const NAMES = ["invite", "inviteCode", "code", "ref", "r", "i"];
    let found = "";

    try {
      const url = new URL(window.location.href);
      for (const k of NAMES) { found = found || url.searchParams.get(k); }

      // if using #/register?invite=... (hash router)
      if (!found && url.hash) {
        const qIndex = url.hash.indexOf("?");
        if (qIndex >= 0) {
          const sp = new URLSearchParams(url.hash.slice(qIndex + 1));
          for (const k of NAMES) { found = found || sp.get(k); }
        }
      }
    } catch {}

    found = (found || "").trim();

    // fallback to stored value (if user came from invite link before)
    if (!found) {
      try {
        found =
          (localStorage.getItem("inviteCode") ||
            localStorage.getItem("invite") ||
            localStorage.getItem("ref")) || "";
        found = found.trim();
      } catch {}
    }

    if (found) {
      setInvite(found);
      try {
        localStorage.setItem("inviteCode", found);
        localStorage.setItem("invite", found);
        localStorage.setItem("ref", found);
      } catch {}
    }
  }, []);
  /* =========================================================================================== */

  const reUser = /^[A-Za-z0-9]{6,16}$/;
  const rePass = /^[A-Za-z0-9]{6,16}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fields = { username, password, confirm, invite, codeInput };
    for (const [k, v] of Object.entries(fields)) {
      if (!String(v ?? "").trim()) {
        const map = { invite: "invitation code", codeInput: "verification code" };
        const nice = map[k] || k;
        showError(`Please fill ${nice}.`);
        return;
      }
    }

    if (!reUser.test(username)) return showError("Username must be 6–16 letters or numbers.");
    if (!rePass.test(password)) return showError("Password must be 6–16 alphanumeric.");
    if (password !== confirm) return showError("Passwords do not match.");
    if (codeInput.trim() !== captcha.trim()) { showError("Captcha is invalid or expired."); refreshCaptcha(); return; }

    try {
      setBusy(true);

      // ✅ default-exported API object se function uthao
      const apiRegister = API.register || API.signup || API.createUser;
      if (!apiRegister) throw new Error("Register API missing");

      await apiRegister({ username: username.trim(), password, inviteCode: invite.trim() });

      show("success", "Account created! Redirecting to Login…", 1000);
      setTimeout(() => nav("/login", { replace: true }), 1200);
    } catch (err) {
      showError(err?.message || "Registration failed. Try again.");
      refreshCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const S = {
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 34,
      padding: "0 12px",
      background: "#fff",
      border: "1px solid #e8ecf5",
      borderRadius: 12,
      color: "#0f172a",
      fontWeight: 600,
      boxShadow: "0 6px 14px rgba(15,23,42,.08)",
    },
    flagSm: { width: 18, height: 18, borderRadius: 3, display: "block" },
    menuBox: { padding: 2, borderRadius: 10, zIndex: 1001 },
    inner: {
      listStyle: "none",
      margin: 0,
      padding: 6,
      background: "#fff",
      border: "1px solid #e8ecf5",
      borderRadius: 10,
      display: "inline-flex",
      flexDirection: "column",
      gap: 6,
      width: "max-content",
      whiteSpace: "nowrap",
      boxShadow: "0 8px 18px rgba(15,23,42,.08)",
    },
    item: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 28,
      padding: "0 10px",
      fontSize: 13,
      fontWeight: 700,
      color: "#0f172a",
      background: "transparent",
      border: 0,
      borderRadius: 8,
      cursor: "pointer",
      width: "auto",
      lineHeight: 1,
    },
    itemHover: { background: "#f5f7fb" },
    flag: { width: 16, height: 16, borderRadius: 3, display: "block" },
    code: { fontSize: 13, fontWeight: 700 },
  };
  const [hi, setHi] = useState(-1);

  return (
    <div className="login-page">
      {banner && (
        <div className={`alert-banner ${banner.type}`}>
          <span>{banner.text}</span>
          <button className="alert-close" onClick={() => setBanner(null)} aria-label="Close">
            ×
          </button>
        </div>
      )}

      <div className="login-shell">
        <div className="login-top">
          <div className="lang-wrap" ref={langRef} style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="lang-chip"
              style={S.chip}
              onClick={() => setOpenLang((o) => !o)}
              aria-expanded={openLang}
              aria-label="Select language"
            >
              <img
                className="flag-img"
                src={flagURL(lang.country)}
                srcSet={`${flag2x(lang.country)} 2x`}
                alt=""
                width={18}
                height={18}
                style={S.flagSm}
                loading="lazy"
              />
              <span className="lang-pill-label">{lang.label}</span>
              <span className="dd" style={{ marginLeft: 6 }}>▾</span>
            </button>

            {openLang && (
              <div className="lang-menu" style={S.menuBox}>
                <div style={S.inner} role="listbox" aria-label="Languages">
                  {LANGS.map((l, i) => (
                    <button
                      key={l.code}
                      type="button"
                      role="option"
                      aria-selected={l.code === lang.code}
                      onClick={() => { setLang(l); setOpenLang(false); }}
                      onMouseEnter={() => setHi(i)}
                      onMouseLeave={() => setHi(-1)}
                      style={{ ...S.item, ...(hi === i ? S.itemHover : null) }}
                    >
                      <img src={flagURL(l.country)} srcSet={`${flag2x(l.country)} 2x`} alt="" style={S.flag} />
                      <span style={S.code}>{l.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-title">Registration</div>

          <label className="inp-row">
            <FiUser className="inp-ico" />
            <input
              className="inp"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="6–16 letters or numbers"
              maxLength={16}
              autoComplete="username"
              disabled={busy}
            />
          </label>

          <label className="inp-row">
            <FiLock className="inp-ico" />
            <input
              className="inp"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6–16 alphanumeric password"
              maxLength={16}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>

          <label className="inp-row">
            <FiLock className="inp-ico" />
            <input
              className="inp"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Please enter the password again"
              maxLength={16}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>

          <label className="inp-row">
            <FiKey className="inp-ico" />
            <input
              className="inp"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Invitation code (required)"
              maxLength={24}
              disabled={busy}
            />
          </label>

          <div className="code-row">
            <label className="inp-row code-input">
              <FiShield className="inp-ico" />
              <input
                className="inp"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Verification Code"
                inputMode="numeric"
                maxLength={4}
                disabled={busy}
              />
            </label>
            <Captcha value={captcha} onRefresh={refreshCaptcha} />
          </div>

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? "Please wait…" : "Register"}
          </button>

          <button type="button" className="auth-link" onClick={() => nav("/login")} disabled={busy}>
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
