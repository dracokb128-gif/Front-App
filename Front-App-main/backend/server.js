// backend/server.js — strict tier gating + tasks, deposits, withdrawals, wallet, avatar
const { readJSONCached, writeJSONCached } = require("./cache");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ensureDaily, todayKey, MAX_TASKS_PER_DAY } = require("./utils/taskEngine.js");

/* -------------------- helpers -------------------- */
function readJSON(p){ return readJSONCached(p); }
function writeJSON(p,v){ return writeJSONCached(p,v); }
function nowISO(){ return new Date().toISOString(); }

/* -------------------- app -------------------- */
const app = express();

/* ✅ CORS allow-list (Netlify + local dev) */
/* ✅ CORS allow-list (Netlify + local dev) */
const ALLOWED = new Set([
  "https://cool-smakager-8f8747.netlify.app",  
  "https://dhwin.app",
  "https://www.dhwin.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://front-app-l9ux.onrender.com" // <--- YE LINE ADD KARO
]);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED.has(origin)),
  credentials: true
}));

// ⬇️ allow big base64 images
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* optional: simple root health */
app.get("/", (_req, res) => res.send("OK"));

/* -------------------- storage paths (UNIFIED) -------------------- */
const DATA_DIR =
  process.env.DATA_DIR ||
  (fs.existsSync("/var/data") ? "/var/data" : path.join(__dirname, "data"));
const USERS_FILE = path.join(DATA_DIR, "users.json");
const RULES_FILE = path.join(DATA_DIR, "injectRules.json");

if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE))   fs.writeFileSync(USERS_FILE, "[]", "utf8");
if (!fs.existsSync(RULES_FILE))   fs.writeFileSync(RULES_FILE, "[]", "utf8");

/* deposits / addresses */
const DEPOSITS_FILE  = path.join(DATA_DIR, "deposits.json");
if (!fs.existsSync(DEPOSITS_FILE)) fs.writeFileSync(DEPOSITS_FILE, "[]", "utf8");

/* addresses.json: single location inside DATA_DIR */
const ADDR_PRIMARY = path.join(DATA_DIR, "addresses.json");
const ADDR_FILES   = [ADDR_PRIMARY];

function ensureAddrFiles() {
  for (const f of ADDR_FILES) {
    try {
      const d = path.dirname(f);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      if (!fs.existsSync(f)) fs.writeFileSync(f, "[]", "utf8");
    } catch {}
  }
}
ensureAddrFiles();

/* withdrawals & wallet */
const WITHDRAWALS_FILE = path.join(DATA_DIR, "withdrawals.json");
if (!fs.existsSync(WITHDRAWALS_FILE)) fs.writeFileSync(WITHDRAWALS_FILE, "[]", "utf8");

const WALLETS_FILE = path.join(DATA_DIR, "wallet.json");
if (!fs.existsSync(WALLETS_FILE)) fs.writeFileSync(WALLETS_FILE, "[]", "utf8");

/* ===== Customer Service (CS) link storage ===== */
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, "{}", "utf8");

const readSettings  = () => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8") || "{}"); } catch { return {}; } };
const writeSettings = (obj) => fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2), "utf8");

/* file readers/writers */
const readUsers = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; } };
const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2), "utf8");

const readRules = () => { try { return JSON.parse(fs.readFileSync(RULES_FILE, "utf8")); } catch { return []; } };
const writeRules = (r) => fs.writeFileSync(RULES_FILE, JSON.stringify(r, null, 2), "utf8");

