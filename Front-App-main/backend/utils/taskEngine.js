// backend/utils/taskEngine.js
// Small, dependency-free helpers used by server.js task flow.
// Compatible with server.js expectations (MAX_TASKS_PER_DAY, todayKey, ensureDaily with seenTotalsCents safety).

const MAX_TASKS_PER_DAY = 25;

/* ---------- date key (YYYY-MM-DD) ---------- */
function todayKey(d = new Date()) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ---------- ensure per-day counters ----------
   Ensures:
   - u.daily exists
   - u.daily[key] exists with { completed, commission, seenTotalsCents: [] }
   - u.completedToday and u.lastTaskDate are coherent
*/
function ensureDaily(u, d = new Date()) {
  const key = todayKey(d);
  if (!u || typeof u !== "object") return key;

  if (!u.daily || typeof u.daily !== "object") u.daily = {};

  if (!u.daily[key]) {
    u.daily[key] = { completed: 0, commission: 0, seenTotalsCents: [] };
  } else {
    // make sure shape is stable
    if (typeof u.daily[key].completed !== "number") u.daily[key].completed = 0;
    if (typeof u.daily[key].commission !== "number") u.daily[key].commission = 0;
    if (!Array.isArray(u.daily[key].seenTotalsCents)) u.daily[key].seenTotalsCents = [];
  }

  // keep simple mirrors the rest of code expects
  if (u.lastTaskDate !== key) {
    u.lastTaskDate = key;
    u.completedToday = Number(u.daily[key].completed || 0);
  } else {
    if (typeof u.completedToday !== "number") {
      u.completedToday = Number(u.daily[key].completed || 0);
    }
  }

  return key;
}

/* ---------- simple fallback single-task generator ----------
   Not used by server.js primary flow (it builds tasks itself),
   but kept for compatibility with older routes/components.
*/
function randomSingleTask(u, store = "amazon") {
  const bal = Math.max(0, Number(u?.balance || 0));
  // keep orderAmount within a friendly range and <= balance when balance is reasonable
  let amount = 0;
  if (bal >= 20) {
    // pick something <= balance, min 10, max 120
    const cap = Math.min(120, bal);
    amount = Math.max(10, Math.min(cap, Math.round((cap * (0.25 + Math.random() * 0.5)) * 100) / 100));
  } else {
    amount = Math.round((10 + Math.random() * 30) * 100) / 100; // small starter
  }

  const rate = 0.04;
  const commission = +(amount * rate).toFixed(3);

  return {
    id: `t_${Date.now()}`,
    kind: "single",
    type: "single",
    store,
    title: "Order",
    unitPrice: amount,
    quantity: 1,
    orderAmount: amount,
    commission,
    commissionRate: rate,
  };
}

/* ---------- simple engine (optional use) ---------- */
function getNextTask(u, store) {
  const key = ensureDaily(u);
  const day = u.daily[key] || { completed: 0 };
  if (Number(day.completed || 0) >= MAX_TASKS_PER_DAY) {
    return { ok: true, noMore: true, message: "No more tasks" };
  }
  return { ok: true, task: randomSingleTask(u, store) };
}

/* ---------- completion (optional use) ----------
   Note: server.js has its own complete flow; this remains for legacy callers.
*/
function completeTask(u, taskId, note = "") {
  // If there is a matching pending task, require enough balance for orderAmount
  if (u.pending && String(u.pending.id) === String(taskId)) {
    const need = Math.max(0, Number((Number(u.pending.orderAmount || 0) - Number(u.balance || 0)).toFixed(3)));
    if (need > 0) {
      return { ok: false, needRecharge: true, deficit: need, error: "balance_not_enough" };
    }
    // mark completed
    const key = ensureDaily(u);
    const day = u.daily[key] || (u.daily[key] = { completed: 0, commission: 0, seenTotalsCents: [] });

    day.completed = Number(day.completed || 0) + 1;
    day.commission = +Number((Number(day.commission || 0) + Number(u.pending.commission || 0))).toFixed(3);
    u.completedToday = Number(day.completed || 0);
    u.totalCompleted = Number(u.totalCompleted || 0) + 1;
    u.balance = +Number((Number(u.balance || 0) + Number(u.pending.commission || 0))).toFixed(3);

    u.history = Array.isArray(u.history) ? u.history : [];
    u.history.unshift({ ...u.pending, status: "completed", finishedAt: Date.now(), note });
    const finished = u.pending;
    u.pending = null;

    return { ok: true, finished };
  }

  // generic record if no pending context
  const key = ensureDaily(u);
  const day = u.daily[key] || (u.daily[key] = { completed: 0, commission: 0, seenTotalsCents: [] });
  day.completed = Number(day.completed || 0) + 1;
  u.completedToday = Number(day.completed || 0);
  u.totalCompleted = Number(u.totalCompleted || 0) + 1;

  const rec = { id: taskId, status: "completed", commission: 0.04, finishedAt: Date.now() };
  u.history = Array.isArray(u.history) ? u.history : [];
  u.history.unshift(rec);

  return { ok: true, finished: rec };
}

module.exports = {
  MAX_TASKS_PER_DAY,
  todayKey,
  ensureDaily,
  // optional/legacy exports:
  getNextTask,
  completeTask,
  randomSingleTask,
};
