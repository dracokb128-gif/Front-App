// src/AdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiRefreshCcw, FiPlus } from "react-icons/fi";
import DepositsAdmin from "./admin/Deposits";

import {
  getUsers,
  adminChangePassword,
  adminLogout,
  // Inject API
  listInjectRules,
  createInjectRule,
  updateInjectRule,
  deleteInjectRule,
  adminApprove,
  // NEW
  patchBalance,
  deleteUserById,
  // ➜ ADD: freeze API
  adminFreeze,
} from "./api";

// ADDED: Manage modal component import
import AdminManageUser from "./AdminManageUser";

/* ------------------------- Modal etc ------------------------- */
function Modal({ open, title, children, onClose, width = 520 }) {
  if (!open) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: "92%",
          maxWidth: width,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 18px 50px rgba(0,0,0,.30)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f1f5f9",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          {title}
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
function CenterSuccess({ show }) {
  if (!show) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9998,
      }}
    >
      <div
        style={{
          background: "#22c55e",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 800,
          boxShadow: "0 10px 25px rgba(34,197,94,.35)",
          whiteSpace: "nowrap",
        }}
      >
        Success ✅
      </div>
    </div>,
    document.body
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  outline: "none",
  fontSize: 14,
};
function RowActions({ children }) {
  return <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>{children}</div>;
}
function Btn({ tone = "gray", disabled, onClick, children }) {
  const bg =
    tone === "primary" ? "#2563eb" : tone === "danger" ? "#dc2626" : tone === "amber" ? "#d97706" : "#e2e8f0";
  const color = tone === "primary" || tone === "danger" || tone === "amber" ? "#fff" : "#0f172a";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "none",
        background: disabled ? "#cbd5e1" : bg,
        color,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 100,
      }}
      type="button"
    >
      {children}
    </button>
  );
}