function readAddrs() {
  for (const f of ADDR_FILES) {
    try {
      const txt = fs.readFileSync(f, "utf8") || "[]";
      const arr = JSON.parse(txt);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  return readJSON(ADDR_PRIMARY);
}
function writeAddrs(v) {
  for (const f of ADDR_FILES) {
    try { fs.writeFileSync(f, JSON.stringify(v, null, 2), "utf8"); } catch {}
  }
}

const readDepos  = () => readJSON(DEPOSITS_FILE);
const writeDepos = (v) => writeJSON(DEPOSITS_FILE, v);

const readWithdrawals  = () => readJSON(WITHDRAWALS_FILE);
const writeWithdrawals = (v) => writeJSON(WITHDRAWALS_FILE, v);

const readWallets  = () => readJSON(WALLETS_FILE);
const writeWallets = (v) => writeJSON(WALLETS_FILE, v);

/* utils */
const pub = (u) => { if (!u) return u; const { password, ...rest } = u; return rest; };
const idKey = (v) => String(v ?? "").trim();
const sameId = (a,b) => idKey(a).replace(/^u/i,"") === idKey(b).replace(/^u/i,"");

/* -------------------- WD password helpers -------------------- */
const wdHash = (s) => crypto.createHash("sha256").update(String(s || "")).digest("hex");
const ensureWd = (u) => {
  if (!u) return;
  if (typeof u.wd_pwd_set  === "undefined") u.wd_pwd_set  = false;
  if (typeof u.wd_pwd_hash === "undefined") u.wd_pwd_hash = null;
};

(function ensureWdFieldsOnce(){
  const users = readUsers();
  let changed = 0;
  users.forEach(u => {
    const before = JSON.stringify([u.wd_pwd_set, u.wd_pwd_hash]);
    ensureWd(u);
    const after  = JSON.stringify([u.wd_pwd_set, u.wd_pwd_hash]);
    if (before !== after) changed++;
  });
  if (changed) writeUsers(users);
  console.log(`✓ wd fields ok (${users.length} users)`);
})();

/* -------------------- store/rate helpers -------------------- */
function rateByStore(store = "amazon") {
  const s = String(store).toLowerCase();
  if (s === "aliexpress") return 0.12;
  if (s === "alibaba")   return 0.08;
  return 0.04;
}
function pickAmount(spec) {
  const s = String(spec || "").trim();
  if (!s) return 0;
  if (s.includes("-")) {
    const [a,b] = s.split("-").map(n => Number(n.trim()));
    const lo = Math.min(a,b), hi = Math.max(a,b);
    return Math.round(lo + Math.random()*(hi-lo));
  }
  return Number(s);
}
function defaultRateByAmount(amount) {
  if (amount >= 901) return 0.12;
  if (amount >= 499) return 0.08;
  if (amount >= 20)  return 0.04;
  return 0.04;
}
function makeCombineItems(amount) {
  const stock = [
    { title:"Tablet Case",        price:10.02 },
    { title:"Power Bank 10k",     price:21.76 },
    { title:"Tripod Stand",       price:14.60 },
    { title:"Wireless Headphone", price:38.92 },
    { title:"USB-C Cable Pack",   price:6.99  },
  ];
  const out = [];
  let left = Number(amount) || 80;
  for (let i=0;i<5;i++){
    const s = stock[i%stock.length];
    {
      const theQty = 1 + Math.floor(Math.random()*3);
      const unit = Math.round(s.price*(0.9+Math.random()*0.25)*100)/100;
      out.push({ title:s.title, quantity:theQty, unitPrice:unit });
      left -= unit*theQty;
    }
    if (left <= 5) break;
  }
  return out;
}
function buildCombineTaskFromRule(rule, balance) {
  const amount = pickAmount(rule.amountSpec);
  const rate = rule.percent != null ? Number(rule.percent)/100 : defaultRateByAmount(amount);
  const commission = +Number(amount * rate).toFixed(3);
  const items = makeCombineItems(amount);
  const deficit = Math.max(0, Number((amount - Number(balance||0)).toFixed(3)));
  return {
    id: `t_${Date.now()}`,
    kind: "combine",
    type: "combined",
    orderAmount: amount,
    commission,
    commissionRate: rate,
    items,
    deficit,
    __ruleId: String(rule.id || ""),
  };
}
function getDaySlot(u){
  const key = ensureDaily(u);
  if (!u.daily[key]) u.daily[key] = { completed:0, commission:0, seenTotalsCents:[] };
  if (!Array.isArray(u.daily[key].seenTotalsCents)) u.daily[key].seenTotalsCents = [];
  return { key, day: u.daily[key] };
}
function markTotalSeen(u, totalCents){
  const { day } = getDaySlot(u);
  const v = Math.max(0, Math.round(Number(totalCents||0)));
  if (!day.seenTotalsCents.includes(v)) day.seenTotalsCents.push(v);
}
const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
function randomUniqueOrderWithinBalance(u, balance){
  const maxCents = Math.max(100, Math.floor(Number(balance||0) * 100));
  const minUnitCents = 100;
  const maxQty = 30;
  const { day } = getDaySlot(u);
  const seen = new Set(day.seenTotalsCents || []);
  for (let tries=0; tries<400; tries++){
    let qty = ri(1, maxQty);
    let maxUnitForQty = Math.floor(maxCents / qty);
    if (maxUnitForQty < minUnitCents) {
      qty = 1; maxUnitForQty = maxCents;
      if (maxUnitForQty < minUnitCents) break;
    }
    const unitCents = ri(minUnitCents, maxUnitForQty);
    const totalCents = unitCents * qty;
    if (totalCents <= maxCents && !seen.has(totalCents)){
      return { unitPrice: +(unitCents/100).toFixed(2), quantity: qty, orderAmount: +(totalCents/100).toFixed(2) };
    }
  }
  for (let qty=1; qty<=maxQty; qty++){
    const maxUnitForQty = Math.floor(maxCents/qty);
    if (maxUnitForQty < minUnitCents) continue;
    for (let unitCents=minUnitCents; unitCents<=maxUnitForQty; unitCents++){
      const totalCents = unitCents * qty;
      if (!seen.has(totalCents)){
        return { unitPrice: +(unitCents/100).toFixed(2), quantity: qty, orderAmount: +(totalCents/100).toFixed(2) };
      }
    }
  }
  return { unitPrice: 1.00, quantity: 1, orderAmount: 1.00 };
}
function buildNormalPreview(u, store="amazon") {
  const { unitPrice, quantity, orderAmount } = randomUniqueOrderWithinBalance(u, Number(u.balance||0));
  const rate = rateByStore(store);
  const commission = +(orderAmount * rate).toFixed(3);
  markTotalSeen(u, Math.round(orderAmount*100));
  return { id:`t_${Date.now()}`, store, kind:"single", type:"single", title:"Order", unitPrice, quantity, orderAmount, commission, commissionRate:rate };
}

/* -------------------- health -------------------- */
app.get("/api/health", (_req,res)=>res.json({ ok:true }));
app.get("/api/_debug/paths", (_req, res) => {
  res.json({
    cwd: process.cwd(),
    __dirname,
    DATA_DIR,
    WALLETS_FILE,
    depositsFile: DEPOSITS_FILE,
    addrFiles: ADDR_FILES,
    walletsExists: fs.existsSync(WALLETS_FILE),
    walletsSize: fs.existsSync(WALLETS_FILE) ? fs.statSync(WALLETS_FILE).size : 0,
    settingsFile: SETTINGS_FILE
  });
});
app.get("/api/debug/users", (_req, res) => {
  try {
    const users = readUsers();
    res.json({ ok:true, count: users.length });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/* -------------------- AVATAR (DP) SUPPORT -------------------- */
const AVATAR_DIR = path.join(DATA_DIR, "avatars");
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
app.use("/static", express.static(DATA_DIR));
function saveBase64Image(dataURL, outName) {
  const m = dataURL.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Bad image");
  const meta = m[1];
  const base64 = m[2];
  const ext = meta.includes("png") ? "png" : "jpg";
  const file = path.join(AVATAR_DIR, `${outName}.${ext}`);
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return `/static/avatars/${outName}.${ext}`;
}
app.post("/api/users/:uid/avatar", (req,res)=>{
  try {
    const uid = String(req.params.uid);
    const { dataURL } = req.body || {};
    if (!dataURL) return res.status(400).json({ error:"Missing image" });
    const url = saveBase64Image(dataURL, `u_${uid}`);
    const users = readUsers();
    const i = users.findIndex(u => sameId(u.id, uid));
    if (i >= 0) users[i].avatar = url; else users.push({ id: uid, avatar: url });
    writeUsers(users);
    res.json({ ok:true, avatar:url });
  } catch(e){ res.status(500).json({ error:e.message }); }
});
app.get("/api/users/:uid/avatar", (req,res)=>{
  const uid = String(req.params.uid);
  const users = readUsers();
  const u = users.find(x => sameId(x.id, uid));
  res.json({ avatar: u?.avatar || null });
});
app.delete("/api/users/:uid/avatar", (req,res)=>{
  const uid = String(req.params.uid);
  try {
    const p1 = path.join(AVATAR_DIR, `u_${uid}.jpg`);
    const p2 = path.join(AVATAR_DIR, `u_${uid}.png`);
    [p1,p2].forEach(p=>{ if (fs.existsSync(p)) fs.unlinkSync(p); });
    const users = readUsers();
    const i = users.findIndex(u => sameId(u.id, uid));
    if (i>=0) delete users[i].avatar;
    writeUsers(users);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:e.message }); }
});

/* -------------------- auth -------------------- */
const INVITE_ONLY = "120236";
app.post("/api/register", (req,res)=>{
  const b = req.body || {};
  const username = String(b.username||"").trim();
  const password = String(b.password||"").trim();
  const inviteCode = String(b.inviteCode||"").trim();
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
  users.push(user);
  writeUsers(users);
  res.json({ ok:true, user: pub(user) });
});
app.post("/api/login", (req,res)=>{
  const b = req.body || {};
  const username = String(b.username||"").trim();
  const password = String(b.password||"").trim();
  if (!username || !password) return res.status(400).json({ ok:false, message:"Username & password required" });
  const users = readUsers();
  const u = users.find(x => String(x.username).toLowerCase() === username.toLowerCase());
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (String(u.password) !== password) return res.status(401).json({ ok:false, message:"Wrong password" });
  ensureDaily(u); ensureWd(u);
  if (!("staged" in u)) u.staged = null;
  if (!("overallCommission" in u)) u.overallCommission = 0;
  if (!("isFrozen" in u)) u.isFrozen = false;
  writeUsers(users);
  res.json({ ok:true, user: pub(u) });
});

/* user change password */
app.post("/api/change-password", (req, res) => {
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

/* -------------------- admin user ops -------------------- */
app.get("/api/admin/users", (_req,res)=>{
  const out = readUsers().map(u => ({
    id:u.id, username:u.username, balance:Number(u.balance||0),
    inviteCode:u.inviteCode||"", isFrozen: !!u.isFrozen
  }));
  res.json(out);
});
app.patch("/api/admin/users/:id/balance", (req,res)=>{
  const id = String(req.params.id||"");
  const delta = Number(req.body?.delta || 0);
  const users = readUsers();
  const u = users.find(x => sameId(x.id,id));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ ok:false, message:"Invalid amount" });
  u.balance = Number((Number(u.balance||0)+delta).toFixed(3));
  if (u.pending && Number(u.pending.orderAmount)) {
    const need = Math.max(0, Number(u.pending.orderAmount) - Number(u.balance||0));
    u.pending.deficit = Number(need.toFixed(3));
  }
  writeUsers(users);
  res.json({ ok:true, user: pub(u) });
});
app.delete("/api/admin/users/:id",(req,res)=>{
  const id = String(req.params.id||"");
  const users = readUsers().filter(x => !sameId(x.id,id));
  writeUsers(users);
  res.json({ ok:true });
});
app.patch("/api/admin/users/:id/freeze", (req, res) => {
  const id = String(req.params.id || "");
  const frozen = req.body && typeof req.body.frozen !== "undefined" ? !!req.body.frozen : true;
  const users = readUsers();
  const u = users.find(x => sameId(x.id, id));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  u.isFrozen = !!frozen;
  writeUsers(users);
  res.json({ ok:true, user: pub(u) });
});
app.post("/api/admin/approve/:id", (req,res)=>{
  const id = String(req.params.id||"");
  const users = readUsers();
  const u = users.find(x => sameId(x.id,id));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  const key = ensureDaily(u);
  u.daily[key] = { completed:0, commission:0, seenTotalsCents:[] };
  u.completedToday = 0;
  u.pending = null;
  u.staged = null;
  writeUsers(users);
  res.json({ ok:true, user: pub(u) });
});
app.post("/api/admin/reset-daily", (_req,res)=>{
  const users = readUsers();
  users.forEach(u=>{
    const key = ensureDaily(u);
    u.daily[key] = { completed:0, commission:0, seenTotalsCents:[] };
    u.completedToday = 0;
    u.pending = null;
    u.staged = null;
  });
  writeUsers(users);
  res.json({ ok:true, count: users.length });
});
app.post("/api/admin/reset-full", (_req,res)=>{
  const users = readUsers();
  users.forEach(u=>{
    u.daily = {};
    u.completedToday = 0;
    u.overallCommission = Number(u.overallCommission||0);
    u.pending = null;
    u.staged = null;
    u.history = [];
  });
  writeUsers(users);
  res.json({ ok:true, count: users.length });
});

/* -------------------- Admin: Deposits & Addresses -------------------- */
app.get("/api/admin/deposits", (req, res) => {
  const q = String(req.query.status || "").toUpperCase();
  let items = readJSON(DEPOSITS_FILE);
  if (q) items = items.filter(d => d.status === q);
  items.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, items });
});
app.post("/api/admin/deposits/:id/approve", (req, res) => {
  const id = req.params.id;
  const deposits = readJSON(DEPOSITS_FILE);
  const users = readUsers();
  const addrs = readAddrs();
  const dep = deposits.find(d => d.id === id);
  if (!dep) return res.status(404).json({ ok:false, msg:"Not found" });
  if (dep.status !== "PENDING") return res.json({ ok:true, msg:"Already processed", dep });

  const u = users.find(x => sameId(x.id, dep.userId));
  if (!u) return res.status(400).json({ ok:false, msg:"User missing" });
  u.balance = Number((Number(u.balance||0) + Number(dep.amount||0)).toFixed(3));

  dep.status = "APPROVED";
  dep.reviewNote = req.body?.note || "";
  dep.reviewedAt = nowISO();

  if (dep.address) {
    const a = addrs.find(a => a.address === dep.address);
    if (a) { a.isAssigned = false; a.currentDepositId = null; }
  }
  writeUsers(users);
  writeJSON(DEPOSITS_FILE, deposits);
  writeAddrs(addrs);
  res.json({ ok:true, dep });
});
app.post("/api/admin/deposits/:id/reject", (req, res) => {
  const id = req.params.id;
  const deposits = readJSON(DEPOSITS_FILE);
  const addrs = readAddrs();
  const dep = deposits.find(d => d.id === id);
  if (!dep) return res.status(404).json({ ok:false, msg:"Not found" });
  if (dep.status !== "PENDING") return res.json({ ok:true, msg:"Already processed", dep });

  dep.status = "REJECTED";
  dep.reviewNote = req.body?.note || "";
  dep.reviewedAt = nowISO();

  if (dep.address) {
    const a = addrs.find(a => a.address === dep.address);
    if (a) { a.isAssigned = false; a.currentDepositId = null; }
  }
  writeJSON(DEPOSITS_FILE, deposits);
  writeAddrs(addrs);
  res.json({ ok:true, dep });
});
app.get("/api/admin/addresses", (_req, res) => {
  const addrs = readAddrs();
  addrs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, items: addrs });
});
app.post("/api/admin/addresses", (req, res) => {
  let list = req.body?.addresses;
  if (typeof list === "string") list = list.split(/\r?\n|,|;/);
  if (!Array.isArray(list)) list = [];
  const clean = list.map(s => String(s || "").trim()).filter(Boolean);

  const addrs = readAddrs();
  const have = new Set(addrs.map(a => a.address));
  const toAdd = [];
  clean.forEach(addr => {
    if (!have.has(addr)) {
      have.add(addr);
      toAdd.push({
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        address: addr, isAssigned:false, currentDepositId:null, createdAt: nowISO(),
      });
    }
  });
  const merged = [...toAdd, ...addrs];
  writeAddrs(merged);
  res.json({ ok: true, added: toAdd.length, items: merged });
});
app.delete("/api/admin/addresses/:address", (req, res) => {
  const addr = decodeURIComponent(req.params.address || "");
  const addrs = readAddrs();
  const a = addrs.find(x => x.address === addr);
  if (!a) return res.status(404).json({ ok: false, msg: "Not found" });
  if (a.isAssigned) return res.status(400).json({ ok: false, msg: "Address is assigned to a pending deposit" });
  const left = addrs.filter(x => x.address !== addr);
  writeAddrs(left);
  res.json({ ok: true });
});

