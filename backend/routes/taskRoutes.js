// backend/routes/taskRoutes.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  ensureDaily,
  getNextTask,
  completeTask,
  todayKey,
  MAX_TASKS_PER_DAY,
} = require("../utils/taskEngine");

const router = express.Router();

/* ---- STORAGE PATHS (match server.js) ---- */
const DATA_DIR = fs.existsSync("/var/data") ? "/var/data" : path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const RULES_FILE = path.join(DATA_DIR, "injectRules.json");

function readUsers(){ try { return JSON.parse(fs.readFileSync(USERS_FILE,"utf8")); } catch { return []; } }
function writeUsers(v){ fs.writeFileSync(USERS_FILE, JSON.stringify(v,null,2), "utf8"); }
function readRules(){ try { return JSON.parse(fs.readFileSync(RULES_FILE,"utf8")); } catch { return []; } }
function writeRules(v){ fs.writeFileSync(RULES_FILE, JSON.stringify(v,null,2), "utf8"); }

const idKey = (v)=>String(v??"").trim();
const sameId = (a,b)=> idKey(a).replace(/^u/i,"") === idKey(b).replace(/^u/i,"");

// ---------- helpers ----------
function pickAmount(spec){
  const s = String(spec||"").trim();
  if(!s) return 0;
  if(s.includes("-")){
    const [a,b] = s.split("-").map(n=>Number(n.trim()));
    const lo = Math.min(a,b), hi = Math.max(a,b);
    return Math.round(lo + Math.random()*(hi-lo));
  }
  return Number(s);
}
function rateByAmount(v){
  if(v>=901) return 0.12;
  if(v>=499) return 0.08;
  if(v>=20)  return 0.04;
  return 0.04;
}

// ✅ NEW: stable deterministic id per rule (so client-side seeded items remain same)
const stableIdForRule = (rule)=>{
  const rid = rule && (rule.id ?? rule.ruleId ?? rule.taskNo);
  return `t_${String(rid ?? "x").replace(/\s+/g,"")}`;
};

// -------- create combine from a rule (now uses stable id)
function combineFromRule(rule, balance){
  const amount = pickAmount(rule.amountSpec);
  const rate = rule.percent != null ? Number(rule.percent)/100 : rateByAmount(amount);
  const commission = +Number(amount * rate).toFixed(3);

  const items = (Array.isArray(rule.items) && rule.items.length)
    ? rule.items
    : [{ title: "Custom Combined Order", quantity: 1, unitPrice: amount }];

  return {
    id: stableIdForRule(rule),              // <-- was `t_${Date.now()}`
    kind: "combine",
    type: "combined",
    orderAmount: amount,
    commission,
    commissionRate: rate,
    items,
    deficit: Math.max(0, Number((amount - Number(balance||0)).toFixed(3))),
    __ruleId: String(rule.id || ""),
  };
}

function makeUnpaidFromTask(u, bodyTask){
  const amount = Number(bodyTask?.orderAmount || bodyTask?.amount || 0);
  const rate   = Number(bodyTask?.commissionRate || 0.04);
  const commission = Number(bodyTask?.commission ?? (amount * rate).toFixed(3));

  const items = (Array.isArray(bodyTask?.items) && bodyTask.items.length)
    ? bodyTask.items
    : [{ title: "Custom Combined Order", quantity: 1, unitPrice: amount }];

  const t = {
    id: bodyTask?.id || `t_${Date.now()}`,  // if client passed id (from rule), keep it
    kind: "combine",
    type: "combined",
    orderAmount: amount,
    commission,
    commissionRate: rate,
    items,
    __ruleId: String(bodyTask?.__ruleId || ""),
  };
  const deficit = Math.max(0, Number((amount - Number(u.balance||0)).toFixed(3)));
  u.pending = { ...t, status: "unpaid", requiredRecharge: deficit };
  u.history = Array.isArray(u.history) ? u.history : [];
  u.history.unshift({ ...u.pending, createdAt: Date.now() });
}

