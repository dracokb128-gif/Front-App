// src/wdStore.js

/* ---------------- helpers ---------------- */
export const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{25,59}$/;
export const cleanUid = (uidIn) =>
  String(uidIn ?? localStorage.getItem("uid") ?? "").replace(/^u/i, "");

export const wdGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const wdSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export const wdDel = (k) => { try { localStorage.removeItem(k); } catch {} };

const localWalletKey = (uid) => `wallet:trc20:${cleanUid(uid)}`;

function dispatchWalletChange() {
  try { window.dispatchEvent(new Event("wd:wallet-change")); } catch {}
}
function validAddr(a) { const s = String(a || ""); return TRC20_RE.test(s) ? s : ""; }

/* ---------------- read merged wallet (per-user first) ---------------- */
export function readWallet(uidIn) {
  const uid = cleanUid(uidIn);

  // 1) per-user mirror (authoritative)
  try {
    const m = JSON.parse(wdGet(`user_wallet:${uid}`) || "null");
    if (m && validAddr(m.address)) {
      return {
        walletName: m.name || "My wallet",
        protocol: m.network || "TRC-20",
        address: m.address,
        owner: m.owner || "—",
      };
    }
  } catch {}

  // 2) lightweight per-user cache
  const perUserCache = wdGet(localWalletKey(uid));
  if (validAddr(perUserCache)) {
    return {
      walletName: wdGet("wd_addr_label") || "My wallet",
      protocol: wdGet("wd_addr_chain") || "TRC-20",
      address: perUserCache,
      owner: wdGet("wd_addr_owner") || "—",
    };
  }

  // 3) payload (ONLY if uid matches)
  try {
    const p = JSON.parse(wdGet("wd_address_payload") || "null");
    if (p && p.uid === uid && validAddr(p.address)) {
      return {
        walletName: p.walletName || "My wallet",
        protocol: p.protocol || "TRC-20",
        address: p.address,
        owner: p.owner || "—",
      };
    }
  } catch {}

  // 4) legacy globals — ignored now
  return { walletName: "My wallet", protocol: "TRC-20", address: "", owner: "—" };
}

/* ---------------- write everywhere + signal (per-user) ---------------- */
export function persistWalletAll(uidIn, address, network = "TRC-20", name = "My wallet", owner = "—") {
  const uid = cleanUid(uidIn);
  const addr = validAddr(address);
  if (!addr) return;

  // per-user mirror (authoritative)
  wdSet(
    `user_wallet:${uid}`,
    JSON.stringify({ address: addr, network, name, owner, updatedAt: Date.now() })
  );

  // lightweight per-user cache
  wdSet(localWalletKey(uid), addr);

  // scoped payload (adds uid so it won't leak to other users)
  wdSet(
    "wd_address_payload",
    JSON.stringify({ uid, walletName: name, protocol: network, address: addr, owner })
  );

  // compatibility flags (per-user)
  wdSet(`wd:u:${uid}:addr`, "1");

  // 🔒 purge old global leaks
  ["wd_wallet_addr", "wd_addr_address", "wd_addr_chain", "wd_addr_label", "wd_addr_owner"].forEach(wdDel);

  dispatchWalletChange();
}

/* ---------------- is bound? ---------------- */
export function isBound(uidIn) {
  const w = readWallet(uidIn);
  return !!validAddr(w.address);
}

/* ---------------- legacy lift (safe) ---------------- */
export function ensureFromLegacy(uidIn) {
  const uid = cleanUid(uidIn);
  if (isBound(uid)) return;

  // only per-user cache considered
  const legacyAddr = wdGet(localWalletKey(uid)) || "";
  const addr = validAddr(legacyAddr);
  if (!addr) return;

  persistWalletAll(
    uid,
    addr,
    wdGet("wd_addr_chain") || "TRC-20",
    wdGet("wd_addr_label") || "My wallet",
    wdGet("wd_addr_owner") || "—"
  );
}

/* ---------------- cookie boot ---------------- */
function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** Remove old/demo caches & global leaks */
export function clearLegacyWalletCache(exceptUid) {
  const keep = String(cleanUid(exceptUid));
  for (let i = 1; i <= 20; i++) {
    const id = String(i);
    if (id === keep) continue;
    wdDel(`user_wallet:${id}`);
    wdDel(`wallet:trc20:${id}`);
  }
  ["wd_address_payload","wd_wallet_addr","wd_addr_address","wd_addr_chain","wd_addr_label","wd_addr_owner"].forEach(wdDel);
}

/** If backend sets uid cookie, copy to LS then lift legacy. */
export function ensureFromCookieOnBoot() {
  const cookieUid = (getCookie("uid") || "").replace(/^u/i, "");
  if (cookieUid && wdGet("uid") !== cookieUid) wdSet("uid", cookieUid);
  try { ensureFromLegacy(cookieUid || wdGet("uid")); } catch {}
  dispatchWalletChange();
  return cleanUid(cookieUid || wdGet("uid"));
}

/** Call on login/mount; clears stale caches and prevents leaks. */
export function wdEnsureFreshOnLogin(uidIn) {
  const uid = cleanUid(uidIn || ensureFromCookieOnBoot());
  if (!uid) return;
  clearLegacyWalletCache(uid);

  // drop payload if belongs to different uid
  try {
    const p = JSON.parse(wdGet("wd_address_payload") || "null");
    if (p && p.uid && p.uid !== uid) wdDel("wd_address_payload");
  } catch { wdDel("wd_address_payload"); }

  dispatchWalletChange();
}

/* ---------------- backend sync (authoritative → LS) ---------------- */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.VITE_API_BASE)) ||
  "http://127.0.0.1:4000";

/** GET /api/wallet/address?userId=UID -> {address, network?, walletName?, owner?} */
async function fetchServerWallet(uid) {
  const u = cleanUid(uid);
  const res = await fetch(`${API_BASE}/api/wallet/address?userId=${encodeURIComponent(u)}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

/** Public: backend se wallet lao; milay to per-user mirrors me persist karo */
export async function syncWalletFromServer(uidIn) {
  const uid = cleanUid(uidIn);
  try {
    const data = await fetchServerWallet(uid);
    if (data && data.address && TRC20_RE.test(String(data.address))) {
      persistWalletAll(
        uid,
        data.address,
        data.network || "TRC-20",
        data.walletName || "My wallet",
        data.owner || "—"
      );
      return true;
    }
  } catch {}
  return false;
}
