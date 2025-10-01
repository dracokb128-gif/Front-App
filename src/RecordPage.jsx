// src/RecordPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { completeTask, getProgress, getRecords, submitUnpaid } from "./api";
import { snapshotFromTask, pushCompleted, listCompleted } from "./utils/history";

/* ===== helpers ===== */
const PUB = (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) || "";
const fmt = (v, d = 0) => (Number.isFinite(+v) ? (+v).toFixed(d) : (0).toFixed(d));
const toNum = (v) => (Number.isFinite(+v) ? +v : 0);
const stripT = (id = "") => String(id || "").replace(/^t[_-]?/i, "");

/* SAME cache key used in MenuPage */
const OD_KEY = (uid) => `orderDisplay:${uid}`;
function readDisplay(uid, orderId) {
  try {
    const map = JSON.parse(localStorage.getItem(OD_KEY(uid)) || "{}");
    return map[orderId] || null;
  } catch {
    return null;
  }
}

/* svg placeholder */
function svgPlaceholder(title = "Item", idx = 1) {
  const t = encodeURIComponent(String(title).slice(0, 22));
  const palette = ["#F1F5F9", "#F8FAFC", "#EFF6FF", "#F5F3FF", "#ECFEFF"];
  const bg = palette[idx % palette.length],
    fg = "#1F2937";
  return (
    "data:image/svg+xml;utf8," +
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
      <rect width='100%' height='100%' rx='12' fill='${bg}'/>
      <text x='50%' y='50%' font-size='12' font-family='Inter,Arial' fill='${fg}' text-anchor='middle' dominant-baseline='middle'>${t}</text>
    </svg>`
  );
}

/* hydrate */
function hydrateFromDisplay(raw, uid) {
  if (!raw) return raw;
  const id = raw.id || raw.orderId || "";
  const disp = readDisplay(uid, id);
  if (!disp) return raw;
  const t = { ...raw };
  if (disp.kind === "single") {
    t.title = disp.title || t.title;
    t.image = disp.image || t.image;
    t.quantity = disp.quantity || t.quantity;
  } else if (disp.kind === "combine" && Array.isArray(disp.items)) {
    t.items = disp.items.map((it) => ({ ...it }));
  }
  return t;
}

/* fallback items */
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
const NAMES = [
  "Wireless Earbuds",
  "Phone Case",
  "USB-C Cable",
  "LED Night Lamp",
  "Mini Tripod",
  "Screen Protector",
  "Bluetooth Speaker",
  "Smart Watch Strap",
  "Memory Card",
  "Laptop Stand",
];
function synthesizeItems(task) {
  const rnd = seededRand(hashStr(String(task?.id || Date.now())));
  const n = 4 + Math.floor(rnd() * 2);
  return Array.from({ length: n }).map((_, i) => ({
    title: NAMES[Math.floor(rnd() * NAMES.length)],
    quantity: 1 + Math.floor(rnd() * 4),
    unitPrice: (500 + Math.floor(rnd() * 3000)) / 100,
    image: `${PUB}/products/${(i % 12) + 1}.jpg`,
  }));
}

/* center toast */
function CenterTip({ show, text, anchor }) {
  if (!show) return null;
  const anchored = anchor && Number.isFinite(anchor.top) && Number.isFinite(anchor.cx);
  const wrap = anchored
    ? {
        position: "fixed",
        left: `${anchor.cx}px`,
        top: `${anchor.top}px`,
        transform: "translate(-50%,0)",
        zIndex: 300005,
        pointerEvents: "none",
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 360,
        display: "flex",
        justifyContent: "center",
        zIndex: 300005,
        pointerEvents: "none",
      };
  return createPortal(
    <div style={wrap}>
      <div
        style={{
          maxWidth: 340,
          lineHeight: 1.35,
          textAlign: "center",
          background: "rgba(0,0,0,.86)",
          color: "#fff",
          padding: "10px 12px",
          borderRadius: 12,
          fontSize: 14,
          boxShadow: "0 14px 40px rgba(0,0,0,.35)",
          fontWeight: 700,
        }}
      >
        {text}
      </div>
    </div>,
    document.body
  );
}

function CompletedCard({ snap }) {
  const f =
    snap.kind === "combine"
      ? (snap.items && snap.items[0]) || {}
      : { title: snap.title, image: snap.image, unitPrice: snap.unitPrice, quantity: snap.quantity };
  const fallback = svgPlaceholder(f.title || "Item", 0);
  const expected = toNum(snap.orderAmount) + toNum(snap.commission);
  const dt = new Date(snap.ts || Date.now());
  const time =
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")} ` +
    `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(
      2,
      "0"
    )}:${String(dt.getSeconds()).padStart(2, "0")}`;

  return (
    <div
      className="card"
      style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.06)", padding: 16, marginBottom: 16 }}
    >
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Order Nos</div>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{stripT(snap.id)}</div>

      <div style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", background: "#fafafa", border: "1px solid #eee" }}>
            <img
              src={f.image || ""}
              onError={(e) => {
                e.currentTarget.src = fallback;
              }}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              title={f.title || "Item"}
            >
              {f.title || "Item"}
            </div>
            <div style={{ color: "#f59e0b", fontWeight: 700, marginTop: 2, fontSize: 13.5 }}>
              {fmt(f.unitPrice || 0, 2)} USDT
            </div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, paddingLeft: 6 }}>x{Number(f.quantity || 1)}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 12, columnGap: 10, fontSize: 15.5 }}>
        <div>Transaction time</div>
        <div style={{ textAlign: "right" }}>{time}</div>
        <div>Order amount</div>
        <div style={{ textAlign: "right" }}>{fmt(snap.orderAmount, 2)} USDT</div>
        <div>Commissions</div>
        <div style={{ textAlign: "right" }}>{fmt(snap.commission, 4)} USDT</div>
        <div style={{ fontWeight: 800 }}>Expected income</div>
        <div style={{ textAlign: "right", color: "#f59e0b", fontWeight: 800 }}>{fmt(expected, 4)}USDT</div>
      </div>
    </div>
  );
}

