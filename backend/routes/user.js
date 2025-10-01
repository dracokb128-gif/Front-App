// backend/routes/user.js
// @ts-nocheck
const express = require("express");
import {
  users,            // in-memory array / persisted store
  addUser,          // (if you already have) create user helper
} from "../data/store.js";

const r = express.Router();

/* ---------- utils ---------- */
function pub(u) {
  // kabhi galti se password leak na ho
  const { password, ...safe } = u || {};
  return safe;
}
function nextId() {
  // simple id like "u5"
  const n = (users?.length || 0) + 1;
  return `u${n}`;
}

/* ---------- POST /api/register ---------- */
r.post("/register", (req, res) => {
  const { username = "", password = "", inviteCode = "" } = req.body || {};
  const uname = String(username).trim();
  const unameKey = uname.toLowerCase();

  if (!uname || !password || !inviteCode) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  // case-insensitive exists check
  const exists = (users || []).find(
    (u) => String(u.username || "").toLowerCase() === unameKey
  );
  if (exists) {
    return res.status(400).json({ ok: false, error: "Username already exists" });
  }

  const now = new Date().toISOString();

  const newUser = {
    id: nextId(),
    username: uname,                 // original casing save karo
    password: String(password),      // plain compare (no hash)
    inviteCode: String(inviteCode),
    createdAt: now,
    balance: 0,
    history: [],
    completedToday: 0,
    totalCompleted: 0,
    lastTaskDate: null,
  };

  if (typeof addUser === "function") addUser(newUser);
  else (users || []).push(newUser);

  return res.json({ ok: true, user: pub(newUser) });
});

/* ---------- POST /api/login ---------- */
r.post("/login", (req, res) => {
  const { username = "", password = "" } = req.body || {};
  const uname = String(username).trim();
  const unameKey = uname.toLowerCase();

  const list = users || [];
  // case-insensitive + trimmed username match
  const u = list.find(
    (x) => String(x.username || "").toLowerCase() === unameKey
  );

  if (!u || String(u.password) !== String(password)) {
    return res.status(400).json({ ok: false, error: "Invalid username or password" });
  }

  return res.json({ ok: true, user: pub(u) });
});

/* ---------- GET /api/users (list) ---------- */
r.get("/users", (_req, res) => {
  res.json({ ok: true, users: (users || []).map(pub) });
});

export default r;
