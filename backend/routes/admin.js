// backend/routes/admin.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const router = express.Router();

/* ---------- paths ---------- */
const DATA_DIR   = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const RULES_FILE = path.join(DATA_DIR, "injectRules.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

/* ---------- fs helpers ---------- */
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");
  if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, "[]", "utf8");
  if (!fs.existsSync(ADMIN_FILE)) {
    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ isSetup: false, username: "", passwordHash: "" }, null, 2),
      "utf8"
    );
  }
}
function readJSON(p, fallback) {
  ensure();
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}
function writeJSON(p, v) {
  ensure();
  fs.writeFileSync(p, JSON.stringify(v, null, 2), "utf8");
}

/* ----- files accessors ----- */
const readUsers = () => readJSON(USERS_FILE, []);
const writeUsers = (v) => writeJSON(USERS_FILE, v);
const readRules = () => readJSON(RULES_FILE, []);
const writeRules = (v) => writeJSON(RULES_FILE, v);
const readAdmin = () => readJSON(ADMIN_FILE, { isSetup: false, username: "", passwordHash: "" });
const writeAdmin = (v) => writeJSON(ADMIN_FILE, v);

const idKey = (v) => String(v ?? "").trim();
const sameId = (a, b) => idKey(a).replace(/^u/i, "") === idKey(b).replace(/^u/i, "");

/* =========================================================================
   ADMIN AUTH (uses admin.json)  ->  yahi Change Password ka sahi source hai
   =======================================================================*/

// Admin bootstrap: set first admin
router.post("/setup", async (req, res) => {
  const { username, password } = req.body || {};
  const a = readAdmin();
  if (a.isSetup) return res.status(409).json({ ok: false, message: "already_setup" });
  if (!username || !password) return res.status(400).json({ ok: false, message: "bad_request" });
  const passwordHash = await bcrypt.hash(String(password), 10);
  writeAdmin({ isSetup: true, username: String(username), passwordHash });
  res.json({ ok: true });
});

// Login admin
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const a = readAdmin();
  if (!a.isSetup) return res.status(400).json({ ok: false, message: "not_setup" });
  if (String(username) !== a.username) {
    return res.status(401).json({ ok: false, message: "invalid" });
  }
  const ok = await bcrypt.compare(String(password || ""), a.passwordHash || "");
  if (!ok) return res.status(401).json({ ok: false, message: "invalid" });
  // simple session via localStorage on client; we just say ok
  res.json({ ok: true, username: a.username });
});

// Change password (no user.json lookup!)
async function doChangePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  const a = readAdmin();
  if (!a.isSetup) return res.status(400).json({ ok: false, message: "not_setup" });

  const ok = await bcrypt.compare(String(oldPassword || ""), a.passwordHash || "");
  if (!ok) return res.status(401).json({ ok: false, message: "wrong_old_password" });

  const hash = await bcrypt.hash(String(newPassword || ""), 10);
  a.passwordHash = hash;
  writeAdmin(a);
  res.json({ ok: true });
}
// support both kebab & camel just in case frontend calls any
router.post("/change-password", doChangePassword);
router.post("/changePassword",  doChangePassword);

/* =========================================================================
   USERS (regular app users)  -> unchanged
   =======================================================================*/
router.get("/users", (_req, res) => {
  const users = readUsers().map((u) => ({
    id: u.id,
    username: u.username,
    balance: Number(u.balance || 0),
    inviteCode: u.inviteCode || "",
  }));
  res.json(users);
});

router.patch("/users/:id/balance", (req, res) => {
  const id = String(req.params.id || "");
  const delta = Number(req.body?.delta || 0);
  const users = readUsers();
  const u = users.find((x) => sameId(x.id, id));
  if (!u) return res.status(404).json({ ok: false, message: "User not found" });
  if (!Number.isFinite(delta) || delta === 0)
    return res.status(400).json({ ok: false, message: "Invalid delta" });

  u.balance = +Number((Number(u.balance || 0) + delta).toFixed(3));
  writeUsers(users);
  res.json({ ok: true, user: { id: u.id, balance: u.balance } });
});

router.delete("/users/:id", (req, res) => {
  const id = String(req.params.id || "");
  const users = readUsers().filter((x) => !sameId(x.id, id));
  writeUsers(users);
  res.json({ ok: true });
});

/* =========================================================================
   INJECT RULES CRUD  -> unchanged
   =======================================================================*/
router.get("/inject-rules", (req, res) => {
  const userId = String(req.query.userId || "");
  let list = readRules();
  if (userId) {
    const id = userId.replace(/^u/i, "");
    list = list.filter((r) => String(r.userId).replace(/^u/i, "") === id);
  }
  res.json(list.sort((a, b) => a.taskNo - b.taskNo));
});

router.post("/inject-rules", (req, res) => {
  const b = req.body || {};
  const list = readRules();
  const rule = {
    id: String(b.id || `rule_${Date.now()}`),
    userId: String(b.userId || ""),
    taskNo: Number(b.taskNo || 1),
    amountSpec: String(b.amountSpec || "0"),
    percent: b.percent != null ? Number(b.percent) : undefined,
    expectedIncome: b.expectedIncome != null ? Number(b.expectedIncome) : undefined,
    status: String(b.status || "draft"),
  };
  list.push(rule);
  writeRules(list);
  res.json({ rule });
});

router.patch("/inject-rules/:id", (req, res) => {
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
  if (b.action === "used" || b.status === "used") {
    list.splice(idx, 1);
    writeRules(list);
    return res.json({ removed: 1 });
  }

  list[idx] = r;
  writeRules(list);
  res.json({ rule: r });
});

router.delete("/inject-rules/:id", (req, res) => {
  const { id } = req.params;
  const list = readRules().filter((r) => String(r.id) !== String(id));
  writeRules(list);
  res.json({ removed: 1 });
});

module.exports = router;
