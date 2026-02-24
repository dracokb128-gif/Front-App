// src/MenuPage.js
import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiChevronRight, FiLock, FiChevronLeft, FiZap } from "react-icons/fi";
import {
  taskNext as getNextTask,
  completeTask,
  getProgress,
  submitUnpaid,
  getRecords,
} from "./api";
import { snapshotFromTask as __snap, pushCompleted as __pushDone } from "./utils/history";
import { getRandomProducts, pickProductByHint } from "./utils/products";

/* ===================== helpers ===================== */
const PUB =
  (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) || "";

const VIP_TAG = (n) => ({ 1: "vip-1", 2: "vip-2", 3: "vip-3", 4: "vip-4" }[n]);

const BRAND_DOMAIN = {
  amazon: "amazon.com",
  alibaba: "alibaba.com",
  aliexpress: "aliexpress.com",
  ebay: "ebay.com",
};
const brandLocal = (id) => `${PUB}/brands/${id}.png`;
const brandClearbit = (id) => `https://logo.clearbit.com/${BRAND_DOMAIN[id]}`;
const brandSimpleIcon = (id) => `https://cdn.simpleicons.org/${id}/ffffff`;

function BrandLogo({ id, name }) {
  const chain = [brandLocal(id), brandClearbit(id), brandSimpleIcon(id)];
  const [i, setI] = useState(0);
  const [src, setSrc] = useState(chain[0]);
  return (
    <img
      className="brand-logo"
      src={src}
      alt={name}
      loading="lazy"
      onError={() => {
        const next = Math.min(i + 1, chain.length - 1);
        if (next !== i) {
          setI(next);
          setSrc(chain[next]);
        }
      }}
      style={{ width: 36, height: 36, borderRadius: 999 }}
    />
  );
}

const fmt = (v, d = 0) => (Number.isFinite(+v) ? (+v).toFixed(d) : (0).toFixed(d));
const toNum = (v) => (Number.isFinite(+v) ? +v : 0);
const cleanTitle = (s = "") =>
  String(s).replace(/\.(webp|jpe?g|png|web)$/i, "").trim();

/* ---------- Smart image candidates (CONSERVATIVE) ---------- */
function candidatePaths(p) {
  if (!p || typeof p !== "string") return [];
  let s = p.trim().replace(/[\u0000-\u001F\u007F]/g, "").replace(/\/{2,}/g, "/");
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) s = "/" + s;

  const out = [];
  const seen = new Set();
  const push = (x) => {
    const y = /^https?:\/\//i.test(x) ? x : `${PUB}${x.startsWith("/") ? x : "/" + x}`;
    if (!seen.has(y)) {
      out.push(y);
      seen.add(y);
    }
  };

  // exact first
  push(s);

  // double-extension fallback only
  const m = s.match(/^(.*)\.(webp|jpe?g|png)\.(webp|jpe?g|png)$/i);
  if (m) {
    push(`${m[1]}.${m[3].toLowerCase()}`);
    push(`${m[1]}.${m[2].toLowerCase()}`);
  }
  return out;
}
function SmartImg({ src, alt = "", style, fallback }) {
  const candidates = useMemo(() => {
    const list = candidatePaths(src);
    if (fallback && typeof fallback === "string") list.push(fallback);
    return list.length ? list : [fallback || ""];
  }, [src, fallback]);

  const [i, setI] = useState(0);
  const cur = candidates[Math.min(i, candidates.length - 1)] || "";
  return (
    <img
      src={cur}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => {
        if (i < candidates.length - 1) setI(i + 1);
      }}
    />
  );
}

