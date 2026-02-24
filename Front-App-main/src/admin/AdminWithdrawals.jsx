// src/admin/Withdrawals.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  // 👇 Withdraw APIs (Deposits ke analog)
  adminListWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  // username resolve karne ke liye
  adminListUsers,
} from "../api";

export default function WithdrawalsAdmin() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");               // "", "PENDING", "APPROVED", "REJECTED"
  const [loading, setLoading] = useState(false);

  // 🔄 Deposits jaisa History toggle (left most small button)
  const [historyMode, setHistoryMode] = useState(false);

  // users → username + createdAt maps (same as deposits)
  const [usersMap, setUsersMap] = useState({});           // { "5": "ali" }
  const [userCreatedAtMap, setUserCreatedAtMap] = useState({}); // { "5": 1727400000000 }

  // search
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  // toast (same)
  const [toast, setToast] = useState({ show: false, text: "", kind: "success" });
  function showToast(text, kind = "success", ms = 1500) {
    setToast({ show: true, text, kind });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast({ show: false, text: "", kind }), ms);
  }

  /* -------------------- loads -------------------- */
  async function load() {
    setLoading(true);
    try {
      const resp = await adminListWithdrawals(status);
      setRows(resp?.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [status]);

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
  useEffect(() => {
    loadUsers();
  }, []);

  /* -------------------- filtering -------------------- */
  function applyFilter(data, query, names, userCreated) {
    const s = String(query || "").trim().toLowerCase();

    // valid existing users only
    const validUserIds = new Set(Object.keys(names));

    return (data || []).filter((r) => {
      const idStr = String(r.userId || "");
      if (!validUserIds.has(idStr)) return false;

      // withdrawal created must be >= user's creation
      const uCreated = userCreated[idStr] || 0;
      const wCreated = r.createdAt ? +new Date(r.createdAt) : 0;
      if (uCreated && wCreated && wCreated < uCreated) return false;

      // exact id/username match if query exists
      if (!s) return true;
      const uname = String(names[idStr] || "").toLowerCase();
      return s === idStr || s === uname;
    });
  }

  const filtered = useMemo(() => {
    let list = applyFilter(rows, q, usersMap, userCreatedAtMap);

    // Deposits jaisi logic:
    if (historyMode) {
      list = list.filter((r) => r.status === "APPROVED" || r.status === "REJECTED");
    } else {
      list = list.filter((r) => r.status === "PENDING");
    }

    return list;
  }, [rows, q, usersMap, userCreatedAtMap, historyMode]);

  const triggerSearch = () => setQ(qInput);
  const onSearchKey = (e) => { if (e.key === "Enter") setQ(qInput); };

  /* -------------------- actions -------------------- */
  const onApprove = async (id) => {
    await adminApproveWithdrawal(id, "");
    await load();
    showToast("Approved ✓", "success");
  };
  const onReject = async (id) => {
    if (!window.confirm("Reject this withdrawal?")) return;
    await adminRejectWithdrawal(id, "");
    await load();
    showToast("Rejected ✗", "danger");
  };

  return (
    <div style={{ padding: 16 }}>
      {/* toast (same as deposits) */}
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

      {/* Controls bar — EXACT same layout/feel as Deposits */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        {/* History toggle (same icon box spot) */}
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
        {/* Withdrawals me TRC button nahi — baki layout same rehne diya */}
      </div>

      {/* Table — same chrome and spacing as Deposits */}
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
                  {historyMode ? "No history" : "No pending withdrawals"}
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
                  <Td><code>{r.address || r.wallet || "-"}</code></Td>
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
    </div>
  );
}

/* same small helpers as Deposits */
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
