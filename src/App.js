// src/App.js
import React, { useState, useEffect } from "react";
import {
  FiHome, FiHeadphones, FiMenu, FiActivity, FiUser,
  FiChevronRight, FiChevronLeft,
  FiSettings, FiDownload, FiUpload,
  FiKey, FiShield, FiGlobe, FiLogOut
} from "react-icons/fi";
import "./App.css";
import DepositRecords from "./DepositRecords";
import WalletBind from "./WalletBind";
import WalletFinal from "./WalletFinal";
import Wallet, { WalletPassword } from "./Wallet";
import ChangeWalletAddress from "./ChangeWalletAddress.jsx";
import TeamsComingSoon from "./TeamsComingSoon";
import InvitePage from "./InvitePage";
import ProfilePage from "./ProfilePage";

import Withdrawal from "./Withdrawal";
import MenuPage from "./MenuPage.js";
import HomePage from "./HomePage_tmp.jsx";
import LoginPage from "./LoginPage";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { isAuthed, logout } from "./auth";
import { getUsers, getAvatar /*, patchBalance*/ } from "./api"; // ✅ added getAvatar
import { useLoader } from "./Loader/LoaderProvider";
import { AnimatePresence, motion } from "framer-motion";
import RegistrationPage from "./RegistrationPage";
import AdminPage from "./AdminPage";
import RecordPage from "./RecordPage";
import AdminLogin from "./AdminLogin";
import SettingPage from "./SettingPage";
import ChangeLoginPassword from "./ChangeLoginPassword";
import DepositPage from "./DepositPage";
import DepositConfirm from "./DepositConfirm.jsx";
import ChangeWithdrawalPassword from "./ChangeWithdrawalPassword.jsx";
import AdminWithdrawals from "./admin/AdminWithdrawals";
import WithdrawalRecords from "./WithdrawalRecords";
import ServicePage from "./ServicePage";

/* ✅ keep as-is */
import { wdEnsureFreshOnLogin } from "./wdStore";
wdEnsureFreshOnLogin();

/* ====== DEFAULT AVATAR (view-only) ====== */
const DEFAULT_AVATAR_URL = "/photo_2025-09-12_21-00-08.jpg";

/* ===== small USDT coin -> PNG ===== */
const USDTIcon = () => (
  <img
    className="usdt-ico"
    src="https://cdn-icons-png.flaticon.com/512/15301/15301795.png"
    alt="USDT"
    width={16}
    height={16}
    loading="lazy"
    decoding="async"
  />
);

/* ===== base64 tile icons (as-is) ===== */
const ICON_URLS = {
  teams: "data:image/png;base64,iVBORw0K...", // shortened for brevity
  record: "data:image/png;base64,iVBORw0K...",
  wallet: "data:image/png;base64,iVBORw0K...",
  invite: "data:image/png;base64,iVBORw0K..."
};

/* ===== Row (clickable) ===== */
const Row = ({ icon: Icon, label, onClick }) => (
  <button className="row" onClick={onClick}>
    <div className="row-left">
      <Icon className="row-icon" />
      <span className="row-label">{label}</span>
    </div>
    <FiChevronRight className="row-arrow" />
  </button>
);

/* ===== Avatar helpers (PER-USER key) ===== */
function avatarKey() {
  const uid = localStorage.getItem("uid") || "guest";
  return `avatar_src:${uid}`;
}
function getAvatarLocal() {
  try {
    const v = localStorage.getItem(avatarKey());
    return v || DEFAULT_AVATAR_URL;
  } catch {
    return DEFAULT_AVATAR_URL;
  }
}

/* ===== Round Avatar (reads per-user, reacts to changes) ===== */
function AvatarRound() {
  const [src, setSrc] = useState(getAvatarLocal());
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => { setSrc(getAvatarLocal()); setBroken(false); };
    const onStorage = (e) => {
      if (!e || !e.key) return;
      if (e.key === avatarKey() || e.key.startsWith("avatar_src:")) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("avatar:changed", sync);
    window.addEventListener("uid:changed", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("avatar:changed", sync);
      window.removeEventListener("uid:changed", sync);
    };
  }, []);

  return (
    <>
      <button type="button" className="avatar" onClick={() => !broken && setOpen(true)}>
        {!broken && (
          <img
            src={src}
            alt="Profile"
            onError={() => setBroken(true)}
            crossOrigin="anonymous"
          />
        )}
      </button>
      {open && (
        <div className="pic-viewer" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <img className="pic-viewer-img" src={src} alt="Profile" />
        </div>
      )}
    </>
  );
}

