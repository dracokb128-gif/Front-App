// src/WalletFinal.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle } from "react-icons/fi";

/* ---------- UID: strict (no fallback) ---------- */
const getUidStrict = () => {
  const u = localStorage.getItem("uid");
  return u ? String(u).replace(/^u/i, "") : null;
};

const localWalletKey = (uid) => `wallet:trc20:${String(uid).replace(/^u/i, "")}`;

function readWalletInfo(uid) {
  if (!uid) return { walletName: "My wallet", protocol: "TRC-20", address: "—", owner: "—" };

  // 1) per-user mirror (primary)
  try {
    const raw = localStorage.getItem(`user_wallet:${uid}`);
    if (raw) {
      const j = JSON.parse(raw);
      if (j?.address) {
        return {
          walletName: j.name || "My wallet",
          protocol: j.network || "TRC-20",
          address: j.address,
          owner: j.owner || "—",
        };
      }
    }
  } catch {}

  // 2) backup payload (legacy)
  try {
    const p = JSON.parse(localStorage.getItem("wd_address_payload") || "null");
    if (p && p.address) return p;
  } catch {}

  // 3) simple cache
  const a2 = localStorage.getItem(localWalletKey(uid));
  if (a2) return { walletName: "My wallet", protocol: "TRC-20", address: a2, owner: "—" };

  return { walletName: "My wallet", protocol: "TRC-20", address: "—", owner: "—" };
}

export default function WalletFinal() {
  const nav = useNavigate();
  const uid = getUidStrict();

  // guard: not logged in → never guess
  useEffect(() => {
    if (!uid) nav("/login", { replace: true });
  }, [uid, nav]);

  const [info, setInfo] = useState(() => readWalletInfo(uid));

  // ✅ Only check whether address exists for THIS uid (password-flag gating removed)
  useEffect(() => {
    if (!uid) return;
    const addrSet =
      localStorage.getItem(`wd:u:${uid}:addr`) === "1" ||
      !!localStorage.getItem(`user_wallet:${uid}`) ||
      !!localStorage.getItem(localWalletKey(uid));

    if (!addrSet) nav("/wallet/bind", { replace: true });
  }, [nav, uid]);

  const refresh = useCallback(() => {
    const u = getUidStrict();
    if (!u) return;
    setInfo(readWalletInfo(u));
  }, []);

  useEffect(() => {
    window.addEventListener("storage", refresh);
    window.addEventListener("wd:wallet-change", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("wd:wallet-change", refresh);
    };
  }, [refresh]);

  const handleBack = () => nav(-1);
  const avatarText = (info?.walletName?.trim()?.[0] || "W").toUpperCase();

  return (
    <div className="wb-wrap">
      <header className="wb-topbar">
        <button className="wb-back" onClick={handleBack} aria-label="Back">‹</button>
        <h1>Wallet management</h1>
        <div style={{ width: 36 }} />
      </header>

      <main className="wb-main" style={{ paddingTop: 6 }}>
        <div className="wm-chip">virtual currency</div>

        <div className="wm-card">
          <div className="wm-avatar" aria-hidden>{avatarText}</div>
          <div className="wm-mid">
            <div className="wm-line1">
              <span className="wm-name">{info.walletName || "—"}</span>
              <span className="wm-net">{info.protocol || "TRC-20"}</span>
            </div>
            <div className="wm-balance">0</div>
            <div className="wm-addr" title={info.address || ""}>
              {info.address || "—"}
            </div>
          </div>
          <div className="wm-check" aria-label="Bound / Verified">
            <FiCheckCircle />
          </div>
        </div>
      </main>
    </div>
  );
}
