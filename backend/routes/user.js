// backend/routes/user.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ensureDaily } = require("../utils/taskEngine.js");

const r = express.Router();

/* ---------- storage (same as server.js) ---------- */
const DATA_DIR = fs.existsSync("/var/data")
  ? "/var/data"
  : path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");

const readUsers  = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; } };
const writeUsers = (v) => fs.writeFileSync(USERS_FILE, JSON.stringify(v, null, 2), "utf8");

/* ---------- helpers ---------- */
const INVITE_ONLY = "120236";
const pub = (u) => { if (!u) return u; const { password, ...rest } = u; return rest; };
const idKey  = (v) => String(v ?? "").trim();
const sameId = (a,b) => idKey(a).replace(/^u/i,"") === idKey(b).replace(/^u/i,"");

const wdHash = (s) => crypto.createHash("sha256").update(String(s || "")).digest("hex");
const ensureWd = (u) => {
  if (!u) return;
  if (typeof u.wd_pwd_set  === "undefined") u.wd_pwd_set  = false;
  if (typeof u.wd_pwd_hash === "undefined") u.wd_pwd_hash = null;
};

/* ---------- POST /api/register ---------- */
r.post("/register", (req, res) => {
  const b = req.body || {};
  const username   = String(b.username || "").trim();
  const password   = String(b.password || "").trim();
  const inviteCode = String(b.inviteCode || "").trim();

  if (!username || !password) return res.status(400).json({ ok:false, message:"Username & password required" });
  if (inviteCode !== INVITE_ONLY) return res.status(400).json({ ok:false, message:"Invalid invitation code" });

  const users = readUsers();
  if (users.some(u => String(u.username).toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ ok:false, message:"Username already exists" });

  const user = {
    id: users.reduce((m,u)=>Math.max(m, Number(u.id)||0),0)+1,
    username, password, balance:0, createdAt: Date.now(), inviteCode,
    isAdmin:false, completedToday:0, totalCompleted:0, lastTaskDate:null,
    history:[], pending:null, staged:null, daily:{}, overallCommission:0,
    isFrozen:false,
    wd_pwd_set:false, wd_pwd_hash:null, wd_pwd_updated_at:null,
  };
  ensureDaily(user);
  ensureWd(user);

  users.push(user);
  writeUsers(users);
  res.json({ ok:true, user: pub(user) });
});

/* ---------- POST /api/login ---------- */
r.post("/login", (req, res) => {
  const b = req.body || {};
  const username = String(b.username||"").trim();
  const password = String(b.password||"").trim();
  if (!username || !password) return res.status(400).json({ ok:false, message:"Username & password required" });

  const users = readUsers();
  const u = users.find(x => String(x.username).toLowerCase() === username.toLowerCase());
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (String(u.password) !== password) return res.status(401).json({ ok:false, message:"Wrong password" });

  ensureDaily(u);
  ensureWd(u);
  writeUsers(users);
  res.json({ ok:true, user: pub(u) });
});

/* ---------- POST /api/change-password ---------- */
r.post("/change-password", (req, res) => {
  const b = req.body || {};
  const oldPassword = String(b.oldPassword || "");
  const newPassword = String(b.newPassword || "");
  const userId = b.userId != null ? String(b.userId) : "";
  const username = String(b.username || "");
  if (!oldPassword || !newPassword) return res.status(400).json({ ok:false, message:"Old & new passwords required" });

  const users = readUsers();
  let u = null;
  if (userId) u = users.find(x => sameId(x.id, userId));
  if (!u && username) u = users.find(x => String(x.username).toLowerCase() === username.toLowerCase());
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (String(u.password) !== oldPassword) return res.status(401).json({ ok:false, message:"Old password incorrect" });
  u.password = String(newPassword);
  writeUsers(users);
  res.json({ ok:true });
});

/* ---------- GET /api/users (limited public list) ---------- */
r.get("/users", (_req, res) => {
  const out = readUsers().map(u => ({ id:u.id, username:u.username, balance:Number(u.balance||0), createdAt:u.createdAt }));
  res.json({ ok:true, users: out });
});

module.exports = r;
