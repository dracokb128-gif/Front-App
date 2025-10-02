function CompletedCard({ snap }) {
  const f =
    snap.kind === "combine"
      ? (snap.items && snap.items[0]) || {}
      : { title: snap.title, image: snap.image, unitPrice: snap.unitPrice, quantity: snap.quantity };
  const fallback = svgPlaceholder(f.title || "Item", 0);
  const expected = toNum(snap.orderAmount) + toNum(snap.commission);
  const dt = new Date(snap.ts || Date.now());
  const time = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} `
    + `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}`;

  return (
    <div className="card" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.06)", padding: 16, marginBottom: 16 }}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Order Nos</div>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{stripT(snap.id)}</div>
      <div style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", background: "#fafafa", border: "1px solid #eee" }}>
            <img src={f.image || ""} onError={(e) => { e.currentTarget.src = fallback; }} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.title || "Item"}</div>
            <div style={{ color: "#f59e0b", fontWeight: 700, marginTop: 2, fontSize: 13.5 }}>{fmt(f.unitPrice || 0, 2)} USDT</div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, paddingLeft: 6 }}>x{Number(f.quantity || 1)}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 12, columnGap: 10, fontSize: 15.5 }}>
        <div>Transaction time</div><div style={{ textAlign: "right" }}>{time}</div>
        <div>Order amount</div><div style={{ textAlign: "right" }}>{fmt(snap.orderAmount, 2)} USDT</div>
        <div>Commissions</div><div style={{ textAlign: "right" }}>{fmt(snap.commission, 4)} USDT</div>
        <div style={{ fontWeight: 800 }}>Expected income</div>
        <div style={{ textAlign: "right", color: "#f59e0b", fontWeight: 800 }}>{fmt(expected, 4)} USDT</div>
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

  const [cashGap, setCashGap] = useState(0);
  const [balance, setBalance] = useState(0);

  async function refreshAll() {
    try {
      const r = await getRecords(userId);
      const u = r?.unpaid || (Array.isArray(r?.incomplete) && r.incomplete.length ? r.incomplete[0] : null) || r?.unpaidTask || null;
      setRawUnpaid(hydrateFromDisplay(u || null, userId)); // ✅ always hydrate
    } catch {}
    setCompleted(listCompleted(userId));
  }
  async function refreshProgress(silent = true) {
    try {
      const p = await getProgress(userId);
      setCashGap(Number(p?.cashGap || 0));
      setBalance(Number(p?.balance || 0));
      if (p?.unpaid) setRawUnpaid(hydrateFromDisplay(p.unpaid, userId)); // ✅ always hydrate
    } catch {}
  }
  useEffect(() => { refreshAll(); refreshProgress(true); }, [userId]);

  const task = useMemo(() => rawUnpaid ? hydrateFromDisplay(rawUnpaid, userId, synthesizeItems) : null, [rawUnpaid, userId]);

  async function handleSubmit() {
    if (!task) return;
    await refreshProgress(true);
    const latestNeed = Math.max(0, Number(cashGap || task.deficit || 0));
    if (latestNeed > 0.0005) { return setTip({ show: true, text: `Recharge ${latestNeed.toFixed(3)} USDT to submit` }); }
    setLoading(true);
    try {
      if (rawUnpaid) { try { await submitUnpaid(userId, rawUnpaid); } catch {} }
      const resp = await completeTask(userId, task.id, "");
      if (resp?.ok) { pushCompleted(userId, snapshotFromTask(task, Date.now())); setTip({ show: true, text: "Succeeded ✓" }); await refreshAll(); await refreshProgress(true); }
    } finally { setLoading(false); }
  }

  return (
    <div className="wrap record-page" style={{ paddingBottom: 90 }}>
      <h2 className="menu-title">Record</h2>
      {/* tabs */}
      <div className="rec-tabs">
        <button className={`rec-tab ${tab === "incomplete" ? "active" : ""}`} onClick={() => setTab("incomplete")}>Incomplete</button>
        <button className={`rec-tab ${tab === "complete" ? "active" : ""}`} onClick={() => setTab("complete")}>Complete</button>
      </div>
      {/* Incomplete */}
      {tab === "incomplete" && task ? (
        <div ref={cardRef} className="card" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.06)", padding: 16 }}>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Order Nos</div>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>{stripT(task.id)}</div>
          {/* items list */}
          ...
        </div>
      ) : (tab === "incomplete" && <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No unpaid order.</div>)}
      {tab === "complete" && (completed.length ? completed.map((c) => <CompletedCard key={`${c.id}-${c.ts}`} snap={c} />) :
        <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No more</div>)}
      <CenterTip show={tip.show} text={tip.text} anchor={anchor} />
    </div>
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
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ` +
    `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}`;

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
              onError={(e) => { e.currentTarget.src = fallback; }}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {f.title || "Item"}
            </div>
            <div style={{ color: "#f59e0b", fontWeight: 700, marginTop: 2, fontSize: 13.5 }}>{fmt(f.unitPrice || 0, 2)} USDT</div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, paddingLeft: 6 }}>x{Number(f.quantity || 1)}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 12, columnGap: 10, fontSize: 15.5 }}>
        <div>Transaction time</div><div style={{ textAlign: "right" }}>{time}</div>
        <div>Order amount</div><div style={{ textAlign: "right" }}>{fmt(snap.orderAmount, 2)} USDT</div>
        <div>Commissions</div><div style={{ textAlign: "right" }}>{fmt(snap.commission, 4)} USDT</div>
        <div style={{ fontWeight: 800 }}>Expected income</div>
        <div style={{ textAlign: "right", color: "#f59e0b", fontWeight: 800 }}>{fmt(expected, 4)} USDT</div>
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

  const [cashGap, setCashGap] = useState(0);
  const [balance, setBalance] = useState(0);

  async function refreshAll() {
    try {
      const r = await getRecords(userId);
      const u = r?.unpaid || (Array.isArray(r?.incomplete) && r.incomplete.length ? r.incomplete[0] : null) || r?.unpaidTask || null;
      setRawUnpaid(hydrateFromDisplay(u || null, userId)); // ✅ fix applied
    } catch {}
    setCompleted(listCompleted(userId));
  }

  async function refreshProgress(silent = true) {
    try {
      const p = await getProgress(userId);
      setCashGap(Number(p?.cashGap || 0));
      setBalance(Number(p?.balance || 0));
      if (p?.unpaid) setRawUnpaid(hydrateFromDisplay(p.unpaid, userId)); // ✅ fix applied
    } catch {}
  }

  useEffect(() => { refreshAll(); refreshProgress(true); }, [userId]);

  const task = useMemo(
    () => (rawUnpaid ? hydrateFromDisplay(rawUnpaid, userId, synthesizeItems) : null),
    [rawUnpaid, userId]
  );

  async function handleSubmit() {
    if (!task) return;
    await refreshProgress(true);
    const latestNeed = Math.max(0, Number(cashGap || task.deficit || 0));
    if (latestNeed > 0.0005) {
      return setTip({ show: true, text: `Recharge ${latestNeed.toFixed(3)} USDT to submit` });
    }
    setLoading(true);
    try {
      if (rawUnpaid) { try { await submitUnpaid(userId, rawUnpaid); } catch {} }
      const resp = await completeTask(userId, task.id, "");
      if (resp?.ok) {
        pushCompleted(userId, snapshotFromTask(task, Date.now()));
        setTip({ show: true, text: "Succeeded ✓" });
        await refreshAll();
        await refreshProgress(true);
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="wrap record-page" style={{ paddingBottom: 90 }}>
      <h2 className="menu-title">Record</h2>
      {/* Tabs */}
      <div className="rec-tabs">
        <button className={`rec-tab ${tab === "incomplete" ? "active" : ""}`} onClick={() => setTab("incomplete")}>Incomplete</button>
        <button className={`rec-tab ${tab === "complete" ? "active" : ""}`} onClick={() => setTab("complete")}>Complete</button>
      </div>
      {/* Incomplete */}
      {tab === "incomplete" && task ? (
        <div ref={cardRef} className="card" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.06)", padding: 16 }}>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Order Nos</div>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>{stripT(task.id)}</div>
          {/* items rendering (same as before, no change) */}
        </div>
      ) : (
        tab === "incomplete" && <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No unpaid order.</div>
      )}
      {/* Complete */}
      {tab === "complete" && (
        completed.length
          ? completed.map((c) => <CompletedCard key={`${c.id}-${c.ts}`} snap={c} />)
          : <div className="card" style={{ padding: 16, borderRadius: 14, background: "#fff" }}>No more</div>
      )}
      <CenterTip show={tip.show} text={tip.text} anchor={anchor} />
    </div>
  );
}
