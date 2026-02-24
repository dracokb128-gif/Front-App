// src/wdStore.js

/* ========================== helpers / keys ========================== */
export const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{25,59}$/;
export const cleanUid = (uidIn) =>
  String(uidIn ?? localStorage.getItem("uid") ?? "").replace(/^u/i, "");

export const wdGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const wdSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export const wdDel = (k) => { try { localStorage.removeItem(k); } catch {} };

const KEY_USER_MIRROR = (uid) => `user_wallet:${cleanUid(uid)}`;   // JSON mirror (authoritative)
const KEY_RAW_TRON   = (uid) => `wallet:trc20:${cleanUid(uid)}`;   // raw addr cache
const KEY_GLOBAL     = "walletAddress";                             // legacy global (for old UI)

function dispatchWalletChange() {
  try { window.dispatchEvent(new Event("wd:wallet-change")); } catch {}
}
function validAddr(a) { const s = String(a || ""); return TRC20_RE.test(s) ? s : ""; }

/* ========================== read (merged view) ========================== */
export function readWallet(uidIn) {
  const uid = cleanUid(uidIn);

  // 1) authoritative per-user JSON mirror
  try {
    const m = JSON.parse(wdGet(KEY_USER_MIRROR(uid)) || "null");
    if (m && validAddr(m.address)) {
      return {
        walletName: m.name || m.walletName || "My wallet",
        protocol: m.network || "TRC-20",
        address: m.address,
        owner: m.owner || "—",
      };
    }
  } catch {}

  // 2) lightweight per-user raw cache
  const raw = wdGet(KEY_RAW_TRON(uid));
  if (validAddr(raw)) {
    return {
      walletName: wdGet("wd_addr_label") || "My wallet",
      protocol: wdGet("wd_addr_chain") || "TRC-20",
      address: raw,
      owner: wdGet("wd_addr_owner") || "—",
    };
  }

  // 3) scoped payload (has uid guard)
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

  // 4) nothing
  return { walletName: "My wallet", protocol: "TRC-20", address: "", owner: "—" };
}

/* ========================== write everywhere ========================== */
export function persistWalletAll(
  uidIn,
  address,
  network = "TRC-20",
  name = "My wallet",
  owner = "—"
) {
  const uid = cleanUid(uidIn);
  const addr = validAddr(address);
  if (!addr || !uid) return;

  const payload = { address: addr, network, name, owner, updatedAt: Date.now() };

  // per-user mirror (authoritative)
  wdSet(KEY_USER_MIRROR(uid), JSON.stringify(payload));

  // raw per-user cache
  wdSet(KEY_RAW_TRON(uid), addr);

  // scoped payload (for some old UIs — includes uid so it won’t leak)
  wdSet("wd_address_payload", JSON.stringify({ uid, walletName: name, protocol: network, address: addr, owner }));

  // legacy global mirror for very old components
  wdSet(KEY_GLOBAL, addr);

  // per-user compat flag
  wdSet(`wd:u:${uid}:addr`, "1");

  // purge very old globals
  ["wd_wallet_addr", "wd_addr_address", "wd_addr_chain", "wd_addr_label", "wd_addr_owner"].forEach(wdDel);

  dispatchWalletChange();
}

/* ========================== small utils ========================== */
export function isBound(uidIn) {
  const w = readWallet(uidIn);
  return !!validAddr(w.address);
}

/** lift only from per-user raw cache */
export function ensureFromLegacy(uidIn) {
  const uid = cleanUid(uidIn);
  if (!uid || isBound(uid)) return;

  const legacyAddr = wdGet(KEY_RAW_TRON(uid)) || "";
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

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function clearLegacyWalletCache(exceptUid) {
  const keep = String(cleanUid(exceptUid));
  for (let i = 1; i <= 50; i++) {           // widen sweep
    const id = String(i);
    if (id === keep) continue;
    wdDel(`user_wallet:${id}`);
    wdDel(`wallet:trc20:${id}`);
  }
  ["wd_address_payload","wd_wallet_addr","wd_addr_address","wd_addr_chain","wd_addr_label","wd_addr_owner"].forEach(wdDel);
}

/** copy uid from cookie → LS, then try legacy lift */
export function ensureFromCookieOnBoot() {
  const cookieUid = (getCookie("uid") || "").replace(/^u/i, "");
  if (cookieUid && wdGet("uid") !== cookieUid) wdSet("uid", cookieUid);
  try { ensureFromLegacy(cookieUid || wdGet("uid")); } catch {}
  dispatchWalletChange();
  return cleanUid(cookieUid || wdGet("uid"));
}

/* ========================== login freshener (NOW with server sync) ========================== */
export function wdEnsureFreshOnLogin(uidIn) {
  const uid = cleanUid(uidIn || ensureFromCookieOnBoot());
  if (!uid) return;

  clearLegacyWalletCache(uid);

  // drop payload if belongs to different uid
  try {
    const p = JSON.parse(wdGet("wd_address_payload") || "null");
    if (p && p.uid && p.uid !== uid) wdDel("wd_address_payload");
  } catch { wdDel("wd_address_payload"); }

  // 🔄 try to fetch authoritative value from server
  try { syncWalletFromServer(uid).catch(() => {}); } catch {}

  dispatchWalletChange();
}

/* ========================== backend sync ========================== */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.VITE_API_BASE)) ||
  "https://backend-app-jqla.onrender.com";

/** GET /api/wallet/address?userId=UID -> { address, network?, walletName?, owner? } */
async function fetchServerWallet(uid) {
  const u = cleanUid(uid);
  const res = await fetch(
    `${API_BASE}/api/wallet/address?userId=${encodeURIComponent(u)}`,
    { credentials: "include", cache: "no-store" }
  );
  if (!res.ok) return null;
  return await res.json();
}

/** Public: server → LS (authoritative if present) */
export async function syncWalletFromServer(uidIn) {
  const uid = cleanUid(uidIn);
  try {
    const data = await fetchServerWallet(uid);
    const addr = data?.address;
    if (addr && TRC20_RE.test(String(addr))) {
      persistWalletAll(
        uid,
        addr,
        data.network || "TRC-20",
        data.walletName || "My wallet",
        data.owner || "—"
      );
      return true;
    }
  } catch {}
  return false;
}
