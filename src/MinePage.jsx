// src/MinePage.js
import React, { useEffect, useState } from "react";
import { getUsers, patchBalance } from "./api";
import { useNavigate, Link } from "react-router-dom";

const CURRENT_USER_FALLBACK = Number(localStorage.getItem("uid") || 1);

export default function MinePage() {
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshUser() {
    try {
      const users = await getUsers();
      const uid = Number(localStorage.getItem("uid") || CURRENT_USER_FALLBACK);
      const found = users.find((u) => u.id === uid) || users[0] || null;
      if (found && !localStorage.getItem("uid")) {
        localStorage.setItem("uid", String(found.id));
      }
      setMe(found);
    } catch (e) {
      console.error(e);
      alert("User load nahi ho raha");
    }
  }

  function goDeposit() {
    nav("/deposit");
  }

  async function handleWithdraw() {
    if (!me) return alert("User missing");
    const input = prompt("Withdraw amount (USDT):");
    const amt = Number(input);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Invalid amount");
    setBusy(true);
    try {
      const updated = await patchBalance(me.id, -amt);
      setMe(updated);
    } catch (e) {
      alert(e.message || "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  const username = me?.username ?? "—";
  const invite = me?.inviteCode ?? "—";
  const usdt = me?.balance ?? 0;

  return (
    <main className="mp-page">
      {/* ===== Hero ===== */}
      <section className="mp-hero">
        <div className="mp-hero-left">
          <div className="mp-avatar" aria-hidden="true" />
          <div className="mp-user">
            <div className="mp-name">{username}</div>
            <div className="mp-invite">Invitation code: {invite}</div>
            <div className="mp-usdt-wrap">
              <div className="mp-usdt-pill" aria-label="USDT balance">
                <span className="mp-usdt-ico" />
                <span className="mp-usdt-text">USDT {usdt}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mp-hero-right">
          <button
            className="mp-cta mp-cta-blue"
            type="button"
            onClick={goDeposit}
            disabled={!me}
            title={!me ? "Loading user..." : "Deposit"}
          >
            <span className="mp-cta-ico">⬇️</span>
            <span>Deposit</span>
          </button>

          <button
            className="mp-cta mp-cta-pink"
            type="button"
            onClick={handleWithdraw}
            disabled={busy || !me}
            title={!me ? "Loading user..." : "Withdrawal"}
          >
            <span className="mp-cta-ico">⬆️</span>
            <span>{busy ? "..." : "Withdrawal"}</span>
          </button>
        </div>
      </section>

      {/* ===== Lower list ===== */}
      <section className="mp-list-wrap">
        <div className="mp-list" style={{ pointerEvents: "auto" }}>
          <Link
            to="/profile"
            className="mp-item"
            role="button"
            tabIndex={0}
            style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", color:"inherit", width:"100%" }}
          >
            <span className="mp-item-ico" aria-hidden>👤</span>
            <span className="mp-item-label">Profile</span>
            <span className="mp-item-arrow" aria-hidden>›</span>
          </Link>

          <Link
            to="/deposit-records"
            className="mp-item"
            role="button"
            tabIndex={0}
            style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", color:"inherit", width:"100%", cursor:"pointer" }}
          >
            <span className="mp-item-ico" aria-hidden>⬇️</span>
            <span className="mp-item-label">Deposit records</span>
            <span className="mp-item-arrow" aria-hidden>›</span>
          </Link>

          <Link
            to="/withdrawal-records"
            className="mp-item"
            role="button"
            tabIndex={0}
            style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", color:"inherit", width:"100%" }}
          >
            <span className="mp-item-ico" aria-hidden>⬆️</span>
            <span className="mp-item-label">Withdrawal records</span>
            <span className="mp-item-arrow" aria-hidden>›</span>
          </Link>

          <Link
            to="/setting"
            className="mp-item"
            role="button"
            tabIndex={0}
            style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", color:"inherit", width:"100%" }}
          >
            <span className="mp-item-ico" aria-hidden>⚙️</span>
            <span className="mp-item-label">Setting</span>
            <span className="mp-item-arrow" aria-hidden>›</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