/* -------------------- records/progress -------------------- */
app.get("/api/records", (req,res)=>{
  const id = String(req.query.userId || "");
  const users = readUsers();
  const u = users.find(x => sameId(x.id,id));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  ensureDaily(u);
  writeUsers(users);
  const incomplete = [];
  if (u.pending) incomplete.push(u.pending);
  res.json({ ok:true, unpaid:u.pending||null, records:u.history||[], incomplete });
});
app.get("/api/progress", (req,res)=>{
  const id = String(req.query.userId || "");
  const users = readUsers();
  const u = users.find(x => sameId(x.id,id));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  const key = ensureDaily(u);
  const day = u.daily[key] || { completed:0, commission:0, seenTotalsCents:[] };
  let liveGap = 0;
  if (u.pending && Number(u.pending.orderAmount)) {
    liveGap = Math.max(0, Number(u.pending.orderAmount) - Number(u.balance||0));
    u.pending.deficit = Number(liveGap.toFixed(3));
    writeUsers(users);
  }
  res.json({
    ok: true,
    completedToday: Number(day.completed||0),
    totalCompleted: Number((u.history || []).length || 0),
    maxTasksPerDay: MAX_TASKS_PER_DAY || 25,
    balance: Number(u.balance||0),
    todayCommission: Number(day.commission||0),
    overallCommission: Number(u.overallCommission||0),
    cashGap: Number(liveGap || 0),
    unpaid: u.pending || null,
    isFrozen: !!u.isFrozen,
    wdPwdSet: !!u.wd_pwd_set,
  });
});

