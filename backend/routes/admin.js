// backend/routes/admin.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/* ---------- DATA DIR (Render disk-safe) ---------- */
const DATA_DIR = fs.existsSync("/var/data") ? "/var/data" : path.join(__dirname, "..", "data");
const RULES_FILE = path.join(DATA_DIR, "injectRules.json");
/* ⬇️ users.json bhi yahin rakhen (server.js ke hi jaisa path) */
const USERS_FILE = path.join(DATA_DIR, "users.json");

/* ---------- ensure files ---------- */
function ensure() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, "[]", "utf8");
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");
  } catch (e) {
    console.error("ensure() failed:", e);
  }
}
ensure();

/* ---------- helpers ---------- */
const nowISO = () => new Date().toISOString();
function readRules() {
  ensure();
  try {
    const txt = fs.readFileSync(RULES_FILE, "utf8") || "[]";
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeRules(v) {
  ensure();
  fs.writeFileSync(RULES_FILE, JSON.stringify(v || [], null, 2), "utf8");
}
function readUsers() {
  ensure();
  try {
    const txt = fs.readFileSync(USERS_FILE, "utf8") || "[]";
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeUsers(v) {
  ensure();
  fs.writeFileSync(USERS_FILE, JSON.stringify(v || [], null, 2), "utf8");
}
const idKey = (v) => String(v ?? "").trim();
const sameId = (a, b) => idKey(a).replace(/^u/i, "") === idKey(b).replace(/^u/i, "");

/* =========================================================================
   INJECT RULES CRUD
   =======================================================================*/

/** List rules (optionally for a specific userId) */
router.get("/rules", (req, res) => {
  const userId = String(req.query.userId || "");
  const uid = userId ? userId.replace(/^u/i, "") : "";
  let items = readRules();

  if (uid) items = items.filter((r) => sameId(r.userId, uid));

  // normalize and sort by taskNo then createdAt
  items = items
    .map((r) => ({
      id: r.id,
      userId: String(r.userId || ""),
      taskNo: Number(r.taskNo || 0),
      amountSpec: String(r.amountSpec || ""),
      percent: r.percent != null ? Number(r.percent) : null,
      expectedIncome: r.expectedIncome != null ? Number(r.expectedIncome) : null,
      status: String(r.status || "confirmed"),
      createdAt: r.createdAt || nowISO(),
      usedAt: r.usedAt || null,
    }))
    .sort((a, b) => (a.taskNo || 0) - (b.taskNo || 0) || new Date(a.createdAt) - new Date(b.createdAt));

  res.json(items);
});

/** Create one rule */
router.post("/rules", (req, res) => {
  const b = req.body || {};
  const list = readRules();

  const rule = {
    id: String(b.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    userId: String(b.userId || ""),
    taskNo: Number(b.taskNo || 1),
    amountSpec: String(b.amountSpec || "0"),
    percent: b.percent != null ? Number(b.percent) : null,
    expectedIncome: b.expectedIncome != null ? Number(b.expectedIncome) : null,
    status: String(b.status || "confirmed"),
    createdAt: nowISO(),
    usedAt: null,
  };

  list.push(rule);
  writeRules(list);
  res.json({ ok: true, rule });
});

/** Update or mark used / confirm */
router.patch("/rules/:id", (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const list = readRules();
  const idx = list.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return res.status(404).json({ ok: false, msg: "not_found" });

  const r = list[idx];

  if (b.taskNo != null) r.taskNo = Number(b.taskNo);
  if (b.amountSpec != null) r.amountSpec = String(b.amountSpec);
  if (b.percent != null) r.percent = Number(b.percent);
  if (b.expectedIncome != null) r.expectedIncome = Number(b.expectedIncome);
  if (b.status != null) r.status = String(b.status);
  if (b.action === "confirm") r.status = "confirmed";
  if (b.action === "used" || r.status === "used") {
    r.status = "used";
    r.usedAt = nowISO();
  }

  list[idx] = r;
  writeRules(list);
  res.json({ ok: true, rule: r });
});

/** Delete a rule */
router.delete("/rules/:id", (req, res) => {
  const { id } = req.params;
  const left = readRules().filter((r) => String(r.id) !== String(id));
  writeRules(left);
  res.json({ ok: true, removed: 1 });
});

/** Purge all rules with status === 'used' */
router.post("/rules/purge-used", (_req, res) => {
  const before = readRules();
  const after = before.filter((r) => String(r.status || "") !== "used");
  writeRules(after);
  res.json({ ok: true, removed: before.length - after.length, left: after.length });
});

/* =========================================================================
   ✅ NEW: Admin change password (self OR any user)
   Frontend ke 2 calls yahin aayenge:
   - POST /api/admin/change-password  { oldPassword, newPassword }        -> admin apna
   - POST /api/admin/change-password  { userId, newPassword }             -> Manage User
   =======================================================================*/
router.post("/change-password", (req, res) => {
  const { userId, newPassword, oldPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ ok: false, message: "min_6" });
  }

  const users = readUsers();

  // A) Specific user (Manage dialog)
  if (userId) {
    const uid = String(userId).replace(/^u/i, "");
    const idx = users.findIndex((u) => String(u.id) === uid);
    if (idx < 0) return res.status(404).json({ ok: false, message: "user_not_found" });

    users[idx].password = String(newPassword);
    writeUsers(users);
    return res.json({ ok: true, userId: users[idx].id });
  }

  // B) Admin apna password (Settings tab)
  const admin = users.find((u) => u && u.isAdmin);
  if (!admin) return res.status(404).json({ ok: false, message: "admin_not_found" });

  if (String(admin.password) !== String(oldPassword || "")) {
    return res.status(400).json({ ok: false, message: "old_password_wrong" });
  }

  admin.password = String(newPassword);
  writeUsers(users);
  res.json({ ok: true });
});

module.exports = router;
