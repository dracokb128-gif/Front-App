// src/WithdrawalPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { getProgress, getWalletAddress, wdVerify, submitWithdrawal } from "./api";

const ICON_URL  = "https://cdn-icons-png.flaticon.com/512/11782/11782308.png";
const WALLET_IMG = "https://atlas-content-cdn.pixelsquid.com/stock-images/cartoon-crypto-wallet-w78xVP5-600.jpg";

/* ------------ helpers ------------ */
function getCurrentUserId() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const nested = u?.user?.id ?? u?.userId ?? u?.uid ?? u?.id;
      if (nested) return String(nested);
    }
  } catch {}
  try {
    const x =
      localStorage.getItem("userId") ||
      localStorage.getItem("uid") ||
      localStorage.getItem("userid") ||
      "";
    if (x) return String(x);
  } catch {}
  return "";
}

/** STRICT per-user wallet only */
function readLocalWalletStrict(uid) {
  try {
    const id = String(uid || "").replace(/^u/i, "");
    const perUser = JSON.parse(localStorage.getItem(`user_wallet:${id}`) || "{}");
    if (perUser?.address) return perUser.address;
    const keyed = localStorage.getItem(`wallet:trc20:${id}`);
    if (keyed) return keyed;
    return "";
  } catch { return ""; }
}

function readLocalBalance() {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const b = u?.user?.balance ?? u?.balance;
      if (b != null) return Number(b) || 0;
    }
  } catch {}
  try {
    const b =
      localStorage.getItem("balance") ||
      localStorage.getItem("user_balance") ||
      "";
    if (b) return Number(b) || 0;
  } catch {}
  return 0;
}

/* ------------ Toast ------------ */
// Replace your Toast with this one
function Toast({ open, type = "success", message = "" }) {
  if (!open) return null;
  const bg = type === "success" ? "#22c55e" : "#369e2de5";
  return (
    <div
      style={{
        position: "fixed",
        top: "34%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-block",
          maxWidth: 280,            // <- wrap limit
          padding: "9px 12px",
          background: bg,
          color: "#fff",
          borderRadius: 10,
          fontSize: 15,
          lineHeight: 1.35,
          textAlign: "center",
          whiteSpace: "normal",     // <- allow wrapping
          overflowWrap: "anywhere", // <- wrap long words
          wordBreak: "break-word",  // <- safety
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
        }}
      >
        {String(message)}
      </div>
    </div>
  );
}


