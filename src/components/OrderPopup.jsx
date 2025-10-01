import React from "react";
import { createPortal } from "react-dom";

export default function OrderPopup({ task, onClose, onSubmit, submitting }) {
  if (!task) return null;
  const fmt = (v, d = 0) =>
    Number.isFinite(+v) ? (+v).toFixed(d) : (0).toFixed(d);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "12px",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "95vw",        // ✅ always responsive
          maxWidth: "420px",    // ✅ desktop cap
          margin: "0 auto",     // ✅ center horizontally
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 22px 56px rgba(0,0,0,.28)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Successful order</div>
          <div
            style={{
              marginTop: 8,
              color: "#ff2f7d",
              fontWeight: 800,
              fontSize: 15,
              wordBreak: "break-word",
            }}
          >
            Order Nos: {task.orderNo || task.id}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 6,
              right: 10,
              border: "none",
              background: "transparent",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ height: 1, background: "#f1f1f4", marginTop: 10 }} />

        {/* Content */}
        <div style={{ padding: "16px 14px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #eee",
                background: "#fafafa",
                flexShrink: 0,
              }}
            >
              <img
                src={task.image}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  lineHeight: 1.25,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {task.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#f59e0b",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {fmt(task.unitPrice ?? task.price, 2)} USDT
              </div>
            </div>
            <div
              style={{
                alignSelf: "start",
                color: "#94a3b8",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              ×{task.quantity ?? task.qty ?? 1}
            </div>
          </div>

          {/* Details */}
          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 10,
              columnGap: 10,
              alignItems: "center",
              wordBreak: "break-word",
            }}
          >
            <div>Transaction time</div>
            <div style={{ textAlign: "right" }}>
              {new Date().toISOString().replace("T", " ").slice(0, 19)}
            </div>
            <div>Order amount</div>
            <div style={{ textAlign: "right" }}>
              {fmt(task.orderAmount ?? task.amount, 2)} USDT
            </div>
            <div>Commissions</div>
            <div style={{ textAlign: "right" }}>
              {fmt(task.commission, 5)} USDT
            </div>
          </div>

          {/* Expected Income */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px dashed #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700 }}>Expected income</div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 900,
                color: "#f59e0b",
                textAlign: "right",
              }}
            >
              {fmt(task.expectedIncome, 4)} USDT
            </div>
          </div>

          {/* Submit Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              style={{
                width: "100%",
                maxWidth: 280,
                height: 44,
                borderRadius: 12,
                border: "none",
                background: "#6b4b55",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? "Submitting..." : "Submit order"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
