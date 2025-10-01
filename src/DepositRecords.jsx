// src/DepositRecords.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDepositRecords } from "./api";

export default function DepositRecords() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; }
    catch { return {}; }
  }, []);
  const userId =
    user?.id || user?._id || user?.uid || localStorage.getItem("uid") || "";

  const fetchRows = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) setLoading(true);
        setRefreshing(true);
        const res = await getDepositRecords(String(userId));
        setRows(Array.isArray(res?.items) ? res.items : []);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setRefreshing(false);
        if (showSpinner) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => { fetchRows(true); }, [fetchRows]);

  useEffect(() => {
    const onFocus = () => fetchRows(false);
    window.addEventListener("focus", onFocus);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchRows(false);
    }, 6000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [fetchRows]);

  return (
    <div className="page" style={{ background: "#f6f7fb", minHeight: "100%" }}>
      {/* === SAME TOPBAR + BACK BUTTON AS DEPOSIT PAGE === */}
      <header
        className="dep-topbar"
        style={{ position: "sticky", top: 0, zIndex: 10 }}
      >
        <button
          className="dep-back dep-back--tint"
          type="button"
          onClick={() => window.history.back()}
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="dep-back-ico" aria-hidden="true">
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff5f6d" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="url(#depGrad)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>

        <h1>Deposit records</h1>

        {/* right spacer + refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => fetchRows(true)}
            disabled={refreshing}
            title="Refresh"
            style={{
              border: "1px solid #e9ecf2",
              background: "#fff",
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.5 : 1,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              fontSize: 14,
            }}
          >
            ⟳
          </button>
        </div>
      </header>

      {/* body */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, opacity: 0.7 }}>
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, opacity: 0.7 }}>
          No more
        </div>
      ) : (
        <div style={{ padding: 12, display: "grid", gap: 14 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>Deposit</div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      r.status === "APPROVED"
                        ? "#2fbf71"
                        : r.status === "REJECTED"
                        ? "#e34b4b"
                        : "#b68400",
                  }}
                >
                  {r.status === "APPROVED"
                    ? "Success"
                    : r.status === "REJECTED"
                    ? "Failed"
                    : "Pending"}
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  wordBreak: "break-all",
                  opacity: 0.9,
                  marginBottom: 6,
                  lineHeight: 1.35,
                }}
              >
                {r.address}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                  fontSize: 12,
                  opacity: 0.85,
                }}
              >
                <span>
                  {new Date(r.createdAt || r.time || Date.now()).toLocaleString()}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {Number(r.amount || 0)} USDT
                </span>
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center", padding: 8, opacity: 0.6 }}>
            No more
          </div>
        </div>
      )}
    </div>
  );
}
