// src/utils/history.js

// ----- localStorage keys -----
const COMPLETED_KEY = (uid) => `completedOrders:v1:${uid}`;
const OD_KEY = (uid) => `orderDisplay:${uid}`; // matches MenuPage / RecordPage

// ----- tiny utils -----
const stripT = (id = "") => String(id || "").replace(/^t[_-]?/i, "");

function readCompleted(uid) {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY(uid)) || "[]"); }
  catch { return []; }
}
function writeCompleted(uid, list) {
  try { localStorage.setItem(COMPLETED_KEY(uid), JSON.stringify(list.slice(0, 500))); }
  catch {}
}

// ===== public: snapshots =====
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

// ===== public: hydrate unpaid display from orderDisplay:* cache =====
export function hydrateFromDisplay(raw, uid) {
  if (!raw) return raw;
  const id = raw.id || raw.orderId || "";
  if (!id) return raw;

  let disp = null;
  try {
    const map = JSON.parse(localStorage.getItem(OD_KEY(uid)) || "{}");
    disp = map[id] || null;
  } catch {
    disp = null;
  }
  if (!disp) return raw;

  const t = { ...raw };
  if (disp.kind === "single") {
    t.title = disp.title || t.title;
    t.image = disp.image || t.image;
    t.quantity = disp.quantity || t.quantity;
  } else if (disp.kind === "combine" && Array.isArray(disp.items)) {
    // keep server pricing/deficit but use the same item visuals we showed on MenuPage
    t.items = disp.items.map((it) => ({ ...it }));
  }
  return t;
}