/* -------------------- task flow -------------------- */
app.post("/api/task/next", (req,res)=>{
  const b = req.body||{};
  const userId = String(b.userId || "");
  const store = String(b.store || "amazon").toLowerCase();
  const users = readUsers();
  const u = users.find(x => sameId(x.id,userId));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (u.isFrozen) return res.json({ notEligible:true, message:"Your account is frozen. Please contact customer support for further assistance" });

  const key = ensureDaily(u);
  const day = u.daily[key] || { completed:0, commission:0, seenTotalsCents:[] };
  if (Number(day.completed||0) >= (MAX_TASKS_PER_DAY||25))
    return res.json({ noMore:true, message:"No More Tasks" });
  if (u.pending) return res.json({ unpaid: u.pending });

  const bal = Number(u.balance || 0);
  if (store === "amazon" && bal > 498) {
    const msg = " is more than 498 USDT. Please continue with Alibaba or AliExpressYour balance.";
    return res.json({ notEligible:true, message: msg, suggestUpgrade:true, suggestMessage: msg });
  }
  if (store === "alibaba") {
    if (bal < 499) {
      const msg = "Alibaba requires a balance between 499–900 USDT.";
      return res.json({ notEligible:true, message: msg, suggestUpgrade:true, suggestMessage: msg });
    }
    if (bal >= 901) {
      const msg = "Your Balnce is more than 900 USDT Please continue with Alibaba or AliExpress";
      return res.json({ notEligible:true, message: msg, suggestUpgrade:true, suggestMessage: msg });
    }
  }
  if (store === "aliexpress" && bal < 901) {
    const msg = "AliExpress requires a balance of 901 USDT.";
    return res.json({ notEligible:true, message: msg, suggestUpgrade:true, suggestMessage: msg });
  }

  const currentTaskNo = Number(day.completed || 0) + 1;
  const rules = readRules()
    .filter(r => sameId(r.userId, userId) && String(r.status || "").toLowerCase() === "confirmed")
    .sort((a,b)=> (a.taskNo||0) - (b.taskNo||0));
  const exact = rules.find(r => Number(r.taskNo||0) === currentTaskNo);
  const task = exact ? buildCombineTaskFromRule(exact, u.balance) : buildNormalPreview(u, store);
  u.staged = task;
  writeUsers(users);
  res.json({ ok:true, task });
});