/* === Placeholder === */
function svgPlaceholder(title = "Item", idx = 1) {
  const t = encodeURIComponent(String(title).slice(0, 22));
  const palette = ["#F1F5F9", "#F8FAFC", "#EFF6FF", "#F5F3FF", "#ECFEFF"];
  const bg = palette[idx % palette.length];
  const fg = "#1F2937";
  return (
    "data:image/svg+xml;utf8," +
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>` +
    `<rect width='100%' height='100%' rx='12' fill='${bg}'/>` +
    `<text x='50%' y='50%' font-size='12' font-family='Inter,Arial' fill='${fg}' text-anchor='middle' dominant-baseline='middle'>${t}</text>` +
    `</svg>`
  );
}

/* ===== order-display cache (so Record page shows the SAME stuff) ===== */
const OD_KEY = (uid) => `orderDisplay:${uid}`;
function saveDisplay(uid, orderId, payload) {
  try {
    const key = OD_KEY(uid);
    const map = JSON.parse(localStorage.getItem(key) || "{}");
    map[orderId] = payload;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

/* === product pick for single tasks (avoid numeric-only titles) === */
function pickProductForTask(rawTask) {
  const hint = rawTask?.title || rawTask?.name || "";
  let chosen = pickProductByHint(hint);
  if (/^\s*\d+\s*$/.test(chosen?.title || "")) {
    const alt = getRandomProducts(1)[0] || {};
    chosen = { title: alt.title || "Product", image: alt.image || chosen.image || "" };
  }
  return {
    title: cleanTitle(chosen?.title || "Product"),
    image: chosen?.image || "",
  };
}

/* === local lock === */
const lockKey = (uid) => `unpaidLock:${uid}`;
const setLocalLock = (uid, v = true) => {
  try {
    localStorage.setItem(lockKey(uid), v ? "1" : "");
  } catch {}
};
const clearLocalLock = (uid) => {
  try {
    localStorage.removeItem(lockKey(uid));
  } catch {}
};

/* === UI overlays === */
function CenterTip({ show, text, anchor }) {
  if (!show) return null;
  const anchored = anchor && Number.isFinite(anchor.top) && Number.isFinite(anchor.cx);
  const wrapperStyle = anchored
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
        bottom: 140,
        display: "flex",
        justifyContent: "center",
        zIndex: 300005,
        pointerEvents: "none",
      };
  const innerWrapStyle = anchored ? {} : { display: "flex", justifyContent: "center" };
  return createPortal(
    <div style={wrapperStyle}>
      <div style={innerWrapStyle}>
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
          }}
        >
          {text}
        </div>
      </div>
    </div>,
    document.body
  );
}
function LoaderOverlay({ show, label = "Please wait…" }) {
  if (!show) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200000,
        background: "rgba(255,255,255,.35)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          border: "3px solid #eee",
          borderTopColor: "#333",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <div style={{ marginLeft: 10, fontWeight: 700 }}>{label}</div>
    </div>,
    document.body
  );
}

/* ===================== Task Popup ===================== */
function TaskPopup({ task, onClose, onSubmit, submitting, onAnchorReady }) {
  const displayOrderNo = String(task?.id ?? task?.orderNo ?? "").replace(/^t[_-]?/i, "");

  const cardRef = useRef(null);
  useEffect(() => {
    if (!task) return;
    const update = () => {
      if (!cardRef.current || !onAnchorReady) return;
      const r = cardRef.current.getBoundingClientRect();
      onAnchorReady({ top: r.bottom - 220, cx: r.left + r.width / 2 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [task, onAnchorReady]);

  if (!task) return null;

  const hasItems = Array.isArray(task.items) && task.items.length > 0;
  const isCombineLike =
    hasItems || task?.kind === "combine" || task?.type === "combined" || Number(task?.deficit) > 0;
  const displayItems = isCombineLike ? (hasItems ? task.items : synthesizeItems(task)) : [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: 300000,
        background: "rgba(0,0,0,.35)",
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: "92vw",
          maxWidth: "420px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            position: "relative",
          }}
        >
          <div style={{ textAlign: "center", fontWeight: 900, fontSize: 22 }}>
            Successful order
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "10px 18px 4px",
            textAlign: "center",
            color: "#ef4444",
            fontWeight: 800,
          }}
        >
          Order Nos: <span style={{ textDecoration: "underline" }}>{displayOrderNo}</span>
        </div>
        <div style={{ height: 1, background: "#f1f1f4", marginTop: 10 }} />

        <div style={{ padding: "16px 18px 4px" }}>
          {isCombineLike ? (
            <div
              style={{
                maxHeight: 180,
                overflow: "auto",
                margin: "6px 0 10px",
                paddingRight: 8,
              }}
            >
              {displayItems.slice(0, 5).map((it, idx) => {
                const title = it.title || `Product #${idx + 1}`;
                const fallback = svgPlaceholder(title, idx);
                const src = it.image;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px",
                      border: "1px solid #f1f1f4",
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
                      <SmartImg
                        src={src}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        fallback={fallback}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={title}
                      >
                        {title}
                      </div>
                      <div
                        style={{
                          color: "#f59e0b",
                          fontWeight: 700,
                          marginTop: 2,
                          fontSize: 13.5,
                        }}
                      >
                        {(Number(it.unitPrice ?? it.price ?? 0)).toFixed(2)} USDT
                      </div>
                    </div>
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: 13,
                        fontWeight: 600,
                        paddingLeft: 6,
                      }}
                    >
                      x{Number(it.quantity || 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "96px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "6px 6px 12px",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #eee",
                  background: "#fafafa",
                }}
              >
                <SmartImg
                  src={task.image}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  fallback={svgPlaceholder(task.title, 0)}
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{task.title}</div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#f59e0b",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {fmt(task.unitPrice, 2)} USDT
                </div>
              </div>
              <div style={{ alignSelf: "start", color: "#94a3b8", fontSize: 13 }}>
                x{task.quantity || 1}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 6,
              fontSize: 15.5,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 14,
              columnGap: 10,
            }}
          >
            <div>Order amount</div>
            <div style={{ textAlign: "right" }}>{fmt(task.orderAmount, 2)} USDT</div>
            <div>Commissions</div>
            <div style={{ textAlign: "right" }}>{fmt(task.commission, 3)} USDT</div>
            <div>Rate</div>
            <div style={{ textAlign: "right" }}>
              {typeof task.commissionRate === "number"
                ? `${(task.commissionRate * 100).toFixed(1)}%`
                : task.commissionRate}
            </div>
            <div style={{ fontWeight: 700 }}>Expected income</div>
            <div
              style={{
                textAlign: "right",
                color: "#f59e0b",
                fontWeight: 800,
              }}
            >
              {fmt(Number(task.orderAmount || 0) + Number(task.commission || 0), 3)} USDT
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 10,
              border: 0,
              background: "#5a3b35",
              color: "#fff",
              fontWeight: 800,
              boxShadow: "0 10px 24px rgba(91,59,53,.35)",
              cursor: "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting…" : "Submit order"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ====== synthesized items for combine (REAL products only) ====== */
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
  const id = String(task?.id || Date.now());
  const rnd = seededRand(hashStr(id));
  const count = 4 + Math.floor(rnd() * 2); // 4–5 items
  const picks = getRandomProducts(count);   // real, no-repeat (rotation handled inside)

  let remaining = Math.max(1, Math.round((toNum(task.orderAmount) || 80) * 100));
  const items = [];
  for (let i = 0; i < count; i++) {
    const p = picks[i % picks.length] || {};
    const qty = 1 + Math.floor(rnd() * 3);
    let cents = 500 + Math.floor(rnd() * 3000);
    if (i === count - 1 && remaining > 0) {
      cents = Math.max(300, Math.min(remaining / qty, 8000));
    }
    const unit = Math.round(cents) / 100;
    items.push({
      title: cleanTitle(p.title || "Product"),
      image: p.image || "",
      quantity: qty,
      unitPrice: unit,
    });
    remaining -= Math.round(unit * 100) * qty;
  }
  return items;
}

