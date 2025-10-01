import { persistWalletAll, wdEnsureFreshOnLogin, syncWalletFromServer } from "./wdStore";

/* ===========================================================
   API base
=========================================================== */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.VITE_API_BASE)) ||
  "https://backend-app-jqla.onrender.com";

/* Optional custom wallet endpoints via env */
const WALLET_SET_PATH =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_WALLET_SET_PATH ||
      process.env.VITE_WALLET_SET_PATH)) ||
  "";

const WALLET_GET_PATH =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_WALLET_GET_PATH ||
      process.env.VITE_WALLET_GET_PATH)) ||
  "";

/* ===========================================================
   Low-level JSON helper
=========================================================== */
async function http(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  const bad = !res.ok || (data && typeof data === "object" && data.ok === false);
  if (bad) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error || data.msg)) ||
      res.statusText ||
      "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ===========================================================
   Auth
=========================================================== */

function _persistLoginLocals(loginResp) {
  const U = (loginResp && (loginResp.user || loginResp)) || {};
  const id = String(U.id ?? U.userId ?? U.uid ?? "").replace(/^u/i, "");
  if (!id) return;

  try {
    localStorage.setItem("user", JSON.stringify({ user: { ...U, id: Number(id) || id } }));
    localStorage.setItem("uid", id);
    localStorage.setItem("userId", id);
    localStorage.setItem("userid", id);
    localStorage.setItem("user_id", id);

    if (U.balance != null) {
      const b = Number(U.balance) || 0;
      localStorage.setItem("balance", String(b));
      localStorage.setItem("user_balance", String(b));
    }
  } catch {}
}

export async function loginApi(input) {
  const username = String(input?.username || "").trim();
  const password = String(input?.password || "").trim();
  if (!username || !password) throw new Error("Username & password required");

  const resp = await http("/api/login", { method: "POST", body: { username, password } });

  _persistLoginLocals(resp);

  const id = String((resp?.user?.id ?? resp?.id) || "").replace(/^u/i, "");
  if (id) {
    wdEnsureFreshOnLogin(id);
    await syncWalletFromServer(id);
    try {
      window.dispatchEvent(new Event("wd:wallet-change"));
    } catch {}
  }

  return resp;
}
export const login = loginApi;
export const adminLogin = loginApi;

export async function register(a, b, c) {
  let payload;
  if (typeof a === "object") {
    payload = {
      username: String(a.username || "").trim(),
      password: String(a.password || "").trim(),
      inviteCode: String(a.inviteCode || a.invite || "").trim(),
    };
  } else {
    payload = {
      username: String(a || "").trim(),
      password: String(b || "").trim(),
      inviteCode: String(c || "").trim(),
    };
  }
  if (!payload.username || !payload.password) throw new Error("Username & password required");
  return http("/api/register", { method: "POST", body: payload });
}

/* ===========================================================
   User-facing: progress / records / tasks
=========================================================== */
export const getProgress = (userId) =>
  http(`/api/progress?userId=${encodeURIComponent(userId)}`);
export const getRecords = (userId) =>
  http(`/api/records?userId=${encodeURIComponent(userId)}`);
export const taskNext = (userId, store = "") =>
  http(`/api/task/next`, { method: "POST", body: { userId, store } });
export const completeTask = (userId, taskId, note = "") =>
  http(`/api/task/submit`, { method: "POST", body: { userId, taskId, note } });