// ---------- progress & records ----------
router.get("/progress", (req,res)=>{
  const id = String(req.query.userId || "");
  const users = readUsers();
  const u = users.find(x=>sameId(x.id,id));
  if(!u) return res.status(404).json({ ok:false, message:"User not found" });
  const key = ensureDaily(u);
  const d = u.daily[key] || { completed:0, commission:0 };
  writeUsers(users);
  res.json({
    ok: true,
    completedToday: Number(d.completed||0),
    totalCompleted: Number(u.totalCompleted||0),
    balance: Number(u.balance||0),
    todayCommission: +Number(d.commission||0).toFixed(3),
    maxTasksPerDay: MAX_TASKS_PER_DAY,
    pending: u.pending || null,
    unpaid:  u.pending || null,
    unpaidTask: u.pending || null,
  });
});

router.get("/records", (req,res)=>{
  const id = String(req.query.userId || "");
  const users = readUsers();
  const u = users.find(x=>sameId(x.id,id));
  if(!u) return res.status(404).json({ ok:false, message:"User not found" });
  ensureDaily(u);
  writeUsers(users);
  const incomplete = [];
  if(u.pending) incomplete.push(u.pending);
  res.json({ ok:true, unpaid: u.pending || null, records: u.history || [], incomplete });
});

// ---------- NEXT (with inject slots)
router.post("/task/next", (req,res)=>{
  const userId = String(req.body?.userId || req.query.userId || "");
  const store  = String(req.body?.store  || req.query.store  || "amazon");
  const users = readUsers();
  const u = users.find(x=>sameId(x.id,userId));
  if(!u) return res.status(404).json({ ok:false, error:"user_not_found" });

  const key = ensureDaily(u);
  const day = u.daily[key] || { completed:0, commission:0 };
  const nextNo = Number(day.completed||0) + 1;

  if(u.pending){
    writeUsers(users);
    return res.json({ ok:true, unpaid:u.pending, redirectToRecord:true });
  }

  const rules = readRules();
  const rule = rules.find(r =>
    String(r.userId).replace(/^u/i,"") === String(userId).replace(/^u/i,"") &&
    Number(r.taskNo) === nextNo &&
    ["confirmed","staged"].includes(String(r.status||"").toLowerCase())
  );

  if(rule && String(rule.status).toLowerCase()==="confirmed"){
    const t = combineFromRule(rule, u.balance);   // stable id here
    rule.status = "staged";
    writeRules(rules);
    writeUsers(users);
    return res.json({ ok:true, task:t });
  }

  if(rule && String(rule.status).toLowerCase()==="staged"){
    const t = combineFromRule(rule, u.balance);   // same stable id again
    makeUnpaidFromTask(u, t);                     // persists with same id/items
    const left = rules.filter(x => String(x.id) !== String(rule.id));
    writeRules(left);
    writeUsers(users);
    return res.json({ ok:true, unpaid:u.pending, redirectToRecord:true });
  }

  const data = getNextTask(u, store, null);
  writeUsers(users);
  return res.json(data || { ok:true, noMore:false });
});

// ---------- preview close/back -> mark unpaid
router.post("/task/mark-unpaid", (req,res)=>{
  const userId = String(req.body?.userId || "");
  const users = readUsers();
  const u = users.find(x=>sameId(x.id,userId));
  if(!u) return res.status(404).json({ ok:false, error:"user_not_found" });
  if(u.pending) return res.json({ ok:true, unpaid:u.pending });

  makeUnpaidFromTask(u, req.body?.task || {});
  if(req.body?.task && req.body.task.__ruleId){
    const rid = String(req.body.task.__ruleId);
    const left = readRules().filter(r => String(r.id) !== rid);
    writeRules(left);
  }
  writeUsers(users);
  res.json({ ok:true, unpaid:u.pending });
});

// ---------- submit (complete)
router.post("/task/submit", (req,res)=>{
  const { userId, taskId, note = "" } = req.body || {};
  const users = readUsers();
  const u = users.find(x=>sameId(x.id,userId));
  if(!u) return res.status(404).json({ ok:false, error:"user_not_found" });

  const usedRuleId = u.pending && u.pending.__ruleId ? String(u.pending.__ruleId) : null;
  const out = completeTask(u, taskId, note);
  if(!out || !out.ok){
    writeUsers(users);
    return res.status(400).json(out || { ok:false, error:"submit_failed" });
  }

  if(usedRuleId){
    const left = readRules().filter(r => String(r.id) !== usedRuleId);
    writeRules(left);
  }

  writeUsers(users);
  res.json({ ok:true, ...out });
});

module.exports = router;