/* ===== Mine tab content ===== */
function MinePage() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);

  // ✅ Auto-refresh avatar from server
  useEffect(() => {
    const uid = localStorage.getItem("uid");
    if (!uid) return;

    (async () => {
      try {
        const res = await getAvatar(uid);
        const url = res?.url && (res.url + (res.url.includes("?") ? "&" : "?") + "v=" + Date.now());
        if (url) {
          localStorage.setItem(`avatar_src:${uid}`, url);
          window.dispatchEvent(new Event("avatar:changed"));
        }
      } catch (err) {
        console.warn("Avatar refresh failed:", err);
      }
    })();

    const handler = () => {
      const k = `avatar_src:${uid}`;
      const val = localStorage.getItem(k);
      if (val) window.dispatchEvent(new Event("avatar:changed"));
    };
    window.addEventListener("avatar:changed", handler);
    return () => window.removeEventListener("avatar:changed", handler);
  }, []);

  useEffect(() => { refreshUser(); }, []);

  async function refreshUser() {
    try {
      const users = await getUsers();
      const uid = localStorage.getItem("uid") || null;
      let found = null;
      if (uid) found = users.find((u) => String(u.id) === String(uid)) || null;
      if (!found) {
        found = users[0] || null;
        if (found) {
          localStorage.setItem("uid", String(found.id));
          window.dispatchEvent(new Event("uid:changed"));
        }
      }
      setMe(found);
    } catch (e) {
      console.error(e);
      alert("User load nahi ho raha");
    }
  }

  function handleDeposit() { nav("/deposit"); }
  function getVipFromBalance(bal) {
    if (bal >= 901) return 3;
    if (bal >= 499) return 2;
    if (bal >= 20) return 1;
    return 0;
  }
  function handleWithdraw() { nav("/withdrawal"); }

  const username = me?.username ?? "—";
  const invite = me?.inviteCode ?? "—";
  const balance = me?.balance ?? 0;

  return (
    <>
      <section className="hero-full">
        <div className="wrap mine-page">
          <div className="hero-top">
            <AvatarRound />
            <div className="id">
              <div className="uname">{username}</div>
              <div className="invite">Invitation code: {invite}</div>
            </div>
            <div className="vip">VIP {getVipFromBalance(balance)}</div>
          </div>

          <div className="hero-middle">
            <div className="chip balance">
              <USDTIcon />
              <span>{String(balance)}</span>
            </div>

            <div className="hero-ctas">
              <button className="btn btn--deposit" onClick={handleDeposit} disabled={busy || !me}>
                <FiDownload /><span>{busy ? "..." : "Deposit"}</span>
              </button>
              <button className="btn btn--withdraw" onClick={handleWithdraw} disabled={busy || !me}>
                <FiUpload /><span>{busy ? "..." : "Withdrawal"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* tiles */}
      <section className="wrap tiles-pro">
        <button className="tile-pro" onClick={() => nav("/teams")}>
          <img className="tile-img" src={ICON_URLS.teams} alt="Teams" />
          <span>Teams</span>
        </button>
        <button className="tile-pro" onClick={() => nav("/inside/record")}>
          <img className="tile-img" src={ICON_URLS.record} alt="Record" />
          <span>Record</span>
        </button>
        <button className="tile-pro" onClick={() => nav("/wallet")}>
          <img className="tile-img" src={ICON_URLS.wallet} alt="Wallet" />
          <span>Wallet</span>
        </button>
        <button className="tile-pro" onClick={() => nav("/invite")}>
          <img className="tile-img" src={ICON_URLS.invite} alt="Invite" />
          <span>Invite</span>
        </button>
      </section>

      <section className="wrap list-card grouped list-xl">
        <Row icon={FiUser} label="Profile" onClick={() => nav("/profile")} />
        <Row icon={FiDownload} label="Deposit records" onClick={() => nav("/deposit-records")} />
        <Row icon={FiUpload} label="Withdrawal records" onClick={() => nav("/withdrawal-records")} />
        <Row icon={FiSettings} label="Setting" onClick={() => nav("/settings")} />
      </section>

      <div className="bottom-space" />
    </>
  );
}