export async function submitUnpaid(userId, task) {
  const paths = [
    "/api/task/mark-unpaid",
    "/api/task/submit-unpaid",
    "/api/task/incomplete",
    "/api/task/unpaid",
    "/api/submit-unpaid",
  ];
  let lastErr = null;
  for (const p of paths) {
    try {
      return await http(p, { method: "POST", body: { userId, task } });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("submit_unpaid_failed");
}

/* ===========================================================
   Admin — USERS
=========================================================== */
export const adminListUsers = () => http(`/api/admin/users`);
export const getUsers = adminListUsers;

export const adminDeleteUser = (id) =>
  http(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
export const deleteUserById = adminDeleteUser;

export function adminPatchBalance(userId, delta, note = "") {
  if (!Number.isFinite(Number(delta)) || Number(delta) === 0)
    throw new Error("Invalid amount");
  return http(`/api/admin/users/${encodeURIComponent(userId)}/balance`, {
    method: "PATCH",
    body: { delta: Number(delta), note },
  });
}
export const patchBalance = adminPatchBalance;

export const adminSetFreeze = (userId, frozen = true) =>
  http(`/api/admin/users/${encodeURIComponent(userId)}/freeze`, {
    method: "PATCH",
    body: { frozen: !!frozen },
  });
export const adminFreeze = adminSetFreeze;

/* ===========================================================
   Admin — Inject Rules
=========================================================== */
export async function listInjectRules(userId) {
  const out = await http(`/api/admin/inject-rules`, { method: "GET" });
  const rules = Array.isArray(out) ? out : Array.isArray(out?.rules) ? out.rules : [];
  if (!userId) return rules;
  const id = String(userId).replace(/^u/i, "");
  return rules.filter((r) => String(r.userId).replace(/^u/i, "") === id);
}
export const createInjectRule = (rule) =>
  http(`/api/admin/inject-rules`, { method: "POST", body: rule });
export const updateInjectRule = (id, patch) =>
  http(`/api/admin/inject-rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
export const deleteInjectRule = (id) =>
  http(`/api/admin/inject-rules/${encodeURIComponent(id)}`, { method: "DELETE" });

/* ===========================================================
   Admin — Misc
=========================================================== */
export const resetDaily = () =>
  http(`/api/admin/reset-daily`, { method: "POST", body: {} });
export const resetFull = () =>
  http(`/api/admin/reset-full`, { method: "POST", body: {} });
export const adminChangePassword = (oldPassword, newPassword) =>
  http(`/api/admin/change-password`, {
    method: "POST",
    body: { oldPassword, newPassword },
  });
export const getDepositRecords = (userId) =>
  http(`/api/deposit/records?userId=${encodeURIComponent(userId)}`);
export const adminLogout = () => Promise.resolve({ ok: true });
export const logout = adminLogout;
export const adminApprove = (userId) =>
  http(`/api/admin/approve/${encodeURIComponent(userId)}`, {
    method: "POST",
    body: {},
  });

/* ===========================================================
   🔹 Withdrawal Records (NEW)
=========================================================== */
export async function getWithdrawalRecords(userId) {
  const uid = String(userId || "").replace(/^u/i, "").trim();
  if (!uid) return { items: [] };

  try {
    const r = await http(
      `/api/withdrawals/records?userId=${encodeURIComponent(uid)}`
    );
    if (Array.isArray(r)) return { items: r };
    if (Array.isArray(r?.items)) return { items: r.items };
    if (Array.isArray(r?.records)) return { items: r.records };
  } catch (_) {
    try {
      const r2 = await http(`/api/withdrawals?userId=${encodeURIComponent(uid)}`);
      if (Array.isArray(r2)) return { items: r2 };
      if (Array.isArray(r2?.items)) return { items: r2.items };
      if (Array.isArray(r2?.records)) return { items: r2.records };
    } catch {}
  }
  return { items: [] };
}

/* ===========================================================
   Admin - Deposits & TRC addresses
=========================================================== */
export async function adminListDeposits(status) {
  const s = String(status || "").trim().toUpperCase();
  const qs = !s || s === "ALL" ? "" : `?status=${encodeURIComponent(s)}`;
  const res = await fetch(`${API_BASE}/api/admin/deposits${qs}`, { cache: "no-store" });
  return res.json();
}
export const adminApproveDeposit = (id, note="") =>
  fetch(`${API_BASE}/api/admin/deposits/${id}/approve`, {
    method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ note })
  }).then(r=>r.json());
export const adminRejectDeposit  = (id, note="") =>
  fetch(`${API_BASE}/api/admin/deposits/${id}/reject`, {
    method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ note })
  }).then(r=>r.json());

/* ---------- TRC address pool (robust) ---------- */
// List (adds __debug to see real backend paths)
export const adminListAddresses = () =>
  fetch(`${API_BASE}/api/admin/addresses?__debug=1`, { cache: "no-store" })
    .then(async (r) => {
      const j = await r.json();
      try {
        console.log("[addr:list] paths:", j?._files || r.headers.get("X-Addr-Files"));
      } catch {}
      return j?.items || j || [];
    });

// Add (accepts string lines OR array; trims + filters)
export const adminAddAddresses = (addresses) => {
  const payload = Array.isArray(addresses)
    ? addresses
    : String(addresses || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

  // optional client-side filter: only TRC-looking strings
  const cleaned = payload.filter((a) => validateTronAddress(a));

  return fetch(`${API_BASE}/api/admin/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses: cleaned }),
  }).then((r) => r.json());
};

