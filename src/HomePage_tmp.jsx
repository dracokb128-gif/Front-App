// src/HomePage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ added
import { FiDownload, FiUpload, FiUsers, FiUserPlus, FiBell, FiX } from "react-icons/fi";

/* Quick action button */
const QA = ({ icon: Icon, label, onClick, className = "" }) => (
  <button className={`home-qa ${className}`} onClick={onClick} type="button">
    <Icon className="qa-ico" />
    <span>{label}</span>
  </button>
);

export default function HomePage() {
  const navigate = useNavigate(); // ✅ added

  const [showProfile, setShowProfile] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCoop, setShowCoop] = useState(false);

  // ✅ same routes jese Mine page me chal rahe hain
  const goDeposit = () => navigate("/deposit");
  const goWithdraw = () => navigate("/withdrawal");
  const goTeams = () => navigate("/teams");
  const goInvite = () => navigate("/invite");

  /* Locked images (same ones you liked) */
  const IMG = {
    profile:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85&v=1",
    rules:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=85&v=1",
    coop:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=85&v=1",
    guide:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=85&v=1",
  };

  const cards = [
    {
      id: 1,
      img: IMG.profile,
      title: "Platform profile",
      text:
        "MALL is an intelligent cloud order matching center that helps users earn stable commissions.",
      onClick: () => setShowProfile(true),
    },
    {
      id: 2,
      img: IMG.rules,
      title: "Platform rules",
      text:
        "About recharge and withdrawals: transparent rules, quick settlement and real-time auditing.",
      onClick: () => setShowRules(true),
    },
    {
      id: 3,
      img: IMG.coop,
      title: "Win win cooperation",
      text:
        "We value long term collaboration and offer tiered VIP levels with better rates.",
      onClick: () => setShowCoop(true),
    },
    {
      id: 4,
      img: IMG.guide,
      title: "Instructions for use",
      text:
        "New here? Read this quick guide to start, recharge safely and withdraw with confidence.",
    },
  ];

  const LOGO_URL = `${process.env.PUBLIC_URL}/photo_2025-09-12_21-00-08.jpg`;

  return (
    <div className="wrap home-page">
      {/* TOP BAR */}
      <header className="home-top">
        <div className="logo-dot">
          <img src={LOGO_URL} alt="" />
        </div>
        <span className="home-title">Home</span>
        <button className="bell" aria-label="Notifications" type="button">
          <FiBell />
        </button>
      </header>

      {/* QUICK ACTIONS */}
      <nav className="home-qa-grid">
        <QA icon={FiDownload} label="Recharge"   onClick={goDeposit} />   {/* ✅ */}
        <QA icon={FiUpload}   label="Withdrawal" onClick={goWithdraw} />  {/* ✅ */}
        <QA icon={FiUsers}    label="Teams"      onClick={goTeams} />     {/* ✅ */}
        <QA icon={FiUserPlus} label="Invitation" onClick={goInvite} />    {/* ✅ */}
      </nav>

      {/* SECTION */}
      <h3 className="home-sec">Platform introduction</h3>

      {/* IMAGE GRID CARDS */}
      <div className="home-cards-wrap">
        <div className="home-cards">
          {cards.map((it) => (
            <article
              key={it.id}
              className="home-card"
              role="button"
              tabIndex={0}
              onClick={it.onClick}
            >
              <div
                className="hc-photo"
                style={{ backgroundImage: `url(${it.img})` }}
                aria-label={it.title}
              />
              <div className="hc-body">
                <h4 className="hc-title">{it.title}</h4>
                <p className="hc-text">{it.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ===== PROFILE OVERLAY ===== */}
      {showProfile && (
        <div className="sheet-overlay" onClick={() => setShowProfile(false)}>
          <div
            className="profile-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ps-head">
              <h2 className="ps-title">MALL Platform profile</h2>
              <button className="ps-close" type="button" onClick={() => setShowProfile(false)}>
                <FiX />
              </button>
            </header>

            <p className="ps-kicker">Intelligent cloud order matching for global e commerce.</p>

            <div className="ps-body">
              <p>
                <strong>MALL</strong> is an intelligent cloud based order matching center that
                supports leading platforms like{" "}
                <em style={{ fontWeight: 800, fontStyle: "normal" }}>
                  Amazon, Alibaba, AliExpress, Souq, Jumia, MaxFashion
                </em>{" "}
                and{" "}
                <em style={{ fontWeight: 800, fontStyle: "normal" }}>
                  Daraz
                </em>.
              </p>
              <p>
                With online traffic optimization, dynamic product data reconstruction and
                scenario based enablement, MALL improves merchant competitiveness and
                streamlines buyer and seller interactions. Our AI cloud algorithm connects
                buyers with verified merchants and automates order matching.
              </p>
              <p>
                Consumers can earn commissions by sharing products during normal shopping,
                while merchants benefit from a network of promoters that drives order fulfillment.
              </p>
              <p>
                Powered by modern 5G cloud matching, MALL delivers innovation, efficiency
                and mutual growth for merchants and consumers.
              </p>
            </div>

            <footer className="ps-foot">
              <span className="ps-note">Tap outside to close</span>
            </footer>
          </div>
        </div>
      )}

      {/* ===== RULES OVERLAY ===== */}
      {showRules && (
        <div className="sheet-overlay" onClick={() => setShowRules(false)}>
          <div
            className="profile-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ps-head">
              <h2 className="ps-title">Platform rules and guidelines</h2>
              <button className="ps-close" type="button" onClick={() => setShowRules(false)}>
                <FiX />
              </button>
            </header>

            <div className="ps-body">
              <h4>Recharge instructions</h4>
              <ul>
                <li>Recharge methods may change over time. Always verify in the Recharge screen.</li>
                <li>If a recharge is delayed, contact recharge support right away.</li>
              </ul>

              <h4>Withdrawal policy</h4>
              <ul>
                <li><strong>Minimum withdrawal:</strong> 20&nbsp;USDT. <strong>Minimum deposit:</strong> 10&nbsp;USDT.</li>
                <li>Requests are processed immediately and usually credit within 24 hours.</li>
                <li>High traffic can add delay. Allow sufficient time.</li>
                <li>If funds are not received in 24 hours, contact customer service.</li>
              </ul>

              <h4>Order freezing</h4>
              <ul>
                <li>Orders freeze if delivery is not completed within 10 minutes after placement or
                    if you return to the page after receiving an order.</li>
                <li>Fix: open <em>Home → Order</em> and send the order again.</li>
              </ul>

              <h4>Account registration and security</h4>
              <ul>
                <li>One username can register only one account with a valid mobile number.</li>
                <li>Multiple accounts or repeated IPs may be flagged for illegal activity,
                    which can freeze the account and block withdrawals.</li>
              </ul>

              <h4>VIP levels and trading rules</h4>
              <table className="vip-table">
                <thead>
                  <tr>
                    <th>VIP level</th>
                    <th>Platform</th>
                    <th>Available balance (USDT)</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>VIP 1</td>
                    <td>Amazon</td>
                    <td>20 – 498</td>
                    <td>4%</td>
                    <td><span className="badge ok">Active</span></td>
                  </tr>
                  <tr>
                    <td>VIP 2</td>
                    <td>Alibaba</td>
                    <td>499 – 899</td>
                    <td>8%</td>
                    <td><span className="badge ok">Active</span></td>
                  </tr>
                  <tr>
                    <td>VIP 3</td>
                    <td>AliExpress</td>
                    <td>899+</td>
                    <td>12%</td>
                    <td><span className="badge ok">Active</span></td>
                  </tr>
                  <tr>
                    <td>VIP 4</td>
                    <td>eBay</td>
                    <td>20 – 498</td>
                    <td>18%</td>
                    <td><span className="badge lock">Locked</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <footer className="ps-foot">
              <span className="ps-note">Tap outside to close</span>
            </footer>
          </div>
        </div>
      )}

      {/* ===== COOP OVERLAY ===== */}
      {showCoop && (
        <div className="sheet-overlay" onClick={() => setShowCoop(false)}>
          <div
            className="profile-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ps-head">
              <h2 className="ps-title">Win win cooperation</h2>
              <button className="ps-close" type="button" onClick={() => setShowCoop(false)}>
                <FiX />
              </button>
            </header>

            <div className="ps-body">
              <p>
                We believe in long term partnerships that create value for both consumers and
                merchants. The program combines smart matching, clear rewards and strong
                compliance so that everyone grows together.
              </p>

            <h4>How it works</h4>
              <ol>
                <li>Discover tasks that match your level and balance.</li>
                <li>Share or complete items as instructed. Our cloud system verifies results.</li>
                <li>Earn commission instantly. Progress unlocks higher VIP tiers and better rates.</li>
              </ol>

              <h4>Roles in the network</h4>
              <ul>
                <li><strong>Consumers and promoters:</strong> share quality products and earn commission on valid activity.</li>
                <li><strong>Merchants:</strong> reach ready buyers through verified traffic and accurate matching.</li>
                <li><strong>Platform:</strong> provides secure tools, risk checks and fast settlement.</li>
              </ul>

              <h4>Why partners choose MALL</h4>
              <ul>
                <li>Transparent commissions with tier based growth.</li>
                <li>Reliable operations with real time audit and anti fraud checks.</li>
                <li>Simple onboarding and clear support at each step.</li>
              </ul>

              <h4>Get started</h4>
              <ul>
                <li>Open the Menu tab and verify your account details.</li>
                <li>Start with your current VIP level and complete a few orders to learn the flow.</li>
                <li>Invite your team when you are ready. Better performance helps everyone.</li>
              </ul>
            </div>

            <footer className="ps-foot">
              <span className="ps-note">Tap outside to close</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
