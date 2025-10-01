// backend/routes/userTasks.js
const express = require("express");
const router = express.Router();

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const {
  todayKey,
  ensureDaily,
  getNextTask,
  completeTask,
} = require("../utils/taskEngine.js");

/* ---------- storage ---------- */
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");

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
  const u = users.find((x) => String(x.id) === userId);
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  // store preference optionally remember
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
  const u = users.find((x) => String(x.id) === userId);
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  u.pending = task ? { ...task } : null;
  await writeUsers(users);
  return res.json({ ok: true, unpaid: u.pending || null });
});

// POST /api/task/submit  { userId, taskId, note? }
router.post("/task/submit", async (req, res) => {
  const { userId, taskId, note = "" } = req.body || {};

  const users = await readUsers();
  const u = users.find((x) => String(x.id) === String(userId));
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  const out = completeTask(u, taskId, note);
  await writeUsers(users);

  if (!out || !out.ok) return res.status(400).json(out || { ok: false });
  return res.json({ ok: true, user: pub(u), summary: out.summary });
});

// POST /api/task/reset-daily { userId }
router.post("/task/reset-daily", async (req, res) => {
  const userId = String(req.body?.userId || "");
  const users = await readUsers();
  const u = users.find((x) => String(x.id) === userId);
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
  const u = users.find((x) => String(x.id) === userId);
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
  const u = users.find((x) => String(x.id) === userId);
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

  ensureDaily(u);
  await writeUsers(users);

  return res.json({
    ok: true,
    balance: Number(u.balance || 0),
    cursor: u.cursor || 0,
    completedToday: u.completedToday || 0,
    totalCompleted: u.totalCompleted || 0,
    lastTaskDate: u.lastTaskDate || null,
    unpaidTask: u.pending || null,
  });
});

// Alias so frontend /api/progress bhi work kare
router.get("/progress", async (req, res) => {
  req.url = "/task/progress";
  router.handle(req, res);
});

module.exports = router;