// Delete (force=1 so “in-use” bhi clean ho)
export const adminDeleteAddress = (address, force = true) =>
  fetch(`${API_BASE}/api/admin/addresses/${encodeURIComponent(address)}${force ? "?force=1" : ""}`, {
    method: "DELETE",
  }).then((r) => r.json());

/* ===========================================================
   USER: login password change (existing)
=========================================================== */
export const userChangePassword = ({ userId, username, oldPassword, newPassword }) =>
  http("/api/change-password", {
    method: "POST",
    body: { userId, username, oldPassword, newPassword },
  });

export const adminChangeUserPassword = (userId, newPassword) =>
  http("/api/admin/change-password", {
    method: "POST",
    body: { userId: String(userId).replace(/^u/i, ""), newPassword },
  });

/* ===========================================================
   USER: WD password (withdrawal)
=========================================================== */
export const wdSetPassword = (userId, password) =>
  http("/api/wd/set-password", {
    method: "POST",
    body: { userId: String(userId).replace(/^u/i, ""), password: String(password || "") },
  });

export const wdChangePassword = (userId, oldPassword, newPassword) =>
  http("/api/wd/change-password", {
    method: "POST",
    body: {
      userId: String(userId).replace(/^u/i, ""),
      oldPassword: String(oldPassword || ""),
      newPassword: String(newPassword || ""),
    },
  });

export const wdVerify = (userId, password) =>
  http("/api/wd/verify", {
    method: "POST",
    body: { userId: String(userId).replace(/^u/i, ""), password: String(password || "") },
  });

export const adminWdSet = (userId, newPassword) =>
  http("/api/admin/wd/set", {
    method: "POST",
    body: { userId: String(userId).replace(/^u/i, ""), newPassword: String(newPassword || "") },
  });

/* ===========================================================
   Wallet (TRC-20) + local persistence helper
=========================================================== */
export function validateTronAddress(addr) {
  return /^T[1-9A-HJ-NP-Za-km-z]{25,58}$/.test(String(addr || "").trim());
}
const WALLET_KEY = (uid) => `wallet:trc20:${String(uid).replace(/^u/i, "")}`;
function _getLocalWallet(uid) {
  try {
    return localStorage.getItem(WALLET_KEY(uid)) || "";
  } catch {
    return "";
  }
}
function _setLocalWallet(uid, addr) {
  try {
    localStorage.setItem(WALLET_KEY(uid), String(addr || ""));
  } catch {}
}

/** Back-compat alias for default export */
export function persistWalletAllLocal(uid, address, network = "TRC-20", walletName) {
  persistWalletAll(uid, address, network, walletName);
}

export async function getWalletAddress(userId) {
  const uid = String(userId).replace(/^u/i, "");
  const roots = ["/api"];
  const leafs = WALLET_GET_PATH
    ? [WALLET_GET_PATH, "/wallet/address", "/wallet/get", "/user/wallet", "/user/wallet/address"]
    : ["/wallet/address", "/wallet/get", "/user/wallet", "/user/wallet/address"];
  let lastErr = null,
    lastURL = null;
  for (const r of roots)
    for (const l of leafs) {
      try {
        const base = l.startsWith("/") ? l : `/${l}`;
        const url =
          `${r}${base}`.replace(/\/{2,}/g, "/") +
          `?userId=${encodeURIComponent(uid)}`;
        lastURL = url;
        const res = await http(url, { method: "GET" });
        const address =
          res?.address || res?.wallet?.address || res?.data?.address || res?.data?.wallet?.address || "";
        if (address) {
          _setLocalWallet(uid, address);
          return { ok: true, address };
        }
      } catch (e) {
        lastErr = e;
      }
    }
  const mirror = (() => {
    try {
      const per = JSON.parse(localStorage.getItem(`user_wallet:${uid}`) || "{}");
      return per?.address || "";
    } catch {
      return "";
    }
  })();
  const local = _getLocalWallet(uid);
  const addr = mirror || local;
  if (addr) return { ok: true, address: addr, source: mirror ? "mirror" : "local" };
  const err = new Error(
    lastErr?.status === 404
      ? `Wallet endpoint not found (last tried: ${lastURL})`
      : "Could not fetch wallet address."
  );
  err.lastURL = lastURL;
  err.status = lastErr?.status;
  err.data = lastErr?.data;
  throw err;
}

