// src/admin/Deposits.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  adminListDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  adminListAddresses,
  adminAddAddresses,
  adminDeleteAddress,
  adminListUsers,
} from "../api";

export default function DepositsAdmin() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(""); // "", "PENDING", "APPROVED", "REJECTED"
  const [loading, setLoading] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);

  // users → username + createdAt maps
  const [usersMap, setUsersMap] = useState({});
  const [userCreatedAtMap, setUserCreatedAtMap] = useState({});

  // search box
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  // toast
  const [toast, setToast] = useState({ show: false, text: "", kind: "success" });
  function showToast(text, kind = "success", ms = 1500) {
    setToast({ show: true, text, kind });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast({ show: false, text: "", kind }), ms);
  }

  /* ---------------- data: deposits ---------------- */
  async function load() {
    setLoading(true);
    try {
      const resp = await adminListDeposits(status);
      setRows(resp?.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [status]);

  /* ---------------- data: users (for filter + name mapping) ---------------- */
  async function loadUsers() {
    try {
      const list = await adminListUsers();
      const nameMap = {};
      const createdMap = {};
      (list || []).forEach((u) => {
        const id = String(u.id);
        nameMap[id] = u.username;
        const t = u.createdAt ? +new Date(u.createdAt) : 0;
        createdMap[id] = t || 0;
      });
      setUsersMap(nameMap);
      setUserCreatedAtMap(createdMap);
    } catch {
      setUsersMap({});
      setUserCreatedAtMap({});
    }
  }
  useEffect(() => { loadUsers(); }, []);

  /* ---------------- deposits filter logic ---------------- */
  function applyFilter(data, query, names, userCreated) {
    const s = String(query || "").trim().toLowerCase();
    const validUserIds = new Set(Object.keys(names));

    return (data || []).filter((r) => {
      const idStr = String(r.userId || "");

      // 1) user must still exist
      if (!validUserIds.has(idStr)) return false;

      // 2) deposit must be newer than (or equal to) the user's creation time
      const uCreated = userCreated[idStr] || 0;
      const dCreated = r.createdAt ? +new Date(r.createdAt) : 0;
      if (uCreated && dCreated && dCreated < uCreated) return false;

      // 3) exact search by id or username (if supplied)
      if (!s) return true;
      const uname = String(names[idStr] || "").toLowerCase();
      return s === idStr || s === uname;
    });
  }

  const filtered = useMemo(() => {
    let list = applyFilter(rows, q, usersMap, userCreatedAtMap);
    list = historyMode
      ? list.filter((r) => r.status === "APPROVED" || r.status === "REJECTED")
      : list.filter((r) => r.status === "PENDING");
    return list;
  }, [rows, q, usersMap, userCreatedAtMap, historyMode]);

  const triggerSearch = () => setQ(qInput);
  const onSearchKey = (e) => { if (e.key === "Enter") setQ(qInput); };

  /* ---------------- actions on deposits ---------------- */
  const onApprove = async (id) => {
    await adminApproveDeposit(id, "");
    await load();
    showToast("Approved ✓", "success");
  };
  const onReject = async (id) => {
    if (!window.confirm("Reject this deposit?")) return;
    await adminRejectDeposit(id, "");
    await load();
    showToast("Rejected ✗", "danger");
  };

  /* ================== TRC Address Pool ================== */
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrText, setAddrText] = useState("");
  const [savingAddrs, setSavingAddrs] = useState(false);
  const [addrRows, setAddrRows] = useState([]);
  const [addrLoading, setAddrLoading] = useState(false);

  // recompute "in-use" from live PENDING deposits but only for still-existing users
  function recomputeInUse(addrs, pendingDeposits, existingUsers) {
    const validUserIds = new Set((existingUsers || []).map((u) => String(u.id)));
    const pend = (pendingDeposits || []).filter(
      (d) => d.status === "PENDING" && validUserIds.has(String(d.userId))
    );
    return (addrs || []).map((a) => {
      const inUse = pend.some((d) => d.address === a.address);
      return { ...a, isAssigned: inUse };
    });
  }

  async function loadAddrs() {
    setAddrLoading(true);
    try {
      const [addrResp, usersResp, depsResp] = await Promise.all([
        adminListAddresses(),
        adminListUsers(),
        adminListDeposits("PENDING"),
      ]);
      const addrs = Array.isArray(addrResp) ? addrResp : addrResp?.items || [];
      const users = Array.isArray(usersResp) ? usersResp : usersResp?.items || [];
      const deps  = depsResp?.items || [];
      const computed = recomputeInUse(addrs, deps, users);
      setAddrRows(computed);
    } finally {
      setAddrLoading(false);
    }
  }
  useEffect(() => { if (addrOpen) loadAddrs(); }, [addrOpen]);

  async function saveAddresses() {
    const txt = (addrText || "").trim();
    if (!txt) return alert("Please paste 1 or more TRC-20 addresses (one per line)");
    try {
      setSavingAddrs(true);
      const resp = await adminAddAddresses(txt); // string lines supported in api.js
      alert(resp?.msg || `Added ${resp?.added || 0} address(es)`);
      setAddrText("");
      await loadAddrs();
    } finally {
      setSavingAddrs(false);
    }
  }

  async function removeAddress(address) {
    const warn =
      "Delete this address?" +
      "\n\nNote: If it is currently assigned to a pending deposit, it will be unassigned and freed.";
    if (!window.confirm(warn + `\n\n${address}`)) return;

    try {
      await adminDeleteAddress(address, true); // force delete (api handles cleanup)
      await loadAddrs();
      showToast("Address removed", "success");
    } catch (e) {
      alert(e?.message || "Delete failed");
    }
  }

  /* ================== UI ================== */
  return (
    <div style={{ padding: 16 }}>
      {/* toast */}
      {toast.show && (
        <div style={{
          position: "fixed", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 9999
        }}>
          <div style={{
            pointerEvents: "auto",
            background: toast.kind === "success" ? "#10b981" : "#ef4444",
            color: "#fff", padding: "10px 14px", borderRadius: 10,
            fontWeight: 700, boxShadow: "0 10px 30px rgba(0,0,0,.25)"
          }}>
            {toast.text}
          </div>
        </div>
      )}

      {/* controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        {/* History toggle */}
        <button
          type="button"
          onClick={() => setHistoryMode((v) => !v)}
          title={historyMode ? "Show Pending" : "Show History"}
          style={{
            width: 36, height: 36, minWidth: 36, display: "grid", placeItems: "center",
            borderRadius: 10, border: "1px solid #e5e7eb",
            background: historyMode ? "#eef2ff" : "#fff", cursor: "pointer"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="#111827" strokeWidth="2"></circle>
            <path d="M12 7v5l3 2" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>

        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Search by exact username or user ID..."
          style={{ height: 36, padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: 10, minWidth: 260 }}
        />
        <button className="btn" onClick={triggerSearch}>Search</button>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="btn"
          style={{ height: 36, padding: "0 10px" }}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <button onClick={load} className="btn">{loading ? "Loading..." : "Refresh"}</button>
        <button className="btn btn-primary" onClick={() => setAddrOpen(true)}>Add TRC Address</button>
      </div>

      {/* deposits table */}
      <div style={{ borderRadius: 12, overflow: "hidden", background: "#fff", border: "1px solid #eee" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f6f7fb" }}>
            <tr>
              <Th>Time</Th>
              <Th>Username</Th>
              <Th>Amount</Th>
              <Th>Address</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#666" }}>
                  {historyMode ? "No history" : "No pending deposits"}
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const uname = usersMap[String(r.userId)] || r.userId;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                  <Td>
                    <span title={String(uname)} style={{
                      display: "inline-block", maxWidth: 220, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom", fontWeight: 600
                    }}>
                      {String(uname)}
                    </span>
                  </Td>
                  <Td>{r.amount} USDT</Td>
                  <Td><code>{r.address || "-"}</code></Td>
                  <Td>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12,
                      background:
                        r.status === "PENDING" ? "#fff7e6" :
                        r.status === "APPROVED" ? "#e9fff0" : "#ffe9e9",
                      border: "1px solid #eee", fontWeight: 600
                    }}>
                      {r.status}
                    </span>
                  </Td>
                  <Td>
                    {r.status === "PENDING" && !historyMode ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => onApprove(r.id)} className="btn btn-success">Approve</button>
                        <button onClick={() => onReject(r.id)} className="btn btn-danger">Reject</button>
                      </div>
                    ) : (
                      <em>—</em>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* TRC modal */}
      {addrOpen && (
        <Overlay onClose={() => setAddrOpen(false)} title="Add / Manage TRC Address(es)">
          <p style={{ marginTop: 0, color: "#475569" }}>
            Har line par ek TRC-20 address paste karein. Save par click kar ke pool me add ho jaayega.
          </p>

          <textarea
            value={addrText}
            onChange={(e) => setAddrText(e.target.value)}
            rows={6}
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, fontFamily: "monospace" }}
            placeholder={"TL5zk...\nTX8m...\n..."}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn" onClick={() => setAddrOpen(false)}>Close</button>
            <button className="btn btn-primary" onClick={saveAddresses} disabled={savingAddrs}>
              {savingAddrs ? "Saving..." : "Save"}
            </button>
          </div>

          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e2e8f0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <strong>Saved Addresses</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>{addrRows.length} total</span>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <Th>Address</Th>
                  <Th style={{ width: 120 }}>Status</Th>
                  <Th style={{ width: 180 }}>Created</Th>
                  <Th style={{ width: 110 }}>Action</Th>
                </tr>
              </thead>
              <tbody>
                {addrLoading && (
                  <tr><td colSpan={4} style={{ padding: 12, textAlign: "center" }}>Loading...</td></tr>
                )}
                {!addrLoading && addrRows.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 12, textAlign: "center", color: "#64748b" }}>No addresses</td></tr>
                )}
                {addrRows.map((a) => (
                  <tr key={a.id || a.address} style={{ borderTop: "1px solid #eef2f7" }}>
                    <Td><code>{a.address}</code></Td>
                    <Td>{a.isAssigned ? "in-use" : "free"}</Td>
                    <Td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}</Td>
                    <Td>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeAddress(a.address)}
                        // allow deleting even if in-use; backend will unassign safely
                        title={a.isAssigned ? "In use: will unassign & delete" : "Delete"}
                      >
                        Delete
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, fontSize: 14, color: "#333", ...style }}>
      {children}
    </th>
  );
}
function Td({ children }) {
  return <td style={{ padding: "10px 12px", fontSize: 14, color: "#222", verticalAlign: "top" }}>{children}</td>;
}
function Overlay({ children, onClose, title }) {
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 9999
      }}
    >
      <div style={{
        width: "92%", maxWidth: 720, background: "#fff", borderRadius: 14,
        overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.30)"
      }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 700 }}>{title}</div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}
