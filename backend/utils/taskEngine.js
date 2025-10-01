// backend/utils/taskEngine.js
const fs = require("fs");
const path = require("path");

const MAX_TASKS_PER_DAY = 25;

// --- date key (per day) ---
function todayKey(d = new Date()) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// --- ensure per-day counters ---
function ensureDaily(u) {
  const key = todayKey();
  if (!u.daily || typeof u.daily !== "object") u.daily = {};
  if (!u.daily[key]) {
    u.daily[key] = { completed: 0, commission: 0 };
    u.completedToday = 0;
    u.lastTaskDate = key;
  } else if (u.lastTaskDate !== key) {
    u.lastTaskDate = key;
    u.completedToday = u.daily[key].completed || 0;
  }
  return key;
}

// --- helper for random single task (fallback when no inject) ---
function randomSingleTask(u, store = "amazon") {
  const bal = Number(u.balance || 0);
  const base = Math.max(10, Math.min(bal * (0.25 + Math.random() * 0.5), 120));
  const amount = Math.round(base * 100) / 100;
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

// --- engine entry point (for normal flow) ---
function getNextTask(u, store, _injectRuleIgnored = null) {
  const key = ensureDaily(u);
  const day = u.daily[key] || { completed: 0, commission: 0 };
  if (Number(day.completed || 0) >= MAX_TASKS_PER_DAY) {
    return { ok: true, noMore: true, message: "No more tasks" };
  }
  // hand back a single task (the server will handle inject preview/unpaid)
  return { ok: true, task: randomSingleTask(u, store) };
}

// --- submission logic ---
function completeTask(u, taskId, note = "") {
  // if unpaid pending exists, user must submit that id first
  if (u.pending && String(u.pending.id) === String(taskId)) {
    // require enough balance
    const need = Math.max(0, Number((Number(u.pending.orderAmount || 0) - Number(u.balance || 0)).toFixed(3)));
    if (need > 0) {
      return { ok: false, needRecharge: true, deficit: need, error: "balance_not_enough" };
    }
    // complete pending
    const key = ensureDaily(u);
    const day = u.daily[key] || (u.daily[key] = { completed: 0, commission: 0 });
    day.completed = Number(day.completed || 0) + 1;
    day.commission = +Number((Number(day.commission || 0) + Number(u.pending.commission || 0))).toFixed(3);
    u.completedToday = Number(day.completed || 0);
    u.totalCompleted = Number(u.totalCompleted || 0) + 1;
    // (optional) add commission to balance
    u.balance = +Number((Number(u.balance || 0) + Number(u.pending.commission || 0))).toFixed(3);

    u.history = Array.isArray(u.history) ? u.history : [];
    u.history.unshift({ ...u.pending, status: "completed", finishedAt: Date.now(), note });
    const finished = u.pending;
    u.pending = null;

    return { ok: true, finished };
  }

  // otherwise complete a normal task (we don't deduct balance in demo)
  const key = ensureDaily(u);
  const day = u.daily[key] || (u.daily[key] = { completed: 0, commission: 0 });
  day.completed = Number(day.completed || 0) + 1;
  u.completedToday = Number(day.completed || 0);
  u.totalCompleted = Number(u.totalCompleted || 0) + 1;

  // push a record
  const rec = {
    id: taskId,
    status: "completed",
    commission: 0.04, // not used by UI
    finishedAt: Date.now(),
  };
  u.history = Array.isArray(u.history) ? u.history : [];
  u.history.unshift(rec);

  return { ok: true, finished: rec };
}

module.exports = {
  MAX_TASKS_PER_DAY,
  todayKey,
  ensureDaily,
  getNextTask,
  completeTask,
};
