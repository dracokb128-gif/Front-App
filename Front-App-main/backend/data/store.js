// backend/data/store.js (CommonJS version)
"use strict";

// ---- Global fixed invite code ----
const FIX_INVITE_CODE = "120236";

// ---- In-memory users ----
let _nextId = 4; // u1..u3 occupied

const users = [
  {
    id: "u1",
    username: "Ali",
    balance: 10,
    inviteCode: FIX_INVITE_CODE,
    isFrozen: false,
    cursor: 0,
    completedToday: 0,
    totalCompleted: 0,
    lastTaskDate: null,
    history: [],
    pending: null,
  },
  {
    id: "u2",
    username: "Irma",
    balance: 50,
    inviteCode: FIX_INVITE_CODE,
    isFrozen: false,
    cursor: 0,
    completedToday: 0,
    totalCompleted: 0,
    lastTaskDate: null,
    history: [],
    pending: null,
  },
  {
    id: "u3",
    username: "Mustafa",
    balance: 25,
    inviteCode: FIX_INVITE_CODE,
    isFrozen: false,
    cursor: 0,
    completedToday: 0,
    totalCompleted: 0,
    lastTaskDate: null,
    history: [],
    pending: null,
  },
];

function newId() {
  return "u" + _nextId++;
}
function findUser(id) {
  return users.find((u) => String(u.id) === String(id));
}
function removeUser(id) {
  const idx = users.findIndex((u) => String(u.id) === String(id));
  if (idx >= 0) users.splice(idx, 1);
}
function searchUsers(q = "") {
  const s = String(q).trim().toLowerCase();
  if (!s) return users;
  return users.filter(
    (u) =>
      String(u.id).toLowerCase().includes(s) ||
      String(u.username || "").toLowerCase().includes(s) ||
      String(u.inviteCode || "").toLowerCase().includes(s)
  );
}

// ---- Inject rules (per user) ----
const injectRules = {}; // { [userId]: [{ index, amount, lines, title?, image?, source? }] }

// ---- Combine Orders Catalog ----
let _catSeq = 1;
const combineCatalog = [];

function seedCombineCatalog() {
  const step = 0.5;
  for (let a = 1; a <= 500; a = +(a + step).toFixed(2)) {
    combineCatalog.push({
      id: "c" + _catSeq++,
      amount: +a.toFixed(2),
      lines: 4,
      title: `Combine ${a.toFixed(2)} USDT`,
      image: "/products/combine.jpg",
    });
  }
  [67.41, 83.55, 98.3, 132.05, 196.59, 491.49].forEach((v) => {
    combineCatalog.push({
      id: "c" + _catSeq++,
      amount: +v.toFixed(2),
      lines: 4,
      title: `Combine ${v.toFixed(2)} USDT`,
      image: "/products/combine.jpg",
    });
  });
}
seedCombineCatalog();

function searchCombineCatalog({ q = "", min, max, offset = 0, limit = 50 } = {}) {
  let list = combineCatalog.slice();
  if (min != null) list = list.filter((x) => x.amount >= Number(min));
  if (max != null) list = list.filter((x) => x.amount <= Number(max));
  const s = String(q || "").trim().toLowerCase();
  if (s) {
    list = list.filter(
      (x) =>
        x.id.toLowerCase() === s ||
        (x.title || "").toLowerCase().includes(s) ||
        String(x.amount).includes(s)
    );
  }
  const total = list.length;
  const page = list.slice(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 50));
  return { total, items: page };
}
function addCombineToCatalog({ amount, lines = 4, title, image }) {
  const item = {
    id: "c" + _catSeq++,
    amount: Number(amount),
    lines: Number(lines) || 4,
    title: title || `Combine ${Number(amount).toFixed(2)} USDT`,
    image: image || "/products/combine.jpg",
  };
  combineCatalog.push(item);
  return item;
}
function getCatalogItem(catId) {
  return combineCatalog.find((x) => String(x.id) === String(catId));
}

// ---- exports (CommonJS) ----
module.exports = {
  FIX_INVITE_CODE,
  users,
  newId,
  findUser,
  removeUser,
  searchUsers,
  injectRules,
  combineCatalog,
  searchCombineCatalog,
  addCombineToCatalog,
  getCatalogItem,
};