/* stage -> pending */
app.post("/api/submit-unpaid", (req, res) => {
  const b = req.body || {};
  const userId = String(b.userId || "");
  const task = b.task || null;
  const users = readUsers();
  const u = users.find((x) => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok: false, message: "User not found" });

  if (task) u.pending = task; else if (u.staged) u.pending = u.staged;
  if (u.pending && Number(u.pending.orderAmount)) {
    const need = Math.max(0, Number(u.pending.orderAmount) - Number(u.balance || 0));
    u.pending.deficit = Number(need.toFixed(3));
  }
  try {
    if (u.pending && u.pending.__ruleId) {
      const rules = readRules();
      const rr = rules.find((r) => String(r.id) === String(u.pending.__ruleId));
      if (rr && rr.status !== "used") {
        rr.status = "used"; rr.used = true; rr.usedAt = nowISO(); writeRules(rules);
      }
    }
  } catch {}
  u.staged = null;
  writeUsers(users);
  res.json({ ok: true, unpaid: u.pending || null });
});
app.post("/api/task/mark-unpaid", (req,res)=> { req.url="/api/submit-unpaid"; app._router.handle(req,res); });
app.post("/api/task/submit-unpaid", (req,res)=> { req.url="/api/submit-unpaid"; app._router.handle(req,res); });
app.post("/api/task/incomplete", (req,res)=> { req.url="/api/submit-unpaid"; app._router.handle(req,res); });
app.post("/api/task/unpaid", (req,res)=> { req.url="/api/submit-unpaid"; app._router.handle(req,res); });

/* complete order */
app.post("/api/complete", (req,res)=>{
  const b = req.body||{};
  const userId = String(b.userId||"");
  const orderId = String(b.orderId||"");
  const users = readUsers();
  const u = users.find(x => sameId(x.id,userId));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  const task = (u.pending && u.pending.id === orderId && u.pending) || (u.staged && u.staged.id === orderId && u.staged) || null;
  if (!task) return res.status(400).json({ ok:false, message:"No such pending task" });

  const orderAmount = Number(task.orderAmount||0);
  const commission  = Number(task.commission||0);
  const bal = Number(u.balance || 0);
  const liveNeedRaw = orderAmount - bal;
  const theNeed = Number(Math.max(0, +liveNeedRaw.toFixed(3)).toFixed(3));
  const EPS = 0.0005;
  if (theNeed > EPS) return res.status(400).json({ ok:false, needRecharge:true, deficit: theNeed });

  try {
    if (task && task.__ruleId) {
      const rules = readRules();
      const rr = rules.find((r) => String(r.id) === String(task.__ruleId));
      if (rr && rr.status !== "used") {
        rr.status = "used"; rr.used = true; rr.usedAt = nowISO(); writeRules(rules);
      }
    }
  } catch {}

  u.balance = Number((bal + commission).toFixed(3));
  u.overallCommission = Number((Number(u.overallCommission||0) + commission).toFixed(3));
  const key = ensureDaily(u);
  if (!u.daily[key]) u.daily[key] = { completed:0, commission:0, seenTotalsCents:[] };
  u.daily[key].completed  = Number(u.daily[key].completed||0) + 1;
  u.daily[key].commission = Number((Number(u.daily[key].commission||0) + commission).toFixed(3));

  if (!Array.isArray(u.history)) u.history = [];
  const snapshot = u.pending || u.staged || task;
  u.history.unshift({
    id: orderId,
    kind: task.kind,
    orderAmount,
    commission,
    at: Date.now(),
    taskSnapshot: snapshot
  });

  u.pending = null; u.staged = null;
  writeUsers(users);
  res.json({ ok:true });
});
app.post("/api/task/submit", (req,res)=>{
  const b = req.body||{};
  req.body = { userId: b.userId, orderId: b.taskId || b.orderId || b.id };
  req.url = "/api/complete";
  app._router.handle(req,res);
});

