// src/ServicePage.jsx
import React, { useEffect, useState } from "react";
import { FiChevronRight, FiHeadphones, FiHelpCircle, FiX } from "react-icons/fi";

const API_BASE =
  (typeof window !== "undefined" && (window.API_BASE || window.__API_BASE__)) ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:4000";

const PUB = (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) || "";
const HERO = `${PUB}/service/hero.jpg`;

export default function ServicePage() {
  const [csUrl, setCsUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cs-link`, { credentials: "include" });
        let data = {};
        try { data = await res.json(); } catch { data = {}; }
        if (res.ok && data && typeof data.url === "string") setCsUrl(data.url || "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openExternal = (url) => {
    const safe = (url || "").trim();
    if (!safe) return;
    try {
      window.open(safe, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = safe;
    }
  };

  const handleOnlineSupport = () => {
    const v = (csUrl || "").trim();
    if (!v) {
      alert("No customer service link set by Admin yet.");
      return;
    }
    openExternal(v);
  };

  return (
    <div style={{ background: "#f1f3f6", minHeight: "100%" }}>
      {/* HERO */}
      <div style={{ padding: "12px 12px 0" }}>
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            width: "98%",
            maxWidth: 540,
            height: "clamp(390px, 68vw, 560px)",
            margin: "0 auto",
            backgroundImage: `url(${HERO})`,
            backgroundSize: "cover",
            backgroundPosition: "center 52%",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.18) 30%, rgba(0,0,0,0) 60%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              textAlign: "center",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 0.2,
                textShadow: "0 2px 6px rgba(0,0,0,.45)",
              }}
            >
              Customer Service Center
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                fontWeight: 600,
                opacity: 0.95,
                textShadow: "0 1px 3px rgba(0,0,0,.4)",
              }}
            >
              Online customer service time 07:00-23:00 &nbsp; (UK)
            </div>
          </div>
        </div>
      </div>

      {/* LIST */}
      <section className="wrap" style={{ padding: 12, maxWidth: 540, margin: "12px auto 0" }}>
        <button type="button" onClick={handleOnlineSupport} style={rowStyle} disabled={loading}>
          <div style={rowLeftStyle}>
            <FiHeadphones style={rowIconStyle} />
            <span>{loading ? "Loading..." : "Online customer service"}</span>
          </div>
            <FiChevronRight style={{ opacity: 0.5 }} />
        </button>

        <button
          type="button"
          onClick={() => setShowHelp(true)}
          style={{ ...rowStyle, marginTop: 12 }}
        >
          <div style={rowLeftStyle}>
            <FiHelpCircle style={rowIconStyle} />
            <span>Help</span>
          </div>
          <FiChevronRight style={{ opacity: 0.5 }} />
        </button>
      </section>

      {/* HELP MODAL */}
      {showHelp && (
        <div style={modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div style={modalCard}>
            <div style={modalHeader}>
              <div id="help-title" style={{ fontWeight: 800, fontSize: 18 }}>Help & FAQ</div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Close"
                style={closeBtn}
              >
                <FiX />
              </button>
            </div>

            <div style={modalBody}>
              <h3 style={h3}>Frequently Asked Questions (FAQ)</h3>

              <h4 style={h4}>1) About Recharge</h4>
              <ol style={ol}>
                <li>
                  Go to <strong>“My” → “My Wallet”</strong> and tap <strong>“Recharge”</strong>.
                  Enter the recipient’s name and the amount, then tap <strong>“Transfer”</strong>.
                </li>
                <li>
                  After transferring to the platform’s account, <strong>upload a screenshot</strong> of the successful transaction and tap <strong>“Submit”</strong>.
                </li>
                <li>
                  For faster processing, the system may match your recharge with a unique identifier.
                </li>
                <li>
                  Always <strong>double-check</strong> the displayed USDT wallet or bank account before payment.
                  Account details may be updated periodically—if anything looks different, contact customer service first.
                </li>
              </ol>

              <h4 style={h4}>2) About Withdrawal</h4>
              <ol style={ol}>
                <li>You must complete <strong>at least 25 orders</strong> before applying for withdrawal.</li>
                <li>Ensure your withdrawal information is <strong>bound correctly</strong> in account settings.</li>
                <li>
                  Withdraw via <strong>“My” → “My Wallet”</strong> during platform working hours. Tap <strong>“Withdraw”</strong>, enter the amount and your withdrawal password, and submit.
                </li>
                <li>
                  Once approved, funds are transferred to your <strong>USDT wallet or linked bank account within 24 hours</strong>.
                </li>
              </ol>

              <h4 style={h4}>3) About Grabbing & Freezing Orders</h4>
              <ol style={ol}>
                <li>When your balance reaches <strong>20 USDT</strong>, you can start grabbing orders.</li>
                <li>Each user may grab up to <strong>25 orders per day</strong>.</li>
                <li>
                  Go to <strong>“Order” → “Automatic Order”</strong> and wait for the system to assign an order.
                </li>
                <li>
                  Complete assigned tasks <strong>promptly</strong> to avoid delays or potential freezing of pending orders.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-space" />
    </div>
  );
}

/* ---- styles ---- */
const rowStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#fff",
  border: "1px solid #e9ecf2",
  borderRadius: 14,
  padding: "14px 14px",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  cursor: "pointer",
};
const rowLeftStyle = { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 };
const rowIconStyle = { fontSize: 18, opacity: 0.8 };

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 2000,
};

const modalCard = {
  width: "100%",
  maxWidth: 560,
  maxHeight: "82vh",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,.25)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const modalHeader = {
  padding: "12px 14px",
  borderBottom: "1px solid #eef1f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const closeBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #e7ebf2",
  background: "#fff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const modalBody = {
  padding: 14,
  overflow: "auto",
  WebkitOverflowScrolling: "touch",
  fontSize: 14.5,
  lineHeight: 1.55,
  color: "#202433",
};

const h3 = { fontSize: 18, fontWeight: 800, margin: "2px 0 10px" };
const h4 = { fontSize: 15.5, fontWeight: 800, margin: "12px 0 8px" };
const ol = { margin: "0 0 6px 18px" };