export default function RecordPage() {
  const uid = String(localStorage.getItem("uid") || localStorage.getItem("activeUserId") || "uu1");
  const [userId] = useState(uid);

  const [tab, setTab] = useState("incomplete");
  const [loading, setLoading] = useState(false);
  const [rawUnpaid, setRawUnpaid] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [tip, setTip] = useState({ show: false, text: "" });
  const tipTimer = useRef(null);
  const cardRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  // NEW: live progress state (for auto refresh)
  const [cashGap, setCashGap] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const upd = () => {
      if (!cardRef.current) return;
      const r = cardRef.current.getBoundingClientRect();
      setAnchor({ top: r.bottom - 260, cx: r.left + r.width / 2 });
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const showTip = (t) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip({ show: true, text: t });
    tipTimer.current = setTimeout(() => setTip({ show: false, text: "" }), 2800);
  };

  async function refreshAll() {
    try {
      const r = await getRecords(userId);
      const u =
        r?.unpaid ||
        (Array.isArray(r?.incomplete) && r.incomplete.length ? r.incomplete[0] : null) ||
        r?.unpaidTask ||
        null;
      setRawUnpaid(hydrateFromDisplay(u || null, userId));
    } catch {}
    setCompleted(listCompleted(userId)); // local history
  }

  // NEW: progress refresher (single source of truth for deficit/cashGap)
  async function refreshProgress(silent = true) {
    try {
      const p = await getProgress(userId);
      setCashGap(Number(p?.cashGap || 0));
      setBalance(Number(p?.balance || 0));
      if (p?.unpaid) {
        // server returns unpaid with fresh deficit -> replace
        setRawUnpaid(hydrateFromDisplay(p.unpaid, userId));
      }
    } catch (e) {
      if (!silent) console.error(e);
    }
  }

  useEffect(() => {
    // initial data
    refreshAll();
    refreshProgress(true);

    // focus/visibility refresh
    const onFocus = () => refreshProgress(true);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshProgress(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    // light polling (every 5s)
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refreshProgress(true);
    }, 5000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(poll);
    };
  }, [userId]);

  const task = useMemo(() => {
    const t = rawUnpaid;
    if (!t) return null;
    const isCombine =
      (Array.isArray(t.items) && t.items.length > 0) ||
      t?.kind === "combine" ||
      t?.type === "combined" ||
      Number(t?.deficit) > 0;

    if (isCombine) {
      const items = (Array.isArray(t.items) && t.items.length ? t.items : synthesizeItems(t)).map((it, idx) => ({
        ...it,
        unitPrice: toNum(it.unitPrice ?? it.price ?? 0),
        quantity: Number(it.quantity || 1),
        image: it.image || `${PUB}/products/${(idx % 12) + 1}.jpg`,
        title: it.title || `Product #${idx + 1}`,
      }));
      let orderAmount = toNum(t.orderAmount);
      if (!orderAmount) orderAmount = items.reduce((s, it) => s + toNum(it.unitPrice) * Number(it.quantity || 1), 0);
      let commission = toNum(t.commission);
      let rate = typeof t.commissionRate === "number" ? t.commissionRate : 0.19;
      if (!commission && rate) commission = +(orderAmount * rate).toFixed(3);
      if (!rate && commission && orderAmount > 0) rate = commission / orderAmount;
      return {
        id: t.id || `ord-${Date.now()}`,
        kind: "combine",
        items,
        orderAmount: +orderAmount.toFixed(3),
        commission: +commission.toFixed(3),
        commissionRate: rate || 0,
        deficit: Number(t.deficit || 0),
      };
    }

    const amount = toNum(t.orderAmount ?? t.amount ?? t.unitPrice);
    let rate = typeof t.commissionRate === "number" ? t.commissionRate : 0.04;
    let commission = toNum(t.commission);
    if (!commission) commission = +(amount * rate).toFixed(3);
    if (!rate && amount > 0 && commission > 0) rate = commission / amount;

    return {
      id: t.id || `ord-${Date.now()}`,
      kind: "single",
      image: t.image || `${PUB}/products/1.jpg`,
      title: t.title || "Order",
      unitPrice: Number(t.unitPrice ?? amount).toFixed(2),
      quantity: Number(t.quantity ?? 1),
      orderAmount: +amount.toFixed(2),
      commission,
      commissionRate: rate,
      deficit: Number(t.deficit || 0),
    };
  }, [rawUnpaid]);

  // ====== FIXED: robust submit with proper error handling ======
  async function handleSubmit() {
    if (!task) return;

    // 🔁 get latest deficit before gating
    await refreshProgress(true);
    const latestNeed = Math.max(0, Number(cashGap || task.deficit || 0));

    if (latestNeed > 0.0005) {
      showTip(`Your account balance is not enough, you need to recharge ${latestNeed.toFixed(3)} USDT to submit this order`);
      return;
    }

    setLoading(true);
    try {
      // Tell backend which unpaid we're submitting (mirrors MenuPage flow)
      if (rawUnpaid) {
        try {
          await submitUnpaid(userId, rawUnpaid);
        } catch (_) {
          // ignore — some backends may not require this call
        }
      }

      const resp = await completeTask(userId, task.id, "");
      if (resp?.ok) {
        pushCompleted(userId, snapshotFromTask(task, Date.now())); // local history
        showTip("Succeeded ✓");
        await refreshAll();
        await refreshProgress(true);
      }
    } catch (err) {
      const data = err?.data || {};
      const need =
        Number.isFinite(Number(data.deficit)) ? Number(data.deficit) : Math.max(0, Number(cashGap || task.deficit || 0));
      if (err?.message === "insufficient_balance" || data.needRecharge) {
        showTip(`Your account balance is not enough, you need to recharge ${need.toFixed(3)} USDT to submit this order`);
      } else {
        showTip("Failed to submit. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap record-page" style={{ paddingBottom: 90 }}>
      <h2 className="menu-title">Record</h2>

      {/* centered tabs (shape fixed) */}
      <div className="rec-tabs">
        <button className={`rec-tab ${tab === "incomplete" ? "active" : ""}`} onClick={() => setTab("incomplete")}>
          Incomplete
        </button>
        <button className={`rec-tab ${tab === "complete" ? "active" : ""}`} onClick={() => setTab("complete")}>
          Complete
        </button>
      </div>

      {/* Incomplete */}
      {tab === "incomplete" &&
        (task ? (
          <div
            ref={cardRef}
            className="card"
            style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.06)", padding: 16 }}
          >
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Order Nos</div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>{stripT(task.id)}</div>

            {/* list */}
            <div style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10, marginTop: 6 }}>
              {task.kind === "combine" ? (
                <div style={{ maxHeight: 200, overflow: "auto", paddingRight: 6 }}>
                  {task.items.slice(0, 5).map((it, idx) => {
                    const title = it.title || `Product #${idx + 1}`;
                    const fallback = svgPlaceholder(title, idx);
                    const src = it.image || `${PUB}/products/${(idx % 12) + 1}.jpg`;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "64px 1fr auto",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px",
                          border: "1px solid #f1f5f4",
                          borderRadius: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            overflow: "hidden",
                            background: "#fafafa",
                            border: "1px solid #eee",
                          }}
                        >
                          <img
                            src={src}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.src = fallback;
                            }}
                            loading="lazy"
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                            title={title}
                          >
                            {title}
                          </div>
                          <div style={{ color: "#f59e0b", fontWeight: 700, marginTop: 2, fontSize: 13.5 }}>
                            {(Number(it.unitPrice ?? it.price ?? 0)).toFixed(2)} USDT
                          </div>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, paddingLeft: 6 }}>
                          x{Number(it.quantity || 1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", background: "#fafafa", border: "1px solid #eee" }}>
                    <img
                      src={task.image || `${PUB}/products/1.jpg`}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {task.title || "Order"}
                    </div>
                    <div style={{ color: "#f59e0b", fontWeight: 700, marginTop: 2, fontSize: 13.5 }}>{fmt(task.unitPrice, 2)} USDT</div>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, paddingLeft: 6 }}>x{Number(task.quantity || 1)}</div>
                </div>
              )}
            </div>

            {/* totals */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 12, columnGap: 10, fontSize: 15.5 }}>
              <div>Order amount</div>
              <div style={{ textAlign: "right" }}>{fmt(task.orderAmount, 2)} USDT</div>
              <div>Commission</div>
              <div style={{ textAlign: "right" }}>{fmt(task.commission, 3)} USDT</div>
              <div>Rate</div>
              <div style={{ textAlign: "right" }}>
                {typeof task.commissionRate === "number" ? `${(task.commissionRate * 100).toFixed(1)}%` : task.commissionRate}
              </div>
              <div style={{ fontWeight: 800 }}>Expected income</div>
              <div style={{ textAlign: "right", color: "#f59e0b", fontWeight: 800 }}>
                {fmt(toNum(task.orderAmount) + toNum(task.commission), 3)} USDT
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  minWidth: 220,
                  height: 46,
                  borderRadius: 10,
                  border: 0,
                  background: "#5b5835ff",
                  color: "#fff",
                  fontWeight: 800,
                  boxShadow: "0 10px 24px rgba(91,59,53,.25)",
                  cursor: "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Submitting…" : "Submit order"}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No unpaid order.</div>
        ))}

      {/* Complete — scrollable list */}
      {tab === "complete" && (
        <div className="complete-scroll">
          {completed.length ? (
            completed.map((c) => <CompletedCard key={`${c.id}-${c.ts}`} snap={c} />)
          ) : (
            <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No more</div>
          )}
        </div>
      )}

      <CenterTip show={tip.show} text={tip.text} anchor={anchor} />
    </div>
  );
}
