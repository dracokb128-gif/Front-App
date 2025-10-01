// src/AdminManageUser.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { adminChangeUserPassword, adminWdSet, adminSetWalletAddress } from "./api";

/* inline SVG loader (works without global CSS) */
function LoaderIcon({ size = 16, color = "#fff", style }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 50 50" style={{ marginRight: 8, verticalAlign: "-2px", ...style }}>
      <circle cx="25" cy="25" r="20" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="6" />
      <path fill="none" stroke={color} strokeWidth="6" d="M45 25a20 20 0 0 0-20-20">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/* helpers */
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{25,59}$/;
const getUid = () => String(localStorage.getItem("uid") || "").replace(/^u/i, "");
const walletKey = (uid) => `wallet:trc20:${String(uid).replace(/^u/i, "")}`;

/* mirror to localStorage if admin edits current user */
function mirrorWalletToLocal(uidRaw, address, network = "TRC-20", name = "My wallet", owner = "—") {
  const uid = String(uidRaw).replace(/^u/i, "");
  try {
    localStorage.setItem(`wd:u:${uid}:addr`, "1");
    localStorage.setItem(
      `user_wallet:${uid}`,
      JSON.stringify({ address, network, name, owner, updatedAt: Date.now() })
    );
    localStorage.setItem(walletKey(uid), address);
  } catch {}
  window.dispatchEvent(new Event("wd:wallet-change"));
}

export default function AdminManageUser({ open, user, onClose }) {
  // "menu" | "login" | "withdraw" | "wallet"
  const [view, setView] = useState("menu");

  // common state
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  // login/withdraw fields
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  // wallet fields
  const [walletName, setWalletName] = useState("");
  const [walletAddr, setWalletAddr] = useState("");

  useEffect(() => {
    if (!open) return;
    setView("menu");
    setNewPwd(""); setConfirm("");
    setWalletName(""); setWalletAddr("");
    setBusy(false); setOk(false); setError("");
  }, [open, user]);

  const rules = useMemo(
    () => ({ len: newPwd.length >= 6, match: newPwd === confirm && confirm.length > 0 }),
    [newPwd, confirm]
  );
  const canSubmitPwd = rules.len && rules.match && !busy;
  const canSaveWallet = TRC20_RE.test(walletAddr) && !busy;

  function closeSelf() {
    setView("menu");
    onClose?.();
  }

  /* ---------- login password ---------- */
  async function submitLogin() {
    if (!canSubmitPwd || !user?.id) return;
    setBusy(true); setError("");
    try {
      await adminChangeUserPassword(user.id, newPwd);
      setOk(true);
      setTimeout(() => { setOk(false); closeSelf(); }, 900);
    } catch (e) {
      setError(e?.message || "Failed to change password");
    } finally { setBusy(false); }
  }

  /* ---------- withdrawal password ---------- */
  async function submitWithdraw() {
    if (!canSubmitPwd || !user?.id) return;
    setBusy(true); setError("");
    try {
      await adminWdSet(user.id, newPwd);
      setOk(true);
      setTimeout(() => { setOk(false); closeSelf(); }, 900);
    } catch (e) {
      setError(e?.message || "Failed to set withdrawal password");
    } finally { setBusy(false); }
  }

  /* ---------- wallet (TRC-20) ---------- */
  async function submitWallet() {
    if (!canSaveWallet || !user?.id) return;
    setBusy(true); setError("");
    try {
      await adminSetWalletAddress(user.id, walletAddr.trim(), "TRC-20");

      // mirror only if current logged-in user is same as edited user
      const currentUid = getUid();
      if (currentUid && currentUid === String(user.id).replace(/^u/i, "")) {
        mirrorWalletToLocal(currentUid, walletAddr.trim(), "TRC-20", walletName || "My wallet");
      }

      setOk(true);
      setTimeout(() => { setOk(false); closeSelf(); }, 900);
    } catch (e) {
      setError(e?.message || "Failed to update wallet");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeSelf(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(15,23,42,.45)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:9999, padding:16
      }}
    >
      <div
        style={{
          width:"92%", maxWidth:520, background:"#fff", borderRadius:14,
          boxShadow:"0 18px 50px rgba(0,0,0,.30)", overflow:"hidden"
        }}
      >
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9", fontWeight:600, fontSize:16 }}>
          Manage user {user ? `u${user.id}` : ""} <span style={{ color:"#64748b" }}>{user?.username}</span>
        </div>

        <div style={{ padding:16 }}>
          {view === "menu" && (
            <div style={{ display:"grid", gap:12 }}>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => { setView("login"); setNewPwd(""); setConfirm(""); setError(""); setOk(false); }}
                style={{ justifyContent:"flex-start" }}
              >
                Change Login Password
              </button>

              <button
                type="button"
                className="btn btn-light"
                onClick={() => { setView("withdraw"); setNewPwd(""); setConfirm(""); setError(""); setOk(false); }}
                style={{ justifyContent:"flex-start" }}
              >
                Change Withdrawal Password
              </button>

              <button
                type="button"
                className="btn btn-light"
                onClick={() => { setView("wallet"); setWalletName(""); setWalletAddr(""); setError(""); setOk(false); }}
                style={{ justifyContent:"flex-start" }}
              >
                Change Wallet Address
              </button>

              <button type="button" className="btn btn-light" onClick={closeSelf}>Close</button>
            </div>
          )}

          {view === "login" && (
            <div style={{ display:"grid", gap:12 }}>
              <div style={{ fontSize:13, color:"#334155", fontWeight:600 }}>Change Login Password</div>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>New Password</div>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e)=>setNewPwd(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>Confirm Password</div>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e)=>setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <ul style={{ margin:0, padding:"0 0 0 18px", fontSize:12 }}>
                <li style={{ color: rules.len ? "#16a34a" : "#ef4444" }}>At least 6 characters</li>
                <li style={{ color: rules.match ? "#16a34a" : "#ef4444" }}>Both passwords match</li>
              </ul>

              {error && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c",
                              borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600 }}>
                  {error}
                </div>
              )}

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button type="button" className="btn btn-light" onClick={() => setView("menu")}>Back</button>
                <button
                  type="button"
                  className={`btn ${canSubmitPwd ? "btn-primary" : "btn-light"}`}
                  disabled={!canSubmitPwd}
                  onClick={submitLogin}
                >
                  {busy ? (<><LoaderIcon /><span>Saving…</span></>) : "Change Password"}
                </button>
              </div>

              {ok && (
                <div
                  style={{
                    alignSelf:"center", marginTop:6, background:"#ecfdf5", color:"#16a34a",
                    border:"1px solid #bbf7d0", boxShadow:"0 10px 25px rgba(22,163,74,.08)",
                    borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600
                  }}
                >
                  Password updated successfully.
                </div>
              )}
            </div>
          )}

          {view === "withdraw" && (
            <div style={{ display:"grid", gap:12 }}>
              <div style={{ fontSize:13, color:"#334155", fontWeight:600 }}>Change Withdrawal Password</div>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>New Withdrawal Password</div>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e)=>setNewPwd(e.target.value)}
                  placeholder="Enter new withdrawal password"
                  autoComplete="new-password"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>Confirm Withdrawal Password</div>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e)=>setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <ul style={{ margin:0, padding:"0 0 0 18px", fontSize:12 }}>
                <li style={{ color: rules.len ? "#16a34a" : "#ef4444" }}>At least 6 characters</li>
                <li style={{ color: rules.match ? "#16a34a" : "#ef4444" }}>Both passwords match</li>
              </ul>

              {error && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c",
                              borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600 }}>
                  {error}
                </div>
              )}

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button type="button" className="btn btn-light" onClick={() => setView("menu")}>Back</button>
                <button
                  type="button"
                  className={`btn ${canSubmitPwd ? "btn-primary" : "btn-light"}`}
                  disabled={!canSubmitPwd}
                  onClick={submitWithdraw}
                >
                  {busy ? (<><LoaderIcon /><span>Saving…</span></>) : "Set Withdrawal Password"}
                </button>
              </div>

              {ok && (
                <div
                  style={{
                    alignSelf:"center", marginTop:6, background:"#ecfdf5", color:"#16a34a",
                    border:"1px solid #bbf7d0", boxShadow:"0 10px 25px rgba(22,163,74,.08)",
                    borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600
                  }}
                >
                  Withdrawal password set successfully.
                </div>
              )}
            </div>
          )}

          {view === "wallet" && (
            <div style={{ display:"grid", gap:12 }}>
              <div style={{ fontSize:13, color:"#334155", fontWeight:600 }}>Change Wallet Address (TRC-20)</div>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>Wallet Name (optional)</div>
                <input
                  value={walletName}
                  onChange={(e)=>setWalletName(e.target.value)}
                  placeholder="e.g. My wallet"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <label style={{ display:"block" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>TRC-20 Address</div>
                <input
                  value={walletAddr}
                  onChange={(e)=>setWalletAddr(e.target.value.trim())}
                  placeholder="Starts with T..."
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", outline:"none", fontSize:14 }}
                />
              </label>

              <ul style={{ margin:0, padding:"0 0 0 18px", fontSize:12 }}>
                <li style={{ color: TRC20_RE.test(walletAddr) ? "#16a34a" : "#ef4444" }}>Valid TRC-20 address</li>
              </ul>

              {error && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c",
                              borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600 }}>
                  {error}
                </div>
              )}

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button type="button" className="btn btn-light" onClick={() => setView("menu")}>Back</button>
                <button
                  type="button"
                  className={`btn ${canSaveWallet ? "btn-primary" : "btn-light"}`}
                  disabled={!canSaveWallet}
                  onClick={submitWallet}
                >
                  {busy ? (<><LoaderIcon /><span>Saving…</span></>) : "Save Wallet"}
                </button>
              </div>

              {ok && (
                <div
                  style={{
                    alignSelf:"center", marginTop:6, background:"#ecfdf5", color:"#16a34a",
                    border:"1px solid #bbf7d0", boxShadow:"0 10px 25px rgba(22,163,74,.08)",
                    borderRadius:12, padding:"8px 12px", fontSize:13, fontWeight:600
                  }}
                >
                  Wallet updated successfully.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
