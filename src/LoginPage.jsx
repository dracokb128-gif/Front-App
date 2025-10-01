// src/LoginPage.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { FiUser, FiLock, FiShield } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { login as authLogin } from "./auth";
import { loginApi as apiLogin } from "./api";

// 🔧 Horizontal nudge (px) for the CARD ONLY.
// Negative = left, Positive = right.
const OFFSET_X = -6; // adjust to taste

const flagURL = (cc) => `https://flagcdn.com/24x18/${cc}.png`;
const flag2x  = (cc) => `https://flagcdn.com/48x36/${cc}.png`;
const LANGS = [
  { code: "en", country: "us", label: "English" },
  { code: "ar", country: "sa", label: "Arabic" },
  { code: "fa", country: "ir", label: "Persian" },
  { code: "tr", country: "tr", label: "Turkish" },
  { code: "fr", country: "fr", label: "French" },
  { code: "de", country: "de", label: "German" },
];

function Captcha({ value, onRefresh }) {
  const glyphs = useMemo(
    () => value.split("").map((d, i) => ({
      d, x: 20 + i * 20,
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
          <filter id="fblur" x="-10%" y="-10%" width="120%">
            <feGaussianBlur stdDeviation="0.15" />
          </filter>
        </defs>
        <rect x="0" y="0" width="110" height="40" rx="8" fill="url(#cg)" />
        <g opacity="0.35" stroke="#dbe3ff" strokeWidth="1" filter="url(#fblur)">
          <path d="M-5 32 L 25 -5" /><path d="M15 45 L 55 -5" />
          <path d="M40 45 L 80 -5" /><path d="M65 45 L105 -5" />
        </g>
        <path d={squiggle} fill="none" stroke="#b7c3ff" strokeWidth="1.2" opacity="0.55" />
        <g fontFamily="Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
           fontWeight="700" fontSize="18" fill="#1f2937">
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

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [remember, setRemember] = useState(true);

  const makeCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const [captcha, setCaptcha] = useState(makeCode);
  const refreshCaptcha = () => { setCaptcha(makeCode()); setCodeInput(""); };

  const [lang, setLang] = useState(LANGS[0]);
  const [openLang, setOpenLang] = useState(false);
  const langRef = useRef(null);

  const [banner, setBanner] = useState(null);
  const timerRef = useRef(null);
  const showBanner = (type, text, ms = 3500) => {
    setBanner({ type, text });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (ms) timerRef.current = setTimeout(() => setBanner(null), ms);
  };
  const showError = (t) => showBanner("error", t);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const uname = String(username).trim();
    const pwd   = String(password).trim();
    if (!uname || !pwd) { showError("Please fill username and password."); return; }

    const devMode = !process.env.NODE_ENV || process.env.NODE_ENV !== "production";
    if (!devMode) {
      if (codeInput.trim() !== captcha.trim()) {
        showError("Captcha is invalid or expired."); refreshCaptcha(); return;
      }
    } else {
      if (codeInput && codeInput.trim() !== captcha.trim()) {
        showError("Captcha is invalid."); refreshCaptcha(); return;
      }
    }

    try {
      setBusy(true);
      const resp = await apiLogin({ username: uname, password: pwd });
      const user = resp?.user;
      if (!user || user.id == null) throw new Error("Invalid username or password");

      try {
        localStorage.setItem("uid", String(user.id));
        if (remember) localStorage.setItem("activeUserId", String(user.id));
      } catch {}

      try { authLogin({ username: String(user.username || "") }); } catch {}
      showBanner("success", "Login successful!", 800);

      setTimeout(() => nav("/inside", { replace: true }), 600);
    } catch (err) {
      showError(err?.message || "Invalid username or password");
      refreshCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const S = {
    chip:{display:"inline-flex",alignItems:"center",gap:8,height:34,padding:"0 12px",background:"#fff",
      border:"1px solid #e8ecf5",borderRadius:12,color:"#0f172a",fontWeight:600,boxShadow:"0 6px 14px rgba(15,23,42,.08)"},
    flagSm:{width:18,height:18,borderRadius:3,display:"block"},menuBox:{padding:2,borderRadius:10,zIndex:1001},
    inner:{listStyle:"none",margin:0,padding:6,background:"#fff",border:"1px solid #e8ecf5",borderRadius:10,
      display:"inline-flex",flexDirection:"column",gap:6,width:"max-content",whiteSpace:"nowrap",boxShadow:"0 8px 18px rgba(15,23,42,.08)"},
    item:{display:"flex",alignItems:"center",gap:8,height:28,padding:"0 10px",fontSize:13,fontWeight:700,color:"#0f172a",
      background:"transparent",border:0,borderRadius:8,cursor:"pointer",width:"auto",lineHeight:1},
    itemHover:{background:"#f5f7fb"},flag:{width:16,height:16,borderRadius:3,display:"block"},code:{fontSize:13,fontWeight:700},
  };
  const [hi, setHi] = useState(-1);

  return (
    <div className="login-page">
      {banner && (
        <div className={`alert-banner ${banner.type}`}>
          <span>{banner.text}</span>
          <button className="alert-close" onClick={() => setBanner(null)} aria-label="Close">×</button>
        </div>
      )}

      <div className="login-shell">
        {/* Heading (no horizontal transform so it stays centered) */}
        <div
          className="login-top"
          style={{
            width: "100%",
            maxWidth: 480,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
          }}
        >
          <h1 className="login-hello">Hello, Welcome!</h1>
        </div>

        {/* Language button fixed at top-right (like before) */}
        <div
          className="lang-wrap"
          ref={langRef}
          style={{ position: "fixed", right: 16, top: 16, zIndex: 2000 }}
        >
          <button
            type="button"
            className="lang-chip"
            style={S.chip}
            onClick={() => setOpenLang(o => !o)}
            aria-expanded={openLang}
            aria-label="Select language"
          >
            <img className="flag-img" src={flagURL(lang.country)} srcSet={`${flag2x(lang.country)} 2x`} alt=""
                 width={18} height={18} style={S.flagSm} loading="lazy"/>
            <span className="lang-pill-label">{lang.label}</span>
            <span className="dd" style={{ marginLeft: 6 }}>▾</span>
          </button>

          {openLang && (
            <div className="lang-menu" style={{ ...S.menuBox, position: "absolute", right: 0, top: 40 }}>
              <div style={S.inner} role="listbox" aria-label="Languages">
                {LANGS.map((l,i)=>(
                  <button key={l.code} type="button" role="option" aria-selected={l.code===lang.code}
                    onClick={()=>{ setLang(l); setOpenLang(false); }}
                    onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(-1)}
                    style={{...S.item, ...(hi===i?S.itemHover:null)}}>
                    <img src={flagURL(l.country)} srcSet={`${flag2x(l.country)} 2x`} alt="" style={S.flag}/>
                    <span style={S.code}>{l.code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD nudged horizontally by OFFSET_X */}
        <form
          className="login-card"
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 480,
            margin: "12px auto 0",
            transform: `translateX(${OFFSET_X}px)`,
          }}
        >
          <div className="login-title">Login</div>

          <label className="inp-row">
            <FiUser className="inp-ico" />
            <input className="inp" value={username} onChange={(e)=>setUsername(e.target.value)}
              placeholder="6–16 letters or numbers" maxLength={16} autoComplete="username" disabled={busy}/>
          </label>

          <label className="inp-row">
            <FiLock className="inp-ico" />
            <input className="inp" type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
              placeholder="6–16 alphanumeric password" maxLength={16} autoComplete="current-password" disabled={busy}/>
          </label>

          <div className="code-row">
            <label className="inp-row code-input">
              <FiShield className="inp-ico" />
              <input className="inp" value={codeInput} onChange={(e)=>setCodeInput(e.target.value)}
                placeholder="Verification Code" inputMode="numeric" maxLength={4} disabled={busy}/>
            </label>
            <Captcha value={captcha} onRefresh={refreshCaptcha} />
          </div>

          <label className="remember">
            <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} disabled={busy}/>
            <span>Remember password</span>
          </label>

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? "Please wait…" : "Login"}
          </button>

          <button type="button" className="auth-link" onClick={()=>nav("/register")} disabled={busy}>
            Registration
          </button>
        </form>
      </div>
    </div>
  );
}