export async function setWalletAddress(userId, address, network = "TRC-20", walletName) {
  const uid = String(userId).replace(/^u/i, "");
  const trc20 = String(address || "").trim();
  if (!validateTronAddress(trc20)) {
    const e = new Error("Invalid TRC-20 address");
    e.status = 400;
    throw e;
  }

  const roots = ["/api"];
  const leafsPost = WALLET_SET_PATH
    ? [WALLET_SET_PATH, "/wallet/set", "/wallet/change", "/change-wallet", "/change-wallet-address", "/wallet/address/set", "/user/wallet/set"]
    : ["/wallet/set", "/wallet/change", "/change-wallet", "/change-wallet-address", "/wallet/address/set", "/user/wallet/set"];
  const leafsGet = WALLET_SET_PATH
    ? [WALLET_SET_PATH, "/change-wallet-address", "/wallet/set", "/user/wallet/set"]
    : ["/change-wallet-address", "/wallet/set", "/user/wallet/set"];
  let lastErr = null,
    lastURL = null;

  for (const r of roots)
    for (const l of leafsPost) {
      try {
        const base = l.startsWith("/") ? l : `/${l}`;
        const url = `${r}${base}`.replace(/\/{2,}/g, "/");
        lastURL = url;
        const res = await http(url, {
          method: "POST",
          body: { userId: uid, address: trc20, network },
        });
        const ok = res?.ok === true || res?.status === "ok" || !!(res?.wallet?.address || res?.address);
        const finalAddress = res?.wallet?.address || res?.address || trc20;
        if (ok && validateTronAddress(finalAddress)) {
          _setLocalWallet(uid, finalAddress);
          persistWalletAll(uid, finalAddress, network, walletName);
          return { ok: true, address: finalAddress, persisted: true };
        }
      } catch (e) {
        lastErr = e;
      }
    }
  for (const r of roots)
    for (const l of leafsGet) {
      try {
        const base = l.startsWith("/") ? l : `/${l}`;
        const url =
          `${r}${base}`.replace(/\/{2,}/g, "/") +
          `?userId=${encodeURIComponent(uid)}&address=${encodeURIComponent(trc20)}&network=${encodeURIComponent(network)}`;
        lastURL = url;
        const res = await http(url, { method: "GET" });
        const ok = res?.ok === true || res?.status === "ok" || !!(res?.wallet?.address || res?.address);
        const finalAddress = res?.wallet?.address || res?.address || trc20;
        if (ok && validateTronAddress(finalAddress)) {
          _setLocalWallet(uid, finalAddress);
          persistWalletAll(uid, finalAddress, network, walletName);
          return { ok: true, address: finalAddress, persisted: true };
        }
      } catch (e) {
        lastErr = e;
      }
    }
  _setLocalWallet(uid, trc20);
  persistWalletAll(uid, trc20, network, walletName);
  return {
    ok: true,
    address: trc20,
    persisted: false,
    localOnly: true,
    message: `Saved locally (no wallet endpoint found). Last tried: ${lastURL || "n/a"}`,
  };
}
export const setWallet = setWalletAddress;

/* ===========================================================
   ✅ ADMIN: set wallet for ANY user
=========================================================== */
export async function adminSetWalletAddress(userId, address, network = "TRC-20", walletName) {
  const uid = String(userId).replace(/^u/i, "");
  const trc20 = String(address || "").trim();
  if (!validateTronAddress(trc20)) {
    const e = new Error("Invalid TRC-20 address");
    e.status = 400;
    throw e;
  }

  const roots = ["/api"];
  const leafsPost = [
    "/admin/wallet/set",
    "/admin/wallet",
    "/admin/change-wallet",
    "/admin/set-wallet",
    "/wallet/admin/set",
    "/wallet/admin/change",
    "/admin/user/wallet/set",
    "/admin/users/wallet/set",
    "/users/wallet/set",
  ];
  const leafsGet = ["/admin/wallet/set", "/admin/wallet", "/admin/change-wallet", "/wallet/admin/set"];

  for (const r of roots)
    for (const l of leafsPost) {
      try {
        const url = `${r}${l}`.replace(/\/{2,}/g, "/");
        const res = await http(url, { method: "POST", body: { userId: uid, address: trc20, network } });
        const out = res?.wallet?.address || res?.address || trc20;
        persistWalletAll(uid, out, network, walletName);
        return { ok: true, address: out, persisted: true };
      } catch {}
    }
  for (const r of roots)
    for (const l of leafsGet) {
      try {
        const base = `${r}${l}`.replace(/\/{2,}/g, "/");
        const url = `${base}?userId=${encodeURIComponent(uid)}&address=${encodeURIComponent(trc20)}&network=${encodeURIComponent(network)}`;
        const res = await http(url, { method: "GET" });
        const out = res?.wallet?.address || res?.address || trc20;
        persistWalletAll(uid, out, network, walletName);
        return { ok: true, address: out, persisted: true };
      } catch {}
    }
  const r = await setWalletAddress(uid, trc20, network, walletName);
  persistWalletAll(uid, r?.address || trc20, network, walletName);
  return { ok: true, address: r?.address || trc20, persisted: !!r?.persisted, note: "fallback_user_endpoint" };
}
export const adminSetWallet = adminSetWalletAddress;

