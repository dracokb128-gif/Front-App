// src/utils/history.js
import PRODUCTS from "./products"; // ✅ stable product pool (permanent images/titles)

// ----- localStorage keys -----
const COMPLETED_KEY = (uid) => `completedOrders:v1:${uid}`;
const OD_KEY = (uid) => `orderDisplay:${uid}`;

// ----- tiny utils -----
const stripT = (id = "") => String(id || "").replace(/^t[_-]?/i, "");

// ===== completed snapshots =====
function readCompleted(uid) {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY(uid)) || "[]"); }
  catch { return []; }
}
function writeCompleted(uid, list) {
  try { localStorage.setItem(COMPLETED_KEY(uid), JSON.stringify(list.slice(0, 500))); }
  catch {}
}

export function snapshotFromTask(task, ts = Date.now()) {
  if (!task) return null;
  const base = {
    id: stripT(task.id || task.orderId || ""),
    kind: task.kind === "combine" ? "combine" : "single",
    orderAmount: Number(task.orderAmount || 0),
    commission: Number(task.commission || 0),
    commissionRate: Number(task.commissionRate || 0),
    ts,
  };

  if (base.kind === "combine") {
    base.items = (task.items || []).map((it) => ({
      title: String(it.title || "Product"),
      image: String(it.image || ""),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      quantity: Number(it.quantity || 1),
    }));
  } else {
    base.title = String(task.title || "Order");
    base.image = String(task.image || "");
    base.unitPrice = Number(task.unitPrice ?? task.orderAmount ?? 0);
    base.quantity = Number(task.quantity || 1);
  }
  return base;
}

export function pushCompleted(uid, snap) {
  if (!snap) return;
  const list = readCompleted(uid);
  const i = list.findIndex((x) => x.id === snap.id);
  if (i !== -1) list.splice(i, 1);
  list.unshift(snap);
  writeCompleted(uid, list);
}

export function listCompleted(uid) {
  return readCompleted(uid).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// ===== deterministic synth (permanent fix for unpaid display) =====
function hashStr(s = "") {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRand(seed) {
  let x = seed || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}
function synthesizeItems(task) {
  const seedBase = String(task?.id || task?.orderId || Date.now());
  const rnd = seededRand(hashStr(seedBase + ":items"));
  const count = 4 + Math.floor(rnd() * 2); // 4–5 items
  const out = [];
  const used = new Set();
  while (out.length < count && used.size < PRODUCTS.length) {
    const idx = Math.floor(rnd() * PRODUCTS.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const p = PRODUCTS[idx] || {};
    out.push({
      title: String(p.title || `Product ${idx + 1}`),
      image: String(p.image || ""),
      quantity: 1 + Math.floor(rnd() * 3),
      unitPrice: (500 + Math.floor(rnd() * 3000)) / 100,
    });
  }
  return out;
}

// ===== public: hydrate unpaid display =====
export function hydrateFromDisplay(raw, uid) {
  if (!raw) return raw;
  const id = raw.id || raw.orderId || "";
  if (!id) return raw;

  // try to read cached visuals
  let disp = null;
  try {
    const map = JSON.parse(localStorage.getItem(OD_KEY(uid)) || "{}");
    disp = map[id] || null;
  } catch { disp = null; }

  const t = { ...raw };
  if (disp) {
    if (disp.kind === "single") {
      t.title = disp.title || t.title;
      t.image = disp.image || t.image;
      t.quantity = disp.quantity || t.quantity;
    } else if (disp.kind === "combine" && Array.isArray(disp.items)) {
      t.items = disp.items.map((it) => ({ ...it }));
    }
  } else if (t.kind === "combine") {
    // ⚡ fallback permanent synth if cache cleared
    t.items = synthesizeItems(t);
  }
  return t;
}