/* -------------------- WD PASSWORD -------------------- */
app.post("/api/wd/set-password", (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) return res.status(400).json({ ok:false, msg:"userId & password required" });
  const users = readUsers();
  const u = users.find(x => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok:false, msg:"User not found" });
  ensureWd(u);
  if (u.wd_pwd_set) return res.status(409).json({ ok:false, msg:"Already set" });
  u.wd_pwd_hash = crypto.createHash("sha256").update(String(password)).digest("hex");
  u.wd_pwd_set = true;
  u.wd_pwd_updated_at = nowISO();
  writeUsers(users);
  res.json({ ok:true });
});
app.post("/api/wd/change-password", (req, res) => {
  const { userId, oldPassword, newPassword } = req.body || {};
  if (!userId || !oldPassword || !newPassword) return res.status(400).json({ ok:false, msg:"Missing fields" });
  const users = readUsers();
  const u = users.find(x => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok:false, msg:"User not found" });
  ensureWd(u);
  if (!u.wd_pwd_set || !u.wd_pwd_hash) return res.status(400).json({ ok:false, msg:"Not set yet" });
  if (u.wd_pwd_hash !== crypto.createHash("sha256").update(String(oldPassword)).digest("hex"))
    return res.status(401).json({ ok:false, msg:"Old password wrong" });
  u.wd_pwd_hash = crypto.createHash("sha256").update(String(newPassword)).digest("hex");
  u.wd_pwd_updated_at = nowISO();
  writeUsers(users);
  res.json({ ok:true });
});
app.post("/api/wd/verify", (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) return res.status(400).json({ ok:false, msg:"Missing fields" });
  const users = readUsers();
  const u = users.find(x => sameId(x.id, userId));
  ensureWd(u);
  if (!u) return res.status(404).json({ ok:false, msg:"User not found" });
  const ok = !!u.wd_pwd_set && u.wd_pwd_hash === crypto.createHash("sha256").update(String(password)).digest("hex");
  return ok ? res.json({ ok:true }) : res.status(401).json({ ok:false, msg:"Invalid password" });
});
app.post("/api/admin/wd/set", (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ ok:false, msg:"userId & newPassword required" });
  const users = readUsers();
  const u = users.find(x => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok:false, msg:"User not found" });
  ensureWd(u);
  u.wd_pwd_hash = crypto.createHash("sha256").update(String(newPassword)).digest("hex");
  u.wd_pwd_set = true;
  u.wd_pwd_updated_at = nowISO();
  writeUsers(users);
  res.json({ ok:true });
});