/* ===== Rest of your file (unchanged) ===== 
/* ===== Main UI (tabs) — with slide animations and URL-sync ===== */
function HomeRoot() {
  const { tab: tabParam } = useParams();
  const nav = useNavigate();

  const ORDER = ["home", "service", "menu", "record", "mine"];
  const initTab = ORDER.includes(tabParam || "") ? tabParam : "mine";
  const [tab, setTab] = useState(initTab);
  const [prevTab, setPrevTab] = useState(tab);

  const direction = ORDER.indexOf(tab) > ORDER.indexOf(prevTab) ? 1 : -1;
  useEffect(() => { setPrevTab(tab); }, [tab]);

  // keep state in sync if URL changes (e.g., /inside/record)
  useEffect(() => {
    if (tabParam && ORDER.includes(tabParam) && tabParam !== tab) {
      setTab(tabParam);
    }
  }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // push URL when tab changes (so back button works and bottom bar stays)
  useEffect(() => {
    if (tab !== tabParam) {
      nav(`/inside/${tab}`, { replace: true });
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const variants = {
    enter: (dir)  => ({ x: dir * 60, opacity: 0 }),
    center:       { x: 0,        opacity: 1 },
    exit:  (dir)  => ({ x: dir * -60, opacity: 0 })
  };

  const render = () => {
    switch (tab) {
      case "home":    return <HomePage />;
      case "menu":    return <MenuPage />;
      case "service": return <ServicePage />;
      case "record":  return <RecordPage />;
      case "mine":
      default:        return <MinePage />;
    }
  };

  return (
    <div className="page">
      <main className="content tab-stage">
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={tab}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            style={{ position: "absolute", inset: 0 }}
          >
            {render()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom">
        <button className={`tab ${tab==="home" ? "active":""}`}    onClick={()=>setTab("home")}><FiHome /><span>Home</span></button>
        <button className={`tab ${tab==="service" ? "active":""}`} onClick={()=>setTab("service")}><FiHeadphones /><span>Service</span></button>
        <button className={`tab ${tab==="menu" ? "active":""}`}    onClick={()=>setTab("menu")}><FiMenu /><span>Menu</span></button>
        <button className={`tab ${tab==="record" ? "active":""}`}  onClick={()=>setTab("record")}><FiActivity /><span>Record</span></button>
        <button className={`tab ${tab==="mine" ? "active":""}`}    onClick={()=>setTab("mine")}><FiUser /><span>Mine</span></button>
      </nav>
    </div>
  );
}

/* ===== Setting Screen ===== */
function Setting() {
  const nav = useNavigate();

  const rows = [
    { icon: FiKey,    label: "Change Login Password",       onClick: () => nav("/settings/change-login") },
    { icon: FiShield, label: "Change Withdrawal Password",  onClick: () => nav("/settings/change-withdrawal") },
    { icon: FiSettings, label: "Change Wallet Address",     onClick: () => nav("/settings/change-wallet") },
    { icon: FiGlobe,  label: "Language",                    onClick: () => alert("Language — TBD") },
  ];

  return (
    <div className="settings-page">
      <div className="subhead">
        <button className="back" onClick={() => nav(-1)} aria-label="Back">
          <FiChevronLeft />
        </button>
        <div className="title">Setting</div>
        <div className="right-space" />
      </div>

      <div className="settings-card">
        {rows.map((r, i) => (
          <button key={i} type="button" className="settings-row" onClick={r.onClick}>
            <div className="settings-left">
              <r.icon className="settings-ico" />
              <span>{r.label}</span>
            </div>
            <FiChevronRight className="settings-chev" />
          </button>
        ))}
      </div>

      <button
        type="button"
        className="settings-logout"
        onClick={() => { logout(); nav("/login", { replace: true }); }}
      >
        <FiLogOut className="sl-ico" />
        <span>Logout</span>
      </button>
    </div>
  );
}

/* ===== Centered loader on app mount ===== */
function DebugMini() {
  const { show, hide } = useLoader();
  useEffect(() => {
    show("Preparing your dashboard…");
    const t = setTimeout(hide, 800);
    return () => clearTimeout(t);
  }, [show, hide]);
  return null;
}

/* ------- Guard ------- */
function RequireAuth({ children }) {
  return isAuthed() ? children : <Navigate to="/login" replace />;
}

/* ------- Admin wrapper (nested routing for /admin/*) ------- */
function AdminApp() {
  return (
    <Routes>
      <Route path="/" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

/* ------- App Routes (no BrowserRouter here) ------- */
function App() {
  const defaultEl = isAuthed()
    ? <Navigate to="/inside" replace />
    : <Navigate to="/login" replace />;

  return (
    <>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={defaultEl} />

        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        {/* Record direct links → always open inside layout so bottom bar shows */}
        <Route path="/record" element={<Navigate to="/inside/record" replace />} />
        <Route path="/records" element={<Navigate to="/inside/record" replace />} />
        <Route path="/progress" element={<Navigate to="/inside/record" replace />} />

        <Route path="/settings/change-withdrawal" element={<ChangeWithdrawalPassword />} />

        {/* Protected app: main tabs */}
        <Route
          path="/inside"
          element={
            <RequireAuth>
              <HomeRoot />
            </RequireAuth>
          }
        />
        {/* Allow /inside/:tab (home|service|menu|record|mine) */}
        <Route
          path="/inside/:tab"
          element={
            <RequireAuth>
              <HomeRoot />
            </RequireAuth>
          }
        />

        {/* Protected settings */}
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Setting />
            </RequireAuth>
          }
        />

        {/* Admin */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Old aliases */}
        <Route path="/setting" element={<SettingPage />} />
        <Route path="/setting/change-login" element={<ChangeLoginPassword />} />
        <Route path="/settings/change-login" element={<ChangeLoginPassword />} />
        <Route path="/settings/change-wallet" element={<ChangeWalletAddress />} />

        {/* ✅ Deposit flow */}
        <Route path="/deposit" element={<DepositPage />} />
        <Route path="/deposit/confirm" element={<DepositConfirm />} />
        <Route path="/deposit-records" element={<DepositRecords />} />
        <Route path="/withdrawal-records" element={<WithdrawalRecords />} />

        <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />

        {/* ✅ Wallet flow */}
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/wallet/bind" element={<WalletBind />} />
        <Route path="/wallet/final" element={<WalletFinal />} />
        <Route path="/wallet/password" element={<WalletPassword />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/teams" element={<TeamsComingSoon />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/withdrawal" element={<Withdrawal />} />

        {/* Fallback last */}
        <Route path="*" element={defaultEl} />
      </Routes>
    </>
  );
}

export default App;