/* ===========================================================
   USER: Deposit request
=========================================================== */
export async function requestDeposit(userId, amount) {
  const uid = String(userId).replace(/^u/i, "");
  const bodyBase = { userId: uid, amount };
  const roots = ["/api"];
  const leafsTry = [
    "/deposit/request",
    "/deposits/request",
    "/request-deposit",
    "/deposit/create",
    "/deposits/create",
    "/deposit/address",
    "/wallet/deposit/request",
    "/wallet/deposit",
  ];
  const leafsForceNew = ["/deposit/create", "/deposits/create", "/wallet/deposit", "/wallet/deposit/request", "/deposit/request"];
  const make = (r, l) => `${r}${l}`.replace(/\/{2,}/g, "/");
  const normalize = (resp) => {
    if (!resp) return null;
    const deposit = resp.deposit || resp?.data?.deposit || resp;
    const addr = deposit?.address || resp.address || resp.addr || resp?.data?.address;
    const dep =
      deposit ||
      (addr
        ? {
            id: resp.id || resp.depositId || resp?.data?.id || resp?.data?.depositId || "",
            address: addr,
            amount: resp.amount || resp?.data?.amount || amount,
            status: resp.status || resp?.data?.status || "PENDING",
            userId: resp.userId || resp?.data?.userId || uid,
          }
        : null);
    if (!addr || !dep) return null;
    const rid = String(dep.userId ?? dep.uid ?? dep.user_id ?? "").replace(/^u/i, "") || uid;
    return { ok: true, address: addr, deposit: { ...dep, userId: rid } };
  };
  const sameUser = (rid) => String(rid || "").replace(/^u/i, "") === uid;

  let lastErr = null,
    lastURL = null;
  for (const r of roots)
    for (const l of leafsTry) {
      try {
        lastURL = make(r, l);
        const res = await http(lastURL, { method: "POST", body: bodyBase });
        const ok = normalize(res);
        if (ok?.ok && ok.address && sameUser(ok.deposit?.userId)) return ok;
      } catch (e) {
        lastErr = e;
      }
      try {
        const url = `${make(r, l)}?userId=${encodeURIComponent(uid)}&amount=${encodeURIComponent(amount)}`;
        lastURL = url;
        const res = await http(url, { method: "GET" });
        const ok = normalize(res);
        if (ok?.ok && ok.address && sameUser(ok.deposit?.userId)) return ok;
      } catch (e) {
        lastErr = e;
      }
    }
  for (const r of roots)
    for (const l of leafsForceNew) {
      try {
        const url = `${make(r, l)}?forceNew=1&ts=${Date.now()}`;
        lastURL = url;
        const res = await http(url, { method: "POST", body: { ...bodyBase, forceNew: true } });
        const ok = normalize(res);
        if (ok?.ok && ok.address && sameUser(ok.deposit?.userId)) return ok;
      } catch (e) {
        lastErr = e;
      }
    }
  const err = new Error(
    lastErr?.status === 404
      ? `Deposit endpoint not found (last tried: ${lastURL})`
      : "Could not create a fresh deposit for this user."
  );
  err.lastURL = lastURL;
  err.status = lastErr?.status;
  err.data = lastErr?.data;
  throw err;
}

