// backend/routes/userTasks.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const {
  MAX_TASKS_PER_DAY,
  todayKey,
  ensureDaily,
  getNextTask,
  completeTask,
} = require("../utils/taskEngine.js");

/* ---------- storage (match server.js: /var/data fallback) ---------- */
const DATA_DIR = fs.existsSync("/var/data")
  ? "/var/data"
  : path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");

/* ---------- helpers ---------- */
const idKey = (v) => String(v ?? "").trim();
const sameId = (a, b) => idKey(a).replace(/^u/i, "") === idKey(b).replace(/^u/i, "");

async function readUsers() {
  try {
    const raw = await fsp.readFile(USERS_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
async function writeUsers(list) {
  await fsp.writeFile(USERS_FILE, JSON.stringify(list, null, 2), "utf8");
}
function pub(u) {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
}

/* ---------- routes ---------- */

// POST /api/task/next  { userId, store? }
router.post("/task/next", async (req, res) => {
  const userId = String(req.body?.userId || req.query?.userId || "");
  const store = req.body?.store || req.query?.store || null;

  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (store) u.preferredStore = String(store);
  const out = getNextTask(u, store);
  await writeUsers(users);
  return res.json(out);
});

// POST /api/task/incomplete  { userId, task }
router.post("/task/incomplete", async (req, res) => {
  const userId = String(req.body?.userId || "");
  const task = req.body?.task || null;

  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  if (task) {
    const bal = Number(u.balance || 0);
    const need = Math.max(0, Number((Number(task.orderAmount || 0) - bal).toFixed(3)));
    u.pending = { ...task, deficit: need };
  } else {
    u.pending = null;
  }
  await writeUsers(users);
  return res.json({ ok: true, unpaid: u.pending || null });
});

// POST /api/task/submit  { userId, taskId, note? }
router.post("/task/submit", async (req, res) => {
  const { userId, taskId, note = "" } = req.body || {};

  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  const out = completeTask(u, taskId, note);
  await writeUsers(users);

  if (!out || !out.ok) return res.status(400).json(out || { ok: false });
  return res.json({ ok: true, user: pub(u), finished: out.finished || null });
});

// POST /api/task/reset-daily { userId }
router.post("/task/reset-daily", async (req, res) => {
  const userId = String(req.body?.userId || "");
  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  ensureDaily(u);
  u.completedToday = 0;
  u.lastTaskDate = todayKey();

  await writeUsers(users);
  return res.json({ ok: true, user: pub(u) });
});

// POST /api/task/full-reset { userId }
router.post("/task/full-reset", async (req, res) => {
  const userId = String(req.body?.userId || "");
  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  u.cursor = 0;
  u.history = [];
  u.pending = null;
  u.completedToday = 0;
  u.totalCompleted = 0;
  u.lastTaskDate = null;

  await writeUsers(users);
  return res.json({ ok: true, user: pub(u) });
});

// GET /api/task/progress?userId=...
router.get("/task/progress", async (req, res) => {
  const userId = String(req.query?.userId || "");
  const users = await readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  const key = ensureDaily(u);
  const day = u.daily[key] || (u.daily[key] = { completed: 0, commission: 0, seenTotalsCents: [] });

  // keep deficit live like server.js
  let liveGap = 0;
  if (u.pending && Number(u.pending.orderAmount)) {
    liveGap = Math.max(0, Number(u.pending.orderAmount) - Number(u.balance || 0));
    u.pending.deficit = Number(liveGap.toFixed(3));
    await writeUsers(users);
  }

  return res.json({
    ok: true,
    completedToday: Number(day.completed || 0),
    totalCompleted: Number((u.history || []).length || 0),
    maxTasksPerDay: MAX_TASKS_PER_DAY || 25,
    balance: Number(u.balance || 0),
    todayCommission: Number(day.commission || 0),
    overallCommission: Number(u.overallCommission || 0),
    cashGap: Number(liveGap || 0),
    unpaid: u.pending || null,
    isFrozen: !!u.isFrozen,
    wdPwdSet: !!u.wd_pwd_set,
  });
});

// Alias so frontend /api/progress bhi work kare
router.get("/progress", async (req, res) => {
  req.url = "/task/progress";
  router.handle(req, res);
});

module.exports = router;
