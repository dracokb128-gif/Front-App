// backend/utils/taskEngine.js
// Commission slabs (normal tasks)
// Amazon: 20–498 → 4% | Alibaba: 499–900 → 8% | AliExpress: 901+ → 12%
const STORE = {
  amazon:     { rate: 0.04, min: 20,  max: 498 },
  alibaba:    { rate: 0.08, min: 499, max: 900 },
  aliexpress: { rate: 0.12, min: 901, max: Infinity },
};

const MAX_TASKS_PER_DAY = 25;

// ---- date helpers ----
function pad(n){ return n<10? "0"+n : String(n); }
function todayKey(){
  const d = new Date(); d.setHours(0,0,0,0);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function ensureDaily(user){
  const key = todayKey();
  if (!user) return key;
  user.daily ||= {};
  user.daily[key] ||= { completed: 0, commission: 0 };
  user.completedToday = user.daily[key].completed;
  return key;
}

// ---- helpers ----
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function randFloat(min, max){
  const v = min + Math.random()*Math.max(0, max-min);
  return Math.round(v*1000)/1000;
}
function parseAmountSpec(spec, lo, hi){
  if (spec == null) return null;
  const s = String(spec).trim();
  if (!s) return null;
  if (s.includes("-")){
    const [a,b] = s.split("-").map(x=>Number(String(x).trim()));
    if (Number.isFinite(a) && Number.isFinite(b)){
      const L = Math.min(a,b), H = Math.max(a,b);
      return randFloat(clamp(L, lo, hi), clamp(H, lo, hi));
    }
  }
  const n = Number(s);
  if (Number.isFinite(n)) return clamp(n, lo, hi);
  return null;
}
function storeRateFor(amount){
  if (amount >= 901) return STORE.aliexpress.rate;
  if (amount >= 499) return STORE.alibaba.rate;
  return STORE.amazon.rate;
}

// ---- NEXT TASK ----
// rule = { status:'confirmed', taskNo:Number, amountSpec:String, percent:Number }
function getNextTask(user, store="amazon", rule /* optional */){
  const key = ensureDaily(user);

  // daily cap
  if ((user.daily[key]?.completed || 0) >= MAX_TASKS_PER_DAY){
    return { ok:false, error:"limit_reached", message:"Daily limit reached" };
  }

  // already pending? return that
  if (user.pending && user.pending.id){
    return { ok:true, task:user.pending, pending:user.pending };
  }

  const number = Number(user.totalCompleted || 0) + 1; // 1-based current task no
  // only accept rule for the exact next number
  if (rule && Number(rule.taskNo) !== number) rule = null;

  const cfg = STORE[store] || STORE.amazon;

  // decide amount
  let amount;
  if (rule && String(rule.status).toLowerCase() === "confirmed"){
    // injected: ignore balance cap for generation, admin controls spec
    amount = parseAmountSpec(rule.amountSpec, cfg.min, isFinite(cfg.max)?cfg.max:1e12);
  } else {
    // normal: must be within user's balance range
    const maxByBal = Math.min(cfg.max, Number(user.balance || 0));
    if (!(maxByBal >= cfg.min)){
      return { ok:false, error:"low_balance", message:"Balance too low for normal task" };
    }
    amount = randFloat(cfg.min, maxByBal);
  }
  if (!Number.isFinite(amount) || amount <= 0){
    return { ok:false, error:"amount_invalid" };
  }

  // commission (reward)
  let rate = storeRateFor(amount); // default slab rate
  let reward = Number((amount * rate).toFixed(3));

  // override via injected percentage
  if (rule && String(rule.status).toLowerCase() === "confirmed"){
    const pct = Number(rule.percent || 0);
    if (Number.isFinite(pct) && pct > 0){
      rate = pct / 100;
      reward = Number((amount * rate).toFixed(3));
    }
  }

  const task = {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
    number,
    store,
    amount: Number(amount.toFixed(3)),
    rate,
    reward,
    type: rule ? "combined" : "normal",
    createdAt: Date.now(),
    __ruleId: rule ? String(rule.id || "") : null,
    deficit: Math.max(0, Number((amount - Number(user.balance || 0)).toFixed(3))),
  };

  user.pending = task;
  return { ok:true, task, pending:task };
}

// ---- SUBMIT ----
function completeTask(user, taskId, note=""){
  const key = ensureDaily(user);
  if (!user.pending || user.pending.id !== taskId){
    return { ok:false, error:"no_pending", message:"No matching pending task" };
  }
  const t = user.pending;

  // block submit if balance < amount (recharge flow)
  if (Number(user.balance || 0) < Number(t.amount || 0)) {
    return {
      ok:false,
      error:"insufficient_balance",
      needRecharge:true,
      deficit: Number((t.amount - Number(user.balance || 0)).toFixed(3)),
      task: t
    };
  }

  // principal not deducted; only commission added
  user.balance = Number((Number(user.balance||0) + Number(t.reward||0)).toFixed(3));

  const d = user.daily[key] || (user.daily[key] = { completed:0, commission:0 });
  d.completed += 1;
  d.commission = Number((Number(d.commission||0) + Number(t.reward||0)).toFixed(3));
  user.completedToday = d.completed;
  user.totalCompleted = Number(user.totalCompleted || 0) + 1;

  user.history ||= [];
  user.history.push({
    id: t.id, number: t.number, store: t.store,
    amount: t.amount, reward: t.reward, rate: t.rate,
    type: t.type, when: Date.now(), note: String(note||"")
  });

  user.pending = null;

  return { ok:true, balance:user.balance, completedToday:user.completedToday,
           totalCompleted:user.totalCompleted, reward:t.reward };
}

module.exports = { ensureDaily, getNextTask, completeTask, todayKey, MAX_TASKS_PER_DAY };