/* -------------- main component -------------- */
export default function WithdrawalPage({ onBack }) {
  const [userId, setUserId] = useState(getCurrentUserId());
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const [walletAddr, setWalletAddr] = useState("");
  const [network] = useState("TRC-20");
  const [amount, setAmount] = useState("");
  const [pwd, setPwd] = useState("");

  const [balance, setBalance] = useState(readLocalBalance());
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState({ open:false, type:"success", msg:"" });
  useEffect(() => {
    if (!toast.open) return;
    const t = setTimeout(() => setToast(s => ({ ...s, open:false })), 9500);
    return () => clearTimeout(t);
  }, [toast.open]);

  const hydrateRef = useRef(null);

  useEffect(() => {
    let stop = false;

    const waitForUserId = async () => {
      let uid = getCurrentUserId();
      for (let i = 0; i < 30 && !uid; i++) {
        await new Promise(r => setTimeout(r, 100));
        uid = getCurrentUserId();
      }
      return uid || "";
    };

    const hydrate = async () => {
      setLoading(true);
      try {
        let uid = userIdRef.current || (await waitForUserId());
        if (uid && uid !== userIdRef.current) setUserId(uid);
        if (!uid) { setLoading(false); return; }

        // 1) instant local wallet (strict)
        setWalletAddr(readLocalWalletStrict(uid));

        // 2) server wallet (overwrite if found)
        try {
          const g = await getWalletAddress(uid);
          if (!stop && g && g.address) setWalletAddr(g.address);
        } catch (e) {
          console.warn("wallet fetch fail:", e?.message || e);
        }

        // 3) progress (authoritative balance)
        try {
          const p = await getProgress(uid);
          if (!stop && p) {
            setBalance(Number(p.balance || 0));
            setCompletedToday(Number(p.completedToday || 0));
            try {
              const raw = localStorage.getItem("user");
              if (raw) {
                const u = JSON.parse(raw);
                if (u?.user) u.user.balance = Number(p.balance || 0);
                else u.balance = Number(p.balance || 0);
                localStorage.setItem("user", JSON.stringify(u));
              }
            } catch {}
          }
        } catch (e) {
          console.warn("progress fail:", e?.message || e);
          setBalance(b => (Number.isFinite(b) ? b : readLocalBalance()));
        }
      } finally {
        if (!stop) setLoading(false);
      }
    };

    hydrateRef.current = hydrate;
    hydrate();

    const onWalletChange = () => hydrateRef.current && hydrateRef.current();
    window.addEventListener("wd:wallet-change", onWalletChange);

    const onFocus = () => hydrateRef.current && hydrateRef.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stop = true;
      window.removeEventListener("wd:wallet-change", onWalletChange);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const maxAvail = useMemo(() => Math.max(0, Math.floor(Number(balance || 0))), [balance]);
  const num = useMemo(() => Number(amount || 0), [amount]);
  const amountOk = Number.isFinite(num) && num >= 20 && num <= maxAvail;

  // rule: 0 or 25+
  const allowByTasks = useMemo(() => completedToday === 0 || completedToday >= 25, [completedToday]);

  const hasWallet = !!walletAddr;
  const pwdOk = pwd.trim().length > 0;
  const formReady = !!userIdRef.current && hasWallet && amountOk && pwdOk && !loading;

  const fillMax = () => setAmount(String(maxAvail));

  async function submit() {
    const uid = userIdRef.current;
    if (!uid) { setToast({ open:true, type:"error", msg:"Login again" }); return; }
    if (!allowByTasks) { setToast({ open:true, type:"error", msg:"First Complete 25 Tasks" }); return; }
    if (!formReady) return;

    // verify password client->server (single time)
    try {
      await wdVerify(uid, pwd);
    } catch (e) {
      setToast({ open:true, type:"error", msg:"Wrong withdrawal password" });
      return;
    }

    try {
      const resp = await submitWithdrawal(uid, num, pwd, walletAddr, network);
      if (resp?.newBalance != null) {
        setBalance(Number(resp.newBalance));
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            const u = JSON.parse(raw);
            if (u?.user) u.user.balance = Number(resp.newBalance);
            else u.balance = Number(resp.newBalance);
            localStorage.setItem("user", JSON.stringify(u));
          }
        } catch {}
      }
      // local soft receipt
      try {
        const prev = JSON.parse(localStorage.getItem("wd_local_receipts") || "[]");
        prev.unshift({ at: Date.now(), userId: uid, amount: num, address: walletAddr, network, status: "PENDING" });
        localStorage.setItem("wd_local_receipts", JSON.stringify(prev.slice(0, 20)));
      } catch {}
      setToast({ open:true, type:"success", msg:"Success" });
      setAmount(""); setPwd("");
    } catch (e) {
      const msg =
        e?.code === "TASKS_INCOMPLETE" ? "First Complete 25 Tasks" :
        (e?.message || (e?.status === 404 ? "Withdraw endpoint not found on server" : "Withdrawal failed"));
      setToast({ open:true, type:"error", msg });
    }
  }

  return (
    <div className="wdr-wrap">
      <Toast open={toast.open} type={toast.type} message={toast.msg} />

      <header className="wdr-topbar">
        <button
          className="wdr-back wdr-back--tint"
          type="button"
          onClick={onBack ?? (() => window.history.back())}
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="wdr-back-ico" aria-hidden="true">
            <defs>
              <linearGradient id="wdrGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff5f6d" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path d="M15 18l-6-6 6-6" fill="none" stroke="url(#wdrGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        </button>
        <h1>Withdrawal</h1>
        <div style={{ width: 36 }} />
      </header>

      <main className="wdr-main">
        <section className="wdr-section">
          <div className="wdr-tile wdr-selected">
            <div className="wdr-coin">
              <img src={ICON_URL} alt="Virtual currency" className="wdr-coin-img" />
            </div>
            <div className="wdr-txt">Virtual Currency</div>
          </div>
        </section>

        <section className="wdr-card">
          <div className="wdr-block">
            <h3 className="wdr-label">Wallet</h3>
            <div className="wdr-wallet-row">
              <div className="wdr-wallet-left">
                <img src={WALLET_IMG} alt="Wallet" className="wdr-wallet-icon" />
                <div className="wdr-wallet-name">{hasWallet ? walletAddr : "Not set"}</div>
              </div>
              {hasWallet && <FiCheckCircle className="wdr-checked" size={20} />}
            </div>
            {!hasWallet && (
              <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>
                Please set your TRC-20 wallet first
              </div>
            )}
          </div>

          <div className="wdr-sep" />

          <div className="wdr-block">
            <div className="wdr-amount-head">
              <span className="wdr-label">USDT</span>
              <button type="button" className="wdr-max" onClick={fillMax}>Maximum amount</button>
            </div>
            <div className="wdr-amount">
              <div className="wdr-unit">USDT</div>
              <input
                className="wdr-input-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              Minimum 20 USDT • Max {maxAvail} USDT
            </div>
          </div>

          <div className="wdr-sep" />

          <div className="wdr-block">
            <h3 className="wdr-label">Withdrawal password</h3>
            <input
              className="wdr-input"
              type="password"
              placeholder="Please enter your password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>
        </section>

        <button
          type="button"
          className={`wdr-btn ${formReady ? "is-ready" : ""}`}
          disabled={!formReady}
          onClick={submit}
        >
          OK
        </button>
      </main>
    </div>
  );
}