/* -------------------- USER WALLET -------------------- */
app.get("/api/wallet/address", (req, res) => {
  const uid = String(req.query.userId || "").replace(/^u/i,"");
  if (!uid) return res.status(400).json({ ok:false, msg:"userId required" });
  const list = readWallets();
  const w = list.find(x => String(x.userId) === uid);
  return res.json({ ok:true, address: (w && w.address) || "", wallet: w || null });
});
app.post("/api/wallet/set", (req, res) => {
  const { userId, address = "", network = "TRC-20", walletName = "My wallet" } = req.body || {};
  const uid = String(userId || "").replace(/^u/i,"");
  if (!uid || !address) return res.status(400).json({ ok:false, msg:"userId & address required" });

  const list = readWallets();
  const idx = list.findIndex(x => String(x.userId) === uid);
  const item = { userId: uid, address, network, walletName, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = item; else list.push(item);
  writeWallets(list);
  res.json({ ok:true, address, wallet: item });
});
app.get("/api/change-wallet-address", (req, res) => {
  const uid = String(req.query.userId || "").replace(/^u/i,"");
  const address = String(req.query.address || "");
  const network = String(req.query.network || "TRC-20");
  if (!uid || !address) return res.status(400).json({ ok:false, msg:"userId & address required" });

  const list = readWallets();
  const idx = list.findIndex(x => String(x.userId) === uid);
  const item = { userId: uid, address, network, walletName:"My wallet", updatedAt: Date.now() };
  if (idx >= 0) list[idx] = item; else list.push(item);
  writeWallets(list);
  res.json({ ok:true, address, wallet:item });
});

/* -------------------- WITHDRAWALS -------------------- */
function canWithdrawRule(u) {
  const key = ensureDaily(u);
  const day = u.daily[key] || { completed: 0 };
  const done = Number(day.completed || 0);
  return done === 0 || done >= 25;
}
app.post("/api/withdraw/submit", (req, res) => {
  const { userId, amount, address = "", network = "TRC-20" } = req.body || {};
  const uid = String(userId || "").replace(/^u/i, "");
  const amt = Number(amount || 0);
  if (!uid || !Number.isFinite(amt) || amt < 20) {
    return res.status(400).json({ ok:false, message:"Minimum amount is 20 USDT" });
  }
  const users = readUsers();
  const u = users.find(x => sameId(x.id, uid));
  if (!u) return res.status(404).json({ ok:false, message:"User not found" });
  if (u.isFrozen) return res.status(403).json({ ok:false, message:"Account frozen" });

  if (!canWithdrawRule(u)) {
    return res.status(400).json({ ok:false, message:"Complete All Tasks" });
  }
  const ws = readWithdrawals();
  const hasPending = ws.some(w => sameId(w.userId, uid) && w.status === "PENDING");
  if (hasPending) return res.status(409).json({ ok:false, message:"One withdrawal already pending" });

  const bal = Number(u.balance || 0);
  if (bal < amt) return res.status(400).json({ ok:false, message:"Insufficient balance" });

  u.balance = Number((bal - amt).toFixed(3));
  writeUsers(users);

  const item = {
    id: "w_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
    userId: String(u.id),
    amount: Number(amt.toFixed(3)),
    address, network,
    status: "PENDING",
    createdAt: nowISO()
  };
  ws.unshift(item);
  writeWithdrawals(ws);
  res.json({ ok:true, item, newBalance: u.balance });
});
app.post("/api/withdraw/request", (req, res) => {
  req.url = "/api/withdraw/submit";
  app._router.handle(req, res, () => {});
});
app.get("/api/admin/withdrawals", (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  let items = readWithdrawals();
  if (status && status !== "ALL") items = items.filter(w => w.status === status);
  items.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, items });
});
app.post("/api/admin/withdrawals/:id/approve", (req, res) => {
  const { id } = req.params;
  const ws = readWithdrawals();
  const w = ws.find(x => String(x.id) === String(id));
  if (!w) return res.status(404).json({ ok:false, message:"Not found" });
  if (w.status !== "PENDING") return res.json({ ok:true, item:w });
  w.status = "APPROVED";
  w.decidedAt = nowISO();
  writeWithdrawals(ws);
  res.json({ ok:true, item:w });
});
app.post("/api/admin/withdrawals/:id/reject", (req, res) => {
  const { id } = req.params;
  const ws = readWithdrawals();
  const w = ws.find(x => String(x.id) === String(id));
  if (!w) return res.status(404).json({ ok:false, message:"Not found" });
  if (w.status !== "PENDING") return res.json({ ok:true, item:w });

  const users = readUsers();
  const u = users.find(x => sameId(x.id, w.userId));
  if (u) {
    u.balance = Number((Number(u.balance||0) + Number(w.amount||0)).toFixed(3));
    writeUsers(users);
  }
  w.status = "REJECTED";
  w.decidedAt = nowISO();
  writeWithdrawals(ws);
  res.json({ ok:true, item:w });
});
app.get("/api/withdraw/records", (req, res) => {
  const userId = String(req.query.userId || "").replace(/^u/i,"").trim();
  if (!userId) return res.status(400).json({ ok:false, error:"userId required" });
  const all = readWithdrawals();
  const items = all
    .filter(w => String(w.userId) === userId)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(w => ({
      id: w.id,
      userId: String(w.userId),
      amount: Number(w.amount || 0),
      status: w.status,
      address: w.address,
      network: w.network || "TRC-20",
      createdAt: w.createdAt,
      decidedAt: w.decidedAt || null,
      note: w.reviewNote || w.note || ""
    }));
  res.json({ ok:true, items });
});
app.get("/api/withdrawals/records", (req, res) => { req.url = "/api/withdraw/records"; app._router.handle(req, res); });
app.get("/api/withdrawals", (req, res) => { req.url = "/api/withdraw/records"; app._router.handle(req, res); });