/* ========================= Inject Modal (updated) ========================= */
function InjectModal({ user, open, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [taskNo, setTaskNo] = useState(1);
  const [amountSpec, setAmountSpec] = useState("90");
  const [percent, setPercent] = useState("");
  // ⬇ default OFF so confirmed items remain visible
  const [hideConfirmed, setHideConfirmed] = useState(false);

  // helper: normalize + filter (only hide USED; confirmed stays unless toggle is ON)
  function visibleRules(list) {
    return (list || [])
      .filter((r) => {
        const s = String(r.status || "").toLowerCase();
        const usedLike =
          s === "used" || s === "consumed" || s === "applied" || r.used === true || r.applied === true;
        if (usedLike) return false; // always hide used
        if (hideConfirmed && s === "confirmed") return false; // optional hide confirmed
        return true;
      })
      .sort((a, b) => a.taskNo - b.taskNo);
  }

  // Load once / on toggle
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      try {
        const list = await listInjectRules(user.id);
        setRules(visibleRules(list));
      } catch (e) {
        console.error(e);
        alert("Failed to load rules");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user, hideConfirmed]);

  // 🔁 Poll (auto-clean if backend marks used later)
  useEffect(() => {
    if (!open || !user) return;
    const id = setInterval(async () => {
      try {
        const list = await listInjectRules(user.id);
        const cleaned = visibleRules(list);
        setRules((prev) => {
          const sig = (arr) => JSON.stringify(arr.map((x) => ({ id: x.id, status: x.status, taskNo: x.taskNo })));
          return sig(prev) === sig(cleaned) ? prev : cleaned;
        });
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [open, user, hideConfirmed]);

  async function addRule() {
    if (!taskNo || !amountSpec) return alert("Fill TaskNo & Amount");
    try {
      setLoading(true);
      const { rule } = await createInjectRule({
        userId: user.id,
        taskNo,
        amountSpec,
        percent: Number(percent || 0),
      });
      setRules((prev) => visibleRules([...prev, rule]));
      setAmountSpec("");
      setPercent("");
    } catch (e) {
      alert(e.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }
  async function doConfirm(r) {
    try {
      const { rule } = await updateInjectRule(r.id, { status: "confirmed" });
      setRules((prev) => visibleRules(prev.map((x) => (x.id === rule.id ? rule : x))));
    } catch (e) {
      alert(e.message || "Confirm failed");
    }
  }
  async function doEdit(r) {
    const t = prompt("Task No (1-25)", String(r.taskNo));
    if (!t) return;
    const a = prompt("Amount (single ya range e.g. 90 or 80-95)", r.amountSpec);
    if (!a) return;
    const p = prompt("Select percentage (override, optional)", String(r.percent || 0)) || "0";
    try {
      const { rule } = await updateInjectRule(r.id, {
        taskNo: Number(t),
        amountSpec: a,
        percent: Number(p) || 0,
      });
      setRules((prev) => visibleRules(prev.map((x) => (x.id === rule.id ? rule : x))));
    } catch (e) {
      alert(e.message || "Update failed");
    }
  }
  async function doDelete(r) {
    if (!window.confirm("Delete this rule?")) return;
    try {
      await deleteInjectRule(r.id);
      setRules((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Inject rules for u${user?.id}`} width={720}>
      {/* Top tools: purge + toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          className="btn btn-light"
          onClick={async () => {
            try {
              setLoading(true);
              const list = await listInjectRules(user.id);
              // delete used/consumed/applied
              const used = (list || []).filter((r) => {
                const s = String(r.status || "").toLowerCase();
                return s === "used" || s === "consumed" || s === "applied" || r.used === true || r.applied === true;
              });
              for (const r of used) {
                try { await deleteInjectRule(r.id); } catch {}
              }
              const fresh = await listInjectRules(user.id);
              setRules(visibleRules(fresh));
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          style={{ flex: "0 0 auto" }}
        >
          Purge used
        </button>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={hideConfirmed}
            onChange={(e) => setHideConfirmed(e.target.checked)}
          />
          Hide confirmed
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 120px", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Task No</div>
          <input
            type="number"
            min={1}
            max={25}
            value={taskNo}
            onChange={(e) => setTaskNo(Number(e.target.value || 1))}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Amount (single ya range)</div>
          <input placeholder="90  ya  80-95" value={amountSpec} onChange={(e) => setAmountSpec(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Select percentage (override)</div>
          <input
            type="number"
            step="0.001"
            min={0}
            placeholder="e.g. 12"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn btn-primary" onClick={addRule} disabled={loading}>
            <span>Add Row</span>
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <table className="adm-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Task No</th>
              <th>Amount</th>
              <th>% (override)</th>
              <th style={{ width: 180 }}>Status</th>
              <th style={{ width: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && <tr><td className="empty" colSpan={5}>No rules yet.</td></tr>}
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.taskNo}</td>
                <td>{r.amountSpec}</td>
                <td>{Number(r.percent || 0)}</td>
                <td><span className="badge-usdt">{r.status}</span></td>
                <td>
                  <div className="ax-row">
                    <button
                      className="ax ax-blue"
                      onClick={() => doConfirm(r)}
                      disabled={r.status === "confirmed" || r.status === "used"}
                    >
                      Confirm
                    </button>
                    <button className="ax ax-amber" onClick={() => doEdit(r)}>Edit</button>
                    <button className="ax ax-danger" onClick={() => doDelete(r)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RowActions>
        <Btn onClick={onClose}>Close</Btn>
      </RowActions>
    </Modal>
  );
}

/* ========================= Admin Page ========================= */
export default function AdminPage() {
  if (typeof window !== "undefined" && !localStorage.getItem("adminToken")) {
    // window.location.replace("/admin-login");
  }

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [centerOk, setCenterOk] = useState(false);
  const [injectUser, setInjectUser] = useState(null);

  // ADDED: state + handlers for Manage modal
  const [manageOpen, setManageOpen] = useState(false);
  const [manageUser, setManageUser] = useState(null);
  const openManage = (u) => {
    setManageUser({ id: u.id, username: u.username });
    setManageOpen(true);
  };
  const closeManage = () => setManageOpen(false);
  const handleChangeLogin = (u) => {
    alert(`Change login password for u${u.id} (${u.username})`);
  };
  const handleChangeWithdraw = (u) => {
    alert(`Change withdrawal password for u${u.id} (${u.username})`);
  };

  function showSuccess() {
    setCenterOk(true);
    setTimeout(() => setCenterOk(false), 1200);
  }
  useEffect(() => {
    if (activeTab === "users") load();
  }, [activeTab]);

  async function load() {
    try {
      setBusy(true);
      const list = await getUsers();
      setUsers(Array.isArray(list) ? list : list?.users ?? []);
    } finally {
      setBusy(false);
    }
  }

  // Approve/Reset
  async function onReset(u) {
    if (!u) return;
    const ok = window.confirm(`u${u.id} Rest Tasks ?`);
    if (!ok) return;
    try {
      setBusy(true);
      await adminApprove(u.id);
      showSuccess();
      await load();
    } catch (e) {
      alert(e.message || "Reset/Approve failed");
    } finally {
      setBusy(false);
    }
  }

  // Add Balance
  async function onAddBalance(u) {
    const txt = window.prompt(`Add balance for u${u.id} (positive add, negative deduct)`, "100");
    if (txt == null) return;
    const delta = Number(txt);
    if (!Number.isFinite(delta) || delta === 0) return alert("Invalid amount");
    try {
      setBusy(true);
      await patchBalance(u.id, delta);
      showSuccess();
      await load();
    } catch (e) {
      alert(e.message || "Add balance failed");
    } finally {
      setBusy(false);
    }
  }

  // Delete user
  async function onDelete(u) {
    const ok = window.confirm(`Delete u${u.id} (${u.username}) ?`);
    if (!ok) return;
    try {
      setBusy(true);
      await deleteUserById(u.id);
      showSuccess();
      await load();
    } catch (e) {
      alert(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  // Freeze / Unfreeze
  async function onFreeze(u) {
    try {
      setBusy(true);
      const wantFreeze = !u.isFrozen; // toggle
      await adminFreeze(u.id, wantFreeze);
      showSuccess();
      await load();
    } catch (e) {
      alert(e.message || "Freeze failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!oldPwd || !newPwd || newPwd !== confirmPwd) return alert("Fill all fields correctly.");
    try {
      await adminChangePassword(oldPwd, newPwd);
      alert("Password changed");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      alert(e.message || "Failed to change password");
    }
  }
  function handleLogout() {
    adminLogout().finally(() => {
      localStorage.removeItem("adminToken");
      window.location.assign("/admin-login");
    });
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) => String(u.id).toLowerCase().includes(s) || String(u.username || "").toLowerCase().includes(s)
    );
  }, [users, q]);

  return (
    <div className="adm-layout">
      <aside className="adm-side">
        <div className="adm-logo">LOGO</div>
        <nav className="adm-nav">
          <button
            type="button"
            className={`adm-link ${activeTab === "users" ? "is-active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            type="button"
            className={`adm-link ${activeTab === "deposits" ? "is-active" : ""}`}
            onClick={() => setActiveTab("deposits")}
          >
            Deposits
          </button>
          <button
            type="button"
            className={`adm-link ${activeTab === "withdrawals" ? "is-active" : ""}`}
            onClick={() => setActiveTab("withdrawals")}
          >
            Withdrawals
          </button>
          <button
            type="button"
            className={`adm-link ${activeTab === "tasks" ? "is-active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            Tasks
          </button>
          <button
            type="button"
            className={`adm-link ${activeTab === "settings" ? "is-active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </nav>
      </aside>

      <main className="adm-main">
        {activeTab === "users" && (
          <>
            <div className="adm-head">
              <h1>Admin Panel</h1>
              <div className="adm-tools">
                <div className="adm-search">
                  <FiSearch className="search-ico" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by name or ID" />
                </div>
                <button className="btn btn-light" onClick={load} disabled={busy}>
                  <FiRefreshCcw />
                  <span>Refresh</span>
                </button>

                {/* ✅ FIXED: missing closing parenthesis removed the ts(1005) error */}
                <button
                  className="btn btn-primary"
                  onClick={() => alert("Add User (not wired)")}
                >
                  <FiPlus />
                  <span>Add User</span>
                </button>
              </div>
            </div>

            <div className="adm-card">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th style={{ width: 220 }}>Username</th>
                    <th style={{ width: 180 }}>Balance</th>
                    <th style={{ width: 220 }}>Invitation Code</th>
                    <th style={{ width: 520 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td className="empty" colSpan={5}>No users yet.</td></tr>}
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>{`u${u.id}`}</td>
                      <td>{u.username}</td>
                      <td>
                        <span className="badge-usdt">{(u.balance ?? 0) + " USDT"}</span>
                      </td>
                      <td>{u.inviteCode || u.invite || "—"}</td>
                      <td>
                        <div className="ax-row">
                          <button className="ax ax-blue" onClick={() => setInjectUser(u)} disabled={busy}>
                            Inject
                          </button>
                          <button className="ax ax-pink" onClick={() => onReset(u)} disabled={busy}>
                            Reset
                          </button>
                          {/* Freeze toggle */}
                          <button className="ax ax-amber" onClick={() => onFreeze(u)} disabled={busy}>
                            {u.isFrozen ? "Unfreeze" : "Freeze"}
                          </button>
                          <button className="ax ax-danger" onClick={() => onDelete(u)} disabled={busy}>
                            Delete
                          </button>
                          <button className="ax ax-gray" onClick={() => onAddBalance(u)} disabled={busy}>
                            Add Balance
                          </button>
                          {/* ADDED: open manage modal */}
                          <button className="ax ax-gray" onClick={() => openManage(u)} disabled={busy}>
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="adm-foot">{filtered.length} user(s)</div>
            </div>
          </>
        )}

        {/* NEW: Deposits tab render */}
        {activeTab === "deposits" && <DepositsAdmin />}

        {activeTab === "settings" && (
          <div className="adm-card" style={{ padding: 20, maxWidth: 480 }}>
            <h2 style={{ marginBottom: 20 }}>Settings</h2>
            <Field label="Old Password">
              <input type="password" style={inputStyle} value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </Field>
            <Field label="New Password">
              <input type="password" style={inputStyle} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" style={inputStyle} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </Field>
            <RowActions>
              <Btn tone="primary" onClick={handleChangePassword}>
                Change Password
              </Btn>
            </RowActions>
            <hr style={{ margin: "20px 0" }} />
            <RowActions>
              <Btn tone="danger" onClick={handleLogout}>
                Logout
              </Btn>
            </RowActions>
          </div>
        )}
      </main>

      {/* ADDED: Manage modal mount */}
      <AdminManageUser
        open={manageOpen}
        user={manageUser}
        onClose={closeManage}
        onChangeLogin={handleChangeLogin}
        onChangeWithdraw={handleChangeWithdraw}
      />

      <CenterSuccess show={centerOk} />
      {injectUser && <InjectModal user={injectUser} open={!!injectUser} onClose={() => setInjectUser(null)} />}
    </div>
  );
}