/* ===========================================================
   ✅ WITHDRAWALS — user + admin wiring
=========================================================== */
const normStatus = (s) => {
  const x = String(s || "").trim().toUpperCase();
  if (x.startsWith("APPROV")) return "APPROVED";
  if (x.startsWith("REJEC") || x === "DENIED" || x === "DECLINED") return "REJECTED";
  return "PENDING";
};

function normalizeWithdrawal(resp, uid) {
  if (!resp) return null;
  const base = resp.item || resp.withdrawal || resp.data || resp.record || resp.result || resp;
  if (!base) return null;

  const userId = String(base.userId ?? base.uid ?? base.user_id ?? uid).replace(/^u/i, "") || uid;
  const out = {
    id: base.id || base.withdrawalId || base._id || "",
    userId,
    amount: Number(base.amount || base.usdt || 0) || 0,
    address: base.address || base.wallet || base.to || "",
    network: base.network || base.chain || "TRC-20",
    status: normStatus(base.status || base.state),
    createdAt: base.createdAt || base.created || base.time || new Date().toISOString(),
    note: base.note || base.reason || "",
  };
  return { ok: true, item: out };
}

/** Allow only by today's tasks (UI rule): 0 or >= 25 */
export async function canWithdraw(userId) {
  const uid = String(userId).replace(/^u/i, "");
  let today = 0;
  try {
    const p = await getProgress(uid);
    today = Number(p?.completedToday || 0) || 0;
  } catch {}
  const allow = today === 0 || today >= 25;
  return { ok: true, completed: today, totalCompleted: 0, allow, reason: allow ? "" : "First Complete 25 Tasks" };
}

export async function requestWithdrawal(userId, amount) {
  const uid = String(userId).replace(/^u/i, "");
  const roots = ["/api"];
  const leafs = [
    "/withdraw/submit",
    "/withdraw/request",
    "/withdraw/create",
    "/withdrawal/submit",
    "/withdrawal/request",
    "/withdrawals/request",
    "/user/withdraw",
    "/user/withdraw/request",
    "/wallet/withdraw",
    "/wd/request",
  ];
  const body = { userId: uid, amount: Number(amount) };

  let lastErr = null,
    lastURL = null;
  let pendingDetected = false;

  for (const r of roots)
    for (const l of leafs) {
      try {
        lastURL = `${r}${l}`.replace(/\/{2,}/g, "/");
        const res = await http(lastURL, { method: "POST", body });
        const ok = normalizeWithdrawal(res, uid);
        if (ok?.ok && ok.item?.userId) return ok;
      } catch (e) {
        lastErr = e;
        if (e?.status === 409 || /pending/i.test(String(e?.message || e?.data?.message || "")))
          pendingDetected = true;
      }
      try {
        const url =
          `${r}${l}`.replace(/\/{2,}/g, "/") +
          `?userId=${encodeURIComponent(uid)}&amount=${encodeURIComponent(body.amount)}`;
        lastURL = url;
        const res = await http(url, { method: "GET" });
        const ok = normalizeWithdrawal(res, uid);
        if (ok?.ok && ok.item?.userId) return ok;
      } catch (e) {
        lastErr = e;
        if (e?.status === 409 || /pending/i.test(String(e?.message || e?.data?.message || "")))
          pendingDetected = true;
      }
    }

  if (pendingDetected) {
    const err = new Error("Withdrawal is already pending.");
    err.status = 409;
    throw err;
  }

  const err = new Error(
    lastErr?.status === 404
      ? `Withdrawal endpoint not found (last tried: ${lastURL})`
      : "Could not create withdrawal request."
  );
  err.lastURL = lastURL;
  err.status = lastErr?.status;
  err.data = lastErr?.data;
  throw err;
}

export async function submitWithdrawal(userId, amount, password, address, network) {
  const min = 20;
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < min) throw new Error(`Minimum amount is ${min} USDT`);

  const gate = await canWithdraw(userId);
  if (!gate.allow) {
    const e = new Error("First Complete 25 Tasks");
    e.code = "TASKS_INCOMPLETE";
    e.state = gate;
    throw e;
  }

  const uid = String(userId).replace(/^u/i, "");
  const payload = { userId: uid, amount: amt, address: address || "", network: network || "TRC-20" };
  const submitLeafs = [
    "/withdraw/submit",
    "/withdraw/create",
    "/withdrawal/submit",
    "/user/withdraw",
    "/wallet/withdraw/submit",
  ];

  let result = null;
  for (const l of submitLeafs) {
    try {
      const url = `/api${l}`.replace(/\/{2,}/g, "/");
      const res = await http(url, { method: "POST", body: payload });
      result = res && (res.ok ? res : normalizeWithdrawal(res, uid));
      if (result) break;
    } catch {}
  }
  if (!result) result = await requestWithdrawal(userId, amt);

  try {
    const prog = await getProgress(uid);
    if (prog && typeof prog.balance !== "undefined") {
      return { ...(result || { ok: true }), newBalance: Number(prog.balance) };
    }
  } catch {}
  return result || { ok: true };
}