/* -------------------- 🔧 Inject Rules API (ARRAY GET) -------------------- */
function _rulesListFor(uidRaw){
  const uid = String(uidRaw||"").replace(/^u/i,"");
  const all = readRules().map(r => ({
    id: r.id,
    userId: String(r.userId),
    taskNo: Number(r.taskNo||0),
    amountSpec: String(r.amountSpec||""),
    percent: r.percent==null ? null : Number(r.percent),
    status: String(r.status||"draft"),
    createdAt: r.createdAt || nowISO(),
    usedAt: r.usedAt || null,
    used: !!r.used
  }));
  const items = uid ? all.filter(r => String(r.userId) === uid) : all;
  items.sort((a,b)=> (a.taskNo||0)-(b.taskNo||0) || new Date(a.createdAt)-new Date(b.createdAt));
  return items;
}
app.get("/api/admin/inject-rules", (req,res)=>{
  const items = _rulesListFor(req.query.userId);
  return res.json(items);
});
app.post("/api/admin/inject-rules", (req,res)=>{
  const b = req.body || {};
  const userId = String(b.userId || "").replace(/^u/i,"");
  const taskNo = Number(b.taskNo || 0);
  const amountSpec = String(b.amountSpec || "").trim();
  const percent = b.percent==null ? null : Number(b.percent);
  if (!userId || !taskNo || !amountSpec) return res.status(400).json({ ok:false, msg:"userId, taskNo, amountSpec required" });

  const list = readRules();
  const rule = {
    id: "r_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
    userId, taskNo, amountSpec,
    percent: percent==null || Number.isNaN(percent) ? null : percent,
    status: "draft",
    createdAt: nowISO(),
    used: false,
    usedAt: null
  };
  list.push(rule);
  writeRules(list);
  res.json({ ok:true, rule });
});
app.patch("/api/admin/inject-rules/:id", (req,res)=>{
  const id = String(req.params.id || "");
  const b = req.body || {};
  const list = readRules();
  const i = list.findIndex(r => String(r.id) === id);
  if (i < 0) return res.status(404).json({ ok:false, msg:"Not found" });

  const r = list[i];
  if (b.userId != null)  r.userId = String(b.userId).replace(/^u/i,"");
  if (b.taskNo != null)  r.taskNo = Number(b.taskNo);
  if (b.amountSpec!=null)r.amountSpec = String(b.amountSpec);
  if (b.percent != null) r.percent = Number(b.percent);
  if (b.status  != null) r.status  = String(b.status);
  if (b.used    != null) r.used    = !!r.used;
  if (b.usedAt  != null) r.usedAt  = b.usedAt;
  list[i] = r;
  writeRules(list);
  res.json({ ok:true, rule: r });
});
app.delete("/api/admin/inject-rules/:id", (req,res)=>{
  const id = String(req.params.id || "");
  const list = readRules();
  const left = list.filter(r => String(r.id) !== id);
  writeRules(left);
  res.json({ ok:true });
});
app.post("/api/admin/inject-rules/purge-used", (req,res)=>{
  const uid = String(req.body?.userId || req.query?.userId || "").replace(/^u/i,"");
  let list = readRules();
  list = list.filter(r => {
    const usedLike = String(r.status||"").toLowerCase()==="used" || r.used===true || r.applied===true || r.status==="consumed";
    if (!usedLike) return true;
    if (uid && String(r.userId)!==uid) return true;
    return false;
  });
  writeRules(list);
  res.json({ ok:true, count:list.length });
});

/* -------------------- Customer Service (Telegram) Link -------------------- */
app.get("/api/admin/cs-link", (_req, res) => {
  try {
    const s = readSettings();
    res.json({ ok: true, url: s.csUrl || "" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post("/api/admin/cs-link", (req, res) => {
  try {
    let url = String(req.body?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ ok: false, msg: "URL must start with http:// or https://" });
    }
    const s = readSettings();
    s.csUrl = url;
    s.updatedAt = nowISO();
    writeSettings(s);
    res.json({ ok: true, url: s.csUrl });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/api/cs-link", (_req, res) => {
  try {
    const s = readSettings();
    res.json({ ok: true, url: s.csUrl || "" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* -------------------- Admin router (bcrypt admin auth etc.) -------------------- */
const adminRouter = require("./routes/admin");
app.use("/api/admin", adminRouter);

/* -------------------- User deposit: assign address + pending -------------------- */
app.post("/api/deposit/request", (req, res) => {
  const b = req.body || {};
  const userId = String(b.userId || "").trim();
  const amount = Number(b.amount || 0);
  if (!userId) return res.status(400).json({ ok:false, msg:"userId required" });
  if (!(amount > 0.1)) return res.status(400).json({ ok:false, msg:"Amount must be > 0.1 USDT" });

  const users = readUsers();
  const u = users.find(x => sameId(x.id, userId));
  if (!u) return res.status(404).json({ ok:false, msg:"User not found" });

  const deposits = readDepos();
  const existing = deposits.find(d => sameId(d.userId, userId) && d.status === "PENDING");
  if (existing) {
    return res.json({ ok:true, address: existing.address, deposit: { ...existing, reused:true, justCreated:false } });
  }

  const addrs = readAddrs();
  let pool = addrs.filter(a => !a.isAssigned && String(a.address || "").length);

  const lastFinished = deposits.find(d => sameId(d.userId, userId) && d.status !== "PENDING");
  if (lastFinished) {
    const exclude = lastFinished.address;
    const filtered = pool.filter(a => a.address !== exclude);
    if (filtered.length) pool = filtered;
  }
  if (pool.length === 0) return res.status(400).json({ ok:false, msg:"No TRC-20 address available. Please try later." });

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const dep = {
    id: "d_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    userId: String(u.id),
    amount: Number(amount.toFixed(3)),
    address: pick.address,
    status: "PENDING",
    reviewNote: "",
    createdAt: nowISO(),
  };
  deposits.unshift(dep);
  writeDepos(deposits);

  pick.isAssigned = true;
  pick.currentDepositId = dep.id;
  writeAddrs(addrs);

  res.json({ ok:true, address: dep.address, deposit: { ...dep, reused:false, justCreated:true } });
});
app.get("/api/deposit/records", (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ ok:false, error:"userId required" });
  const all = readDepos();
  const items = all
    .filter(d => String(d.userId) === userId && d.status && d.status !== "PENDING")
    .sort((a,b) => new Date(b.createdAt || b.time || 0) - new Date(a.createdAt || a.time || 0))
    .map(d => ({ id:d.id, userId:d.userId, amount:Number(d.amount||0), status:d.status, address:d.address, createdAt:d.createdAt || d.time }));
  res.json({ ok:true, items });
});

/* -------------------- start -------------------- */
console.log("DEBUG PATHS", {
  cwd: process.cwd(),
  __dirname,
  DATA_DIR,
  WALLETS_FILE,
  addrFiles: ADDR_FILES,
  exists: fs.existsSync(WALLETS_FILE),
  size: fs.existsSync(WALLETS_FILE) ? fs.statSync(WALLETS_FILE).size : 0,
  settingsFile: SETTINGS_FILE
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