/* ===== Brand-specific Hints ===== */
const HINTS = {
  amazon: [
    "4% of the amount of completed transactions earned.",
    "The system sends tasks randomly. Complete them as soon as possible after matching them, so as to avoid hanging all the time.",
    "For unpaid order go to record and submit order",
  ],
  alibaba: [
    "8% of the amount of completed transactions earned.",
    "The system sends tasks randomly. Complete them as soon as possible after matching them, so as to avoid hanging all the time.",
    "For unpaid order go to record and submit order",
  ],
  aliexpress: [
    "12% of the amount of completed transactions earned.",
    "The system sends tasks randomly. Complete them as soon as possible after matching them, so as to avoid hanging all the time.",
    "For unpaid order go to record and submit order",
  ],
};

/* ===================== Brand detail ===================== */
function BrandDetail({ onBack, title, brandKey = "Order" }) {
  const HERO_SPACER = 190;
  const [toastAnchor, setToastAnchor] = useState(null);
  const [panelAnchor, setPanelAnchor] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const update = () => {
      if (!panelRef.current) return;
      const r = panelRef.current.getBoundingClientRect();
      setPanelAnchor({ top: r.bottom - 90, cx: r.left + r.width / 2 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const uid = String(
    localStorage.getItem("uid") || localStorage.getItem("activeUserId") || "uu1"
  );
  const [userId] = useState(uid);
  const [loading, setLoading] = useState(false);
  const [taskResp, setTaskResp] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [tip, setTip] = useState({ show: false, text: "" });
  const tipTimer = useRef(null);
  const showTip = (t) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip({ show: true, text: t });
    tipTimer.current = setTimeout(() => setTip({ show: false, text: "" }), 2500);
  };

  const [prog, setProg] = useState({
    completedToday: 0,
    balance: 0,
    todayCommission: 0,
    overallCommission: 0,
    maxTasksPerDay: 25,
    cashGap: 0,
    isFrozen: false,
  });

  /* ---------- Coalescer + TTL cache (3s) ---------- */
  function makeFetcher(fn, ttlMs = 3000) {
    const state = { inFlight: null, ts: 0, data: null };
    return () => {
      const now = Date.now();
      if (state.inFlight) return state.inFlight;
      if (now - state.ts < ttlMs && state.data) return Promise.resolve(state.data);
      state.inFlight = Promise.resolve()
        .then(fn)
        .then((res) => {
          state.data = res;
          state.ts = Date.now();
          return res;
        })
        .finally(() => {
          state.inFlight = null;
        });
      return state.inFlight;
    };
  }

  const progressFetch = useRef(null);
  const recordsFetch = useRef(null);

  useEffect(() => {
    progressFetch.current = makeFetcher(() => getProgress(userId), 3000);
    recordsFetch.current = makeFetcher(() => getRecords(userId), 3000);
  }, [userId]);

  // --- progress fetch with de-dupe ---
  const progressLock = useRef(false);
  const refreshProgress = async () => {
    try {
      const p = await (progressFetch.current ? progressFetch.current() : getProgress(userId));
      setProg({
        completedToday: Number(p?.completedToday || 0),
        balance: Number(p?.balance || 0),
        todayCommission: Number(p?.todayCommission || 0),
        overallCommission: Number(p?.overallCommission || 0),
        maxTasksPerDay: Number(p?.maxTasksPerDay || 25),
        cashGap: Number(p?.cashGap || 0),
        isFrozen: !!p?.isFrozen,
      });
    } catch {}
  };
  const refreshProgressOnce = () => {
    if (progressLock.current) return;
    progressLock.current = true;
    Promise.resolve()
      .then(refreshProgress)
      .finally(() => {
        setTimeout(() => (progressLock.current = false), 250);
      });
  };

  useEffect(() => {
    refreshProgressOnce(); // mount par single shot
  }, []); // eslint-disable-line

  const rawTask = taskResp?.task || null;

  const popupTask = useMemo(() => {
    if (!rawTask) return null;
    const isCombine =
      rawTask?.kind === "combine" ||
      rawTask?.type === "combined" ||
      Array.isArray(rawTask?.items) ||
      Number(rawTask?.deficit) > 0;

    if (isCombine) {
      const items = synthesizeItems(rawTask);
      const normalized = items.map((it, idx) => ({
        ...it,
        unitPrice: toNum(it.unitPrice ?? it.price ?? 0),
        quantity: Number(it.quantity || 1),
        image: it.image || "",
        title: cleanTitle(it.title || `Product #${idx + 1}`),
      }));
      let orderAmount = toNum(rawTask.orderAmount);
      if (!orderAmount)
        orderAmount = normalized.reduce(
          (s, it) => s + toNum(it.unitPrice) * Number(it.quantity || 1),
          0
        );
      let commission = toNum(rawTask.commission);
      let rate = typeof rawTask.commissionRate === "number" ? rawTask.commissionRate : 0.2;
      if (!commission && rate) commission = +(orderAmount * rate).toFixed(3);
      if (!rate && commission && orderAmount > 0) rate = commission / orderAmount;
      return {
        id: rawTask.id || `ord-${Date.now()}`,
        kind: "combine",
        items: normalized,
        deficit: Number(rawTask.deficit || 0),
        orderAmount: +orderAmount.toFixed(3),
        commission: +commission.toFixed(3),
        commissionRate: rate || 0,
        __ruleId: rawTask.__ruleId || "",
      };
    }

    // single
    const amount = toNum(rawTask.orderAmount ?? rawTask.amount ?? rawTask.unitPrice);
    let rate = typeof rawTask.commissionRate === "number" ? rawTask.commissionRate : 0.04;
    let commission = toNum(rawTask.commission);
    if (!commission) commission = +(amount * rate).toFixed(3);
    if (!rate && amount > 0 && commission > 0) rate = commission / amount;

    const chosen = pickProductForTask(rawTask);

    return {
      id: rawTask.id || `ord-${Date.now()}`,
      kind: "single",
      image: chosen.image,
      title: chosen.title,
      unitPrice: Number(rawTask.unitPrice ?? amount).toFixed(2),
      quantity: Number(rawTask.quantity ?? 1),
      orderAmount: +amount.toFixed(2),
      commission,
      commissionRate: rate,
    };
  }, [rawTask]);

  /* Save what we display -> so RecordPage shows exactly the same */
  useEffect(() => {
    if (!popupTask) return;
    if (popupTask.kind === "single") {
      saveDisplay(userId, popupTask.id, {
        kind: "single",
        title: popupTask.title,
        image: popupTask.image,
        quantity: popupTask.quantity,
      });
    } else {
      saveDisplay(userId, popupTask.id, {
        kind: "combine",
        items: popupTask.items.map(({ title, image, quantity, unitPrice }) => ({
          title,
          image,
          quantity,
          unitPrice,
        })),
      });
    }
  }, [popupTask, userId]);

  // ------- unpaid fetch uses coalesced fetchers -------
  async function fetchUnpaid() {
    try {
      const [p, r] = await Promise.all([
        progressFetch.current ? progressFetch.current() : getProgress(userId),
        recordsFetch.current ? recordsFetch.current() : getRecords(userId),
      ]);
      if (p?.unpaid) return p.unpaid;
      if (r?.unpaid) return r.unpaid;
      if (Array.isArray(r?.incomplete) && r.incomplete.length) return r.incomplete[0];
    } catch {}
    return null;
  }

  async function handleClosePopup() {
    setShowCard(false);
    try {
      if (rawTask) await submitUnpaid(userId, rawTask);
    } catch {}
    setLocalLock(userId, true);
    refreshProgressOnce();
  }

  // 🔹 brand-wise minimums
  const MIN_REQUIRED = {
    amazon: 20,
    alibaba: 499,
    aliexpress: 901,
    ebay: 1000,
  };

  async function handleGrab() {
    if (loading) return;
    setLoading(true);
    try {
      const store = String(brandKey || "").toLowerCase();
      const need = MIN_REQUIRED[store] ?? 0;
      const curBal = Number(prog.balance || 0);
      if (need > 0 && curBal < need) {
        showTip(`Insufficient balance: ${need} USDT required for ${title}`);
        setLoading(false);
        return;
      }

      const unpaid = await fetchUnpaid();
      if (unpaid) {
        setTaskResp(null);
        setShowCard(false);
        setLocalLock(userId, true);
        showTip("Unpaid order");
        refreshProgressOnce();
        setLoading(false);
        return;
      }

      const data = await getNextTask(userId, store);

      if (data?.notEligible) {
        showTip(data.message || "Your balance is too low for this tier.");
        refreshProgressOnce();
        setLoading(false);
        return;
      }
      if (data?.suggestUpgrade && data?.suggestMessage) {
        setTimeout(() => showTip(data.suggestMessage), 0);
      }

      if (data?.noMore) {
        showTip(data.message || "No more tasks");
        setLoading(false);
        return;
      }
      if (data?.unpaid) {
        showTip("Unpaid order");
        setLocalLock(userId, true);
        refreshProgressOnce();
        setLoading(false);
        return;
      }
      if (!data?.task) {
        refreshProgressOnce();
        setLoading(false);
        return;
      }
      setTaskResp({ task: data.task });
      setShowCard(true);

      const def = Number(data.task.deficit || 0);
      if (def > 0)
        setTimeout(() => {
          showTip(
            `Your account balance is not enough, you need to recharge ${def.toFixed(3)} USDT to submit this order`
          );
        }, 0);

      refreshProgressOnce();
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!popupTask) return;
    if (popupTask.kind === "combine" && Number(popupTask.deficit || 0) > 0) {
      const need = Number(popupTask.deficit || 0);
      showTip(
        `Your account balance is not enough, you need to recharge ${need.toFixed(3)} USDT to submit this order`
      );
      return;
    }
    setLoading(true);
    try {
      await submitUnpaid(userId, rawTask);
      const resp = await completeTask(userId, popupTask.id, "");

      if (resp?.ok) {
        __pushDone(userId, __snap(popupTask, Date.now()));
        showTip("Success ✓");
        clearLocalLock(userId);
        setTaskResp(null);
        setShowCard(false);
        refreshProgressOnce();
      }
    } catch (err) {
      const data = err?.data || {};
      if (data.needRecharge) {
        const need = Number.isFinite(Number(data.deficit)) ? Number(data.deficit) : 0;
        showTip(
          `Your account balance is not enough, you need to recharge ${need.toFixed(3)} USDT to submit this order`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const showCardFlag = showCard && popupTask;
  const hintLines = HINTS[String(brandKey).toLowerCase()] || [];

  return (
    <>
      <section className="bd-hero s1" style={{ position: "relative" }}>
        <div className="wrap bd-wrap">
          <button className="bd-back" onClick={onBack} type="button" aria-label="Back">
            <FiChevronLeft />
          </button>
          <h2 className="bd-title">{title}</h2>
          <div className="bd-balance">
            <div className="bd-k">Account Balance:</div>
            <div className="bd-v">{(Number(prog.balance) || 0).toFixed(3)} USDT</div>
          </div>
          <div style={{ height: 190 }} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -20,
            height: 40,
            background: "#fff",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            zIndex: 1,
          }}
        />
      </section>

      <section className="bd-body s1" style={{ background: "#fff", position: "relative", zIndex: 2 }}>
        <div className="wrap bd-wrap">
          <div style={{ position: "relative", zIndex: 3, transform: "translateY(-70px)", marginBottom: -70 }}>
            <div ref={panelRef} className="bd-panel" style={{ position: "relative" }}>
              <div className="bd-grid">
                {[
                  { k: String(Number(prog.completedToday || 0)), v: "Today’s Times" },
                  { k: `${fmt(prog.todayCommission, 3)} USDT`, v: "Current commission" },
                  { k: `${fmt(prog.cashGap, 3)} USDT`, v: "Cash gap between tasks" },
                  { k: `${fmt(prog.overallCommission, 3)} USDT`, v: "Overall commission" },
                  { k: "0USDT", v: "Yesterday’s team commission" },
                  { k: prog.isFrozen ? "Freeze" : "Active", v: "Account Status", status: true },
                ].map((n) => (
                  <div key={n.v} className="bd-cell">
                    <div
                      className="bd-v small"
                      style={
                        n.status
                          ? { color: prog.isFrozen ? "#dc2626" : "#16a34a", fontWeight: 700 }
                          : undefined
                      }
                    >
                      {n.k}
                    </div>
                    <div className="bd-k sub">{n.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button className="grab-btn big fit" onClick={handleGrab} style={{ marginTop: 26 }}>
            <FiZap style={{ marginRight: 6 }} /> Grab the order immediately
          </button>

          {!!hintLines.length && (
            <div className="bd-hint" style={{ marginTop: 22 }}>
              <div className="hint-title">Hint:</div>
              <ol>
                {hintLines.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="bottom-space" />
        </div>
      </section>

      {showCardFlag ? (
        <TaskPopup
          task={popupTask}
          onClose={handleClosePopup}
          onSubmit={handleSubmit}
          submitting={loading}
          onAnchorReady={setToastAnchor}
        />
      ) : null}

      <CenterTip show={tip.show} text={tip.text} anchor={showCardFlag ? toastAnchor : panelAnchor} />
      <LoaderOverlay show={loading} />
    </>
  );
}

/* ======================= list DATA ======================= */
const DATA = [
  { id: "amazon", name: "Amazon", vip: 1, balance: "20–498 USDT", commission: "4%" },
  { id: "alibaba", name: "Alibaba", vip: 2, balance: "499–900 USDT", commission: "8%" },
  { id: "aliexpress", name: "AliExpress", vip: 3, balance: "901+ USDT", commission: "12%" },
  { id: "ebay", name: "eBay", vip: 4, balance: "1000 USDT", commission: "18%", locked: true },
];

/* ======================= list card ======================= */
const BrandCard = React.memo(function BrandCard({
  id,
  name,
  balance,
  commission,
  vip,
  locked,
  onOpen,
}) {
  const handle = () => {
    if (!locked && onOpen) onOpen(id);
  };
  const renderBalance = () => {
    if (typeof balance !== "string") return balance;
    const txt = balance.replace(/\s*USDT/i, "").trim();
    return (
      <>
        <span className="main">{txt}</span>
        <span className="unit">&nbsp;USDT</span>
      </>
    );
  };
  return (
    <article
      className={`brand-card${locked ? " locked" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handle}
    >
      <div className="brand-left">
        <BrandLogo id={id} name={name} />
        <span className={`vip-badge ${VIP_TAG(vip)}`}>VIP {vip}</span>
      </div>
      <div className="brand-mid">
        <h3 className="brand-name">{name}</h3>
        <p className="brand-meta">
          <span className="label">Available balance:</span>
          <span className="value">{renderBalance()}</span>
        </p>
        <p className="brand-meta">
          <span className="label">Commissions:</span>
          <span className="value">{commission}</span>
        </p>
      </div>
      <FiChevronRight className="brand-chevron" />
      {locked && (
        <div className="lock-pill" aria-label="Locked">
          <FiLock aria-hidden="true" />
          <span>Locked</span>
        </div>
      )}
    </article>
  );
});

/* ======================= Root ======================= */
export default function MenuPage() {
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("all");
  const list = useMemo(() => {
    if (tab === "all") return DATA;
    const n = Number(tab.split("-")[1]);
    return DATA.filter((d) => d.vip === n);
  }, [tab]);

  if (view === "amazon")
    return <BrandDetail onBack={() => setView("list")} title="Amazon" brandKey="amazon" />;
  if (view === "alibaba")
    return <BrandDetail onBack={() => setView("list")} title="Alibaba" brandKey="alibaba" />;
  if (view === "aliexpress")
    return <BrandDetail onBack={() => setView("list")} title="AliExpress" brandKey="aliexpress" />;

  return (
    <div className="wrap menu-page">
      <h2 className="menu-title">Menu</h2>
      <div className="chipsx">
        {["all", "vip-1", "vip-2", "vip-3", "vip-4"].map((t) => (
          <button
            key={t}
            className={`chipx ${tab === t ? "on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "all" ? "All" : t.toUpperCase().replace("-", " ")}
          </button>
        ))}
      </div>
      <div className="brand-list">
        {list.map((b) => (
          <BrandCard
            key={b.id}
            {...b}
            onOpen={(id) => {
              if (id === "amazon") setView("amazon");
              if (id === "alibaba") setView("alibaba");
              if (id === "aliexpress") setView("aliexpress");
            }}
          />
        ))}
      </div>
    </div>
  );
}