/* ---------- Admin wrappers for withdrawals ---------- */
export async function adminListWithdrawals(status = "PENDING") {
  const s = String(status || "PENDING").toUpperCase();
  const qs = s && s !== "ALL" ? `?status=${encodeURIComponent(s)}` : "";
  const paths = [
    `${API_BASE}/api/admin/withdrawals${qs}`,
    `${API_BASE}/api/admin/withdraws${qs}`,
    `${API_BASE}/api/admin/wd${qs}`,
  ];
  for (const p of paths) {
    try {
      const raw = await fetch(p, { cache: "no-store" });
      const data = await raw.json();
      let list =
        (Array.isArray(data) && data) ||
        data?.items ||
        data?.withdrawals ||
        data?.data ||
        [];
      if (!Array.isArray(list)) list = [];
      list = list.map((it) => ({ ...it, status: normStatus(it.status) }));
      return { ok: true, items: list };
    } catch {}
  }
  return { ok: true, items: [] };
}

export const adminApproveWithdrawal = async (id, note = "") => {
  const body = { note };
  const variants = [
    `/api/admin/withdrawals/${encodeURIComponent(id)}/approve`,
    `/api/admin/withdraws/${encodeURIComponent(id)}/approve`,
    `/api/admin/wd/${encodeURIComponent(id)}/approve`,
    `/api/admin/withdrawals/${encodeURIComponent(id)}/confirm`,
  ];
  for (const v of variants) {
    try {
      const res = await fetch(`${API_BASE}${v}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) return j || { ok: true };
    } catch {}
  }
  return { ok: false, error: "approve_failed" };
};

export const adminRejectWithdrawal = async (id, note = "") => {
  const body = { note };
  const variants = [
    `/api/admin/withdrawals/${encodeURIComponent(id)}/reject`,
    `/api/admin/withdraws/${encodeURIComponent(id)}/reject`,
    `/api/admin/wd/${encodeURIComponent(id)}/reject`,
    `/api/admin/withdrawals/${encodeURIComponent(id)}/decline`,
    `/api/admin/withdrawals/${encodeURIComponent(id)}/deny`,
  ];
  for (const v of variants) {
    try {
      const res = await fetch(`${API_BASE}${v}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) return j || { ok: true };
    } catch {}
  }
  return { ok: false, error: "reject_failed" };
};

/* ===========================================================
   Default export (single)
=========================================================== */
const API = {
  API_BASE,
  http,

  // auth
  loginApi,
  login,
  adminLogin,
  register,

  // user tasks
  getProgress,
  getRecords,
  taskNext,
  completeTask,
  submitUnpaid,

  // admin users
  adminListUsers,
  getUsers,
  adminDeleteUser,
  deleteUserById,
  adminPatchBalance,
  patchBalance,
  adminSetFreeze,
  adminFreeze,

  // inject rules
  listInjectRules,
  createInjectRule,
  updateInjectRule,
  deleteInjectRule,

  // misc
  resetDaily,
  resetFull,
  adminChangePassword,
  adminLogout,
  adminApprove,

  // deposits/admin addresses
  adminListDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  adminListAddresses,
  adminAddAddresses,
  adminDeleteAddress,

  // user deposit
  requestDeposit,

  // records
  getDepositRecords,
  getWithdrawalRecords,

  // WD password
  wdSetPassword,
  wdChangePassword,
  wdVerify,
  adminWdSet,

  // Wallet
  validateTronAddress,
  getWalletAddress,
  setWalletAddress,
  setWallet,
  persistWalletAll: persistWalletAllLocal,

  // Admin wallet setter
  adminSetWalletAddress,
  adminSetWallet,

  // Withdrawals
  canWithdraw,
  requestWithdrawal,
  submitWithdrawal,

  // Admin withdrawals
  adminListWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
};
export default API;
