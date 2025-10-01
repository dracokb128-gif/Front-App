// src/utils/products.js
import RAW from "../data/products.json";

/* ---------- helpers ---------- */
const PRODUCTS = (Array.isArray(RAW) ? RAW : []).map((p, i) => ({
  id: String(p?.id ?? i + 1).padStart(3, "0"),
  title: String(p?.title ?? `Product ${i + 1}`).trim(),
  image: String(p?.image ?? "").trim(),
}));

// Title/Image normalizers so dup detect ho sake (no repeat by name OR image)
function normTitle(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/\.(webp|jpe?g|png|web)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normImg(p = "") {
  let s = String(p).toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  // keep only filename
  const m = s.match(/([^/]+)$/);
  s = m ? m[1] : s;
  // common typos
  s = s.replace(/\.webp\.jpe?g$/, ".webp").replace(/\.web\.jpe?g$/, ".jpg").replace(/\.web$/, ".webp");
  return s;
}

/* ---------- rotation state (per user + brand) ---------- */
const KEY_BASE = "prodCycle:v5";  // bump if schema changes
const keyFor = (scope = "global") => `${KEY_BASE}:${scope}`;

function readLS(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function shuffle(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newState() {
  return { order: shuffle(PRODUCTS.length), pos: 0, seenT: [], seenI: [] };
}
function ensureState(scope = "global") {
  let st = readLS(keyFor(scope));
  if (!st || !Array.isArray(st.order) || st.order.length !== PRODUCTS.length) {
    st = newState();
    writeLS(keyFor(scope), st);
  }
  return st;
}

function canUse(idx, st) {
  const t = normTitle(PRODUCTS[idx].title);
  const i = normImg(PRODUCTS[idx].image);
  return !st.seenT.includes(t) && !st.seenI.includes(i);
}
function markUsed(idx, st) {
  const t = normTitle(PRODUCTS[idx].title);
  const i = normImg(PRODUCTS[idx].image);
  if (t) st.seenT.push(t);
  if (i) st.seenI.push(i);
}

/* ---------- core: next unique index ---------- */
function nextUniqueIndex(scope = "global") {
  let st = ensureState(scope);
  const total = st.order.length;
  let scans = 0;

  while (scans < total) {
    const idx = st.order[st.pos % total];
    st.pos += 1;
    if (canUse(idx, st)) {
      markUsed(idx, st);
      writeLS(keyFor(scope), st);
      return idx;
    }
    scans += 1; // skip duplicates within same cycle
  }

  // saari unique entries use ho chuki: new cycle
  st = newState();
  writeLS(keyFor(scope), st);
  const idx = st.order[st.pos];
  st.pos += 1;
  markUsed(idx, st);
  writeLS(keyFor(scope), st);
  return idx;
}

/* ---------- public APIs ---------- */
export function getUniqueProducts(n = 1, scope = "global") {
  const out = [];
  const pickedThisCall = new Set();
  while (out.length < n && out.length < PRODUCTS.length) {
    const idx = nextUniqueIndex(scope);
    if (pickedThisCall.has(idx)) continue; // safety for same call
    pickedThisCall.add(idx);
    out.push(PRODUCTS[idx]);
  }
  return out;
}

// Backward compatible alias
export function getRandomProducts(n = 1, scope) {
  return getUniqueProducts(n, scope);
}

// Hint match: best effort, but still non-repeat lock enforced
export function pickProductByHint(hint, scope = "global") {
  const h = normTitle(hint);
  if (h) {
    let bestIdx = -1, bestScore = 0;
    for (let i = 0; i < PRODUCTS.length; i++) {
      const t = normTitle(PRODUCTS[i].title);
      let score = 0;
      if (t.includes(h)) score = h.length / (t.length + 1);
      else {
        const A = new Set(h.split(" ").filter(Boolean));
        const B = new Set(t.split(" ").filter(Boolean));
        let m = 0; A.forEach(x => B.has(x) && m++);
        score = m / (A.size + 1);
      }
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx !== -1) {
      const st = ensureState(scope);
      // agar already used (name ya image), next unique lo
      const t = normTitle(PRODUCTS[bestIdx].title);
      const i = normImg(PRODUCTS[bestIdx].image);
      if (st.seenT.includes(t) || st.seenI.includes(i)) {
        return getUniqueProducts(1, scope)[0];
      }
      markUsed(bestIdx, st);
      // pos ko slight advance, order integrity maintain rahe
      st.pos = (st.pos + 1) % st.order.length;
      writeLS(keyFor(scope), st);
      return PRODUCTS[bestIdx];
    }
  }
  return getUniqueProducts(1, scope)[0];
}

export function resetProductCycle(scope = "global") {
  writeLS(keyFor(scope), newState());
}
export function peekProductCycle(scope = "global") {
  return ensureState(scope);
}

export default PRODUCTS;
