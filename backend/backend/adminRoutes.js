// backend/adminRoutes.js
const fs = require("fs");
const path = require("path");

module.exports = function adminRoutes(app) {
  // ====== Common helpers ======
  const DATA_DIR = fs.existsSync("/var/data") ? "/var/data" : path.join(__dirname, "data");


  // Inject rules files (existing)
  const RULES_FILE  = path.join(DATA_DIR, "inject-rules.json");
  const LEGACY_FILE = path.join(DATA_DIR, "injected.json"); // auto-migration (old)

  // 🔹 NEW: Addresses + supporting files
  const ADDR_FILE   = path.join(DATA_DIR, "addresses.json");
  const USERS_FILE  = path.join(DATA_DIR, "users.json");     // to verify existing users
  const DEPOS_FILE  = path.join(DATA_DIR, "deposits.json");  // to detect “in-use” (pending)

  function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  function readJSON(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { return fallback; }
  }
  function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  }
  function tronOk(a) {
    return /^T[1-9A-HJ-NP-Za-km-z]{25,58}$/.test(String(a || "").trim());
  }

  // ====== Inject Rules (as you had) ======
  function loadRules() {
    ensureDir();
    if (fs.existsSync(RULES_FILE)) return readJSON(RULES_FILE, []);

    const legacy = fs.existsSync(LEGACY_FILE) ? readJSON(LEGACY_FILE, []) : [];
    if (!legacy.length) { writeJSON(RULES_FILE, []); return []; }

    const migrated = legacy.map((x, i) => ({
      id: String(x.id || `rule_${Date.now()}_${i}`),
      userId: String(x.userId || ""),
      taskNo: Number(x.taskNo || i + 1),
      amountSpec: String(x.amountSpec || String(x.amount ?? 0)),
      expectedIncome: Number(x.expectedIncome || 0),
      status: String(x.status || "confirmed"),
    }));
    writeJSON(RULES_FILE, migrated);
    return migrated;
  }
  function saveRules(list) { ensureDir(); writeJSON(RULES_FILE, list); }
  function markInjectRuleUsed(id) {
    const list = loadRules();
    const idx = list.findIndex(r => String(r.id) === String(id));
    if (idx >= 0) { list.splice(idx, 1); saveRules(list); }
  }
  global.__markInjectRuleUsed = markInjectRuleUsed;

  // ====== NEW: Addresses helpers ======
  function loadAddrs() {
    ensureDir();
    if (!fs.existsSync(ADDR_FILE)) writeJSON(ADDR_FILE, []);
    let list = readJSON(ADDR_FILE, []);
    if (!Array.isArray(list)) list = [];
    // normalize
    return list.map(x => ({
      address: String(x.address || "").trim(),
      createdAt: x.createdAt || new Date().toISOString(),
    })).filter(x => x.address);
  }
  function saveAddrs(list) { ensureDir(); writeJSON(ADDR_FILE, list || []); }
  function loadUsersMap() {
    const arr = readJSON(USERS_FILE, []);
    const m = new Set();
    (arr || []).forEach(u => { const id = String(u.id ?? "").trim(); if (id) m.add(id); });
    return m;
  }
  function loadPendingDeposits() {
    const arr = readJSON(DEPOS_FILE, []);
    return (arr || []).filter(d => String(d.status || "PENDING").toUpperCase() === "PENDING");
  }
  // Compute in-use = pending deposit for an existing user using same address
  function withInUse(list) {
    const users = loadUsersMap();
    const pend  = loadPendingDeposits();
    return (list || []).map(a => {
      const used = pend.some(d => String(d.address || "") === a.address && users.has(String(d.userId || "")));
      return { ...a, isAssigned: !!used };
    });
  }

  // ================== API: Inject Rules ==================
  app.get("/api/admin/inject-rules", (req, res) => {
    const userId = req.query.userId != null ? String(req.query.userId) : "";
    let list = loadRules();
    if (userId) list = list.filter(r => String(r.userId) === userId);
    res.json(list.sort((a, b) => a.taskNo - b.taskNo));
  });

  app.post("/api/admin/inject-rules", (req, res) => {
    const b = req.body || {};
    const list = loadRules();
    const rule = {
      id: String(b.id || `rule_${Date.now()}`),
      userId: String(b.userId || ""),
      taskNo: Number(b.taskNo || 1),
      amountSpec: String(b.amountSpec || "0"),
      expectedIncome: Number(b.expectedIncome || 0),
      status: "new",
    };
    list.push(rule); saveRules(list);
    res.json({ rule });
  });

  app.patch("/api/admin/inject-rules/:id", (req, res) => {
    const { id } = req.params;
    const b = req.body || {};
    const list = loadRules();
    const idx = list.findIndex(r => String(r.id) === String(id));
    if (idx < 0) return res.status(404).json({ msg: "not_found" });
    const r = list[idx];
    if (b.taskNo != null)         r.taskNo = Number(b.taskNo);
    if (b.amountSpec != null)     r.amountSpec = String(b.amountSpec);
    if (b.expectedIncome != null) r.expectedIncome = Number(b.expectedIncome);
    if (b.status != null)         r.status = String(b.status);
    if (b.action === "confirm" || b.status === "confirmed") r.status = "confirmed";
    if (b.action === "used" || b.status === "used") {
      list.splice(idx, 1); saveRules(list); return res.json({ removed: 1 });
    }
    list[idx] = r; saveRules(list); res.json({ rule: r });
  });

  app.delete("/api/admin/inject-rules/:id", (req, res) => {
    const { id } = req.params;
    const list = loadRules().filter(r => String(r.id) !== String(id));
    saveRules(list); res.json({ removed: 1 });
  });

  // ---------- Old aliases (back-compat) ----------
  app.get("/admin/injected", (req, res) => { res.json(loadRules()); });
  app.post("/admin/injected", (req, res) => {
    const b = req.body || {};
    const list = loadRules();
    const rule = {
      id: String(b.id || `rule_${Date.now()}`),
      userId: String(b.userId || ""),
      taskNo: Number(b.taskNo || 1),
      amountSpec: String(b.amountSpec || String(b.amount ?? 0)),
      expectedIncome: Number(b.expectedIncome || 0),
      status: "new",
    };
    list.push(rule); saveRules(list); res.json({ rule });
  });
  app.patch("/admin/injected/:id", (req, res) => {
    const { id } = req.params;
    const b = req.body || {};
    const list = loadRules();
    const idx = list.findIndex(r => String(r.id) === String(id));
    if (idx < 0) return res.status(404).json({ msg: "not_found" });
    const r = list[idx];
    if (b.taskNo != null)         r.taskNo = Number(b.taskNo);
    if (b.amountSpec != null)     r.amountSpec = String(b.amountSpec);
    if (b.expectedIncome != null) r.expectedIncome = Number(b.expectedIncome);
    if (b.status != null)         r.status = String(b.status);
    if (b.action === "used" || b.status === "used") {
      list.splice(idx, 1); saveRules(list); return res.json({ removed: 1 });
    }
    list[idx] = r; saveRules(list); res.json({ rule: r });
  });
  app.delete("/admin/injected/:id", (req, res) => {
    const { id } = req.params;
    const list = loadRules().filter(r => String(r.id) !== String(id));
    saveRules(list); res.json({ removed: 1 });
  });

  // ================== NEW API: TRC Addresses ==================

  // GET addresses (marks true “in-use”)
  app.get("/api/admin/addresses", (_req, res) => {
    const out = withInUse(loadAddrs());
    res.json(out);
  });

  // POST add addresses
  // body: { addresses: "Txxx\nTyyy" } OR { addresses: ["Txxx","Tyyy"] }
  app.post("/api/admin/addresses", (req, res) => {
    const b = req.body || {};
    let src = b.addresses;
    let arr = [];
    if (Array.isArray(src)) arr = src;
    else if (typeof src === "string") arr = src.split(/\r?\n/);
    arr = arr.map(s => String(s || "").trim()).filter(Boolean);

    const list = loadAddrs();
    const existing = new Set(list.map(a => a.address));
    let added = 0, invalid = 0, dupes = 0;

    arr.forEach(a => {
      if (!tronOk(a)) { invalid++; return; }
      if (existing.has(a)) { dupes++; return; }
      list.push({ address: a, createdAt: new Date().toISOString() });
      existing.add(a); added++;
    });

    saveAddrs(list);
    res.json({ ok: true, added, invalid, duplicates: dupes, msg: `Added ${added}. Ignored ${dupes} duplicate(s), ${invalid} invalid.` });
  });

  // DELETE address (supports ?force=1)
  app.delete("/api/admin/addresses/:address", (req, res) => {
    const address = decodeURIComponent(req.params.address || "").trim();
    const force = String(req.query.force || "") === "1";

    let list = loadAddrs();
    const before = list.length;

    // check “in-use”
    const users = loadUsersMap();
    const pend  = loadPendingDeposits();
    const inUse = pend.some(d => String(d.address || "") === address && users.has(String(d.userId || "")));

    if (inUse && !force) {
      return res.status(409).json({ ok: false, msg: "in_use" });
    }

    // optional cleanup: clear address from pending deposits if force
    if (inUse && force) {
      const all = readJSON(DEPOS_FILE, []);
      let changed = 0;
      (all || []).forEach(d => {
        if (String(d.address || "") === address && String(d.status || "PENDING").toUpperCase() === "PENDING") {
          // simplest: reject the pending one so user will request again and get a new address
          d.status = "REJECTED";
          d.note = (d.note ? d.note + " | " : "") + "Address revoked by admin";
          changed++;
        }
      });
      if (changed) writeJSON(DEPOS_FILE, all);
    }

    list = list.filter(a => a.address !== address);
    saveAddrs(list);
    res.json({ ok: true, removed: before - list.length, forced: !!force });
  });
};
