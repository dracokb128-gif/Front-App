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
  teams:
    "data:image/png;base64,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",
  record:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABPBJREFUeNrsm11sFFUUx2eXtaBpDCINxNjQAmIKlMSakGii6UOD+BEoFF9cYdtUEFo+HiQ+NMYmJiVKQjQ8mFD7ZJtWSbrqg0UJRdsCL00bguHDECjIZyxhMWJNZNvr/0zvdO+O2525u2d3p7KTZs7/nrnnzv64H3PvncEnhDAepsNvPGRHHvj/fgScMuwa7QsZwliPnl466RETZq8X5p8prFHAGg+m/CJ2XdXWtXgtpsqA8lFlQEegf4b3c7hHbXnMmMMl63iAd432P44ij6DMF2PDmrxlZmFtWlRC7kaqGokBFdYQrE1a/OQBWCvPPCT64C9VYUUKxP5pmnEtyqrwCKzl90G1qrCCbdASxnaPwVrNuAqnIjF1D6YaRjHFHoS1anZZqrDJ+nDUo7BkCmL3F1zAWXn0pAJL/qh1F8E1SnsY1oiHFWyD1oyAZRulZwqs4Jt4zAzYVOo4MH0NO8L+gPOv0HMYYGmQHEd6LVxLMwWbdC7tANvZ9lRVkDz1N49y1+wtmIVuYPkmHs7NWMTy5qYZq+Xz1HDyPhtEzT6K9EXo2fD50oSl5kzNeg38C93CMvdhxwFqYy5rlnl56M3ROFEsUx/2NKyff3no7ZoNZGJ56FXYCOww+/LQw322ASaSieWhF2HPwHxli31+zYWuZ1gfS0lAhiGvQ89mgCX3A6jVcCyYJrZeiX0BshVqJXmqznd2wHx4rOytESdgX6K+gEnFCNwlSUDC7cWv1lA6+FsPZ80+hjxXoIpssd3wb5IRc5H/DtSs+DKNf6D3Q+47vjz4t3YfdmjGd+zPbKZmPGb+8P/G7lRiWxPAki6A+QA5LlSe7Qhq1XDdjaNoGqLEoc+2maslYcxBypcm7LhcMb2G9Eu22BYJQvkr4BlKAJuo/Jq+FZvDLufSrgaodzI5g5Kxf1DfVGI7XMKSboIJazTp3E0Xldgd5qJiMrYepswlLJ0LNCYenoA9j1SXjEW3MT7TgCXdpfVuKcewlAopsQfhL9SAvQ77idYGQI5hv4MclDmehX+rBizZbQMrQxOau5Y5g6X8DbFY8aUmbD9gj2i/Ls0h7D6om9JPk5vVGrCU3qI/tXQHS4PK71ABTdgoTk8KOS20xd6Dalb8X2jCHjxRHrqa5lw6Iez3h0vXvUH+msvfplqz7fC/bYtthIlKwBacn9CA/Qv6vbS2eJL84Kv2x1gKzfiiLfY0TKcEfBrnJg1Y0jtOloeiqa2WnH/wu6jZMbhvI/WIJuwD+IvoQwMbiLIaMto0YX8BbHsay0PH2pkFs5dhgLJyhOEflrBV0K9owJKuS/ujliyMxkqs2KM8eto0YbtOltcOpf3mIYuw3eZGwqTeC7NIA5bm2Y08m3jZgaXEfqmpX38s9PbE3z+1qjbCAJw12Ls4D0n9uqCFvXvYG7AHuL4A8GcB1pzkQ4/LK8t1XgAYtLjg+wLAvoWSEVjSfiVPoQZsL0wv3760YdzLAixJ2qwLyDzXXMJSuo77/fDXWYClKwsgi2Wecy5haSS/xv1h2qcoeizDsFae52T5Z1zANkMciH9hzwDcvbj6PsqsRJGRDMOSf63UIzCnpoE9B7MR4iP71wlsXwB8s2TDYPWlMI2ce3DbGuWNgGCE9UPPV/4530T6EPTL0H9C/wjbjXRPwk8xUqhhX/5/teSB88B54Dywh49/BRgAIYj5RU3D0igAAAAASUVORK5CYII=",
  wallet:
    "data:image/png;base64,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",
  invite:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABTdJREFUeNrsm3uIVFUcx+/MXM1cTE0x/aM/DE2xd6JR2MOWYkWsXd3FtixxK41gjR6Cgj1MSyIEEbKkgkKW1LQSfGyzWCLqQrlqYtAuPaA/JCpsDSK09t4+v5kz7XG4cx+z987MXue6zvf3O/fec+bj79zfedw1Ydu2cSkdSeMSO6rAVeCYHWaxNy750m4k3TVhTifvjUET+FYuB9r8UT9Gf5lm2x5+f1lC1dOL30W9n6JtuXv2PZgK9L0TQbP0koP2CFr/iLvmGoVgwoO9qB6pV11zCG3GPLM/IHAyIGwNbR4vM6zoXZjH0SujfYazkZ1UZthc+VXo7qDAvrs0z+wMrvyqQmD1e+vSDanPQ48wdc+vQFjRxqi69LQKhJW/10YyLFFxjU/YI9ibMc+iiSJg5WcUHy2493nASllNVOOw5QP2AvbdmH0hRHYb+gfmKBdYUSuSLp1pw183rgmxGyc8YHPVRdKl/cAORQ9jvoP+OgDYsZgt6EgPWCPo6tYMNgz7SlA3oG9FlKAce05EXbrs2di1/vCHpQqFjTDClQkb2TMcAFaGps9wf9OzrOIbwscszGnlgC0iaXnCyvhbi3vYI7JHcW8PAzbo8jZIlzZ9dON/fMDK0RUWrB0waEG69Ggfz+wwZBP2BvScoU0tBRWV9maij4QEa6jdlki69HIq30Qjt3gkqFa0Feev/mc4O0HmdAodFiJsT6atKLd4mtqtFcg6bhtajmyswa5FX+lsNq1QgJs7rJGcmorZu+3+ZLd+rnG/NZG73uT8gjLAppHn0dPidD6c7aQz2/69Tc3jT329yPw9EDCwr1G8DHOMalT2jzZ+XJfcql83f5/VwLkNnJtYAlgZ5lbgf5jX1hPoM5jXq3v+RLfjt3Y9ap73BAb2C4pmF0hQ7Zgv7JqT/DZ3ff1eS7r2Gi5cGSHsFsxVarmYg71JJcfaAt/1G8zpJx4z+woOS8Aud4EVvw49TWRXa8PVBT5WoTdz7kDIsCeAvQfzqTzYNfgnXWBz/yCvukb4obTVg0z2OV08JdHG6ciL7JO4r6slXrGwMp6/zHdbn5cf5qjccZ1t+Jra/nJysTnBbeIxIcDc+EY+0uiW7Lr1/8i+i06xs1oMrExLp+bBjubjPXnREABWdITrTEu2S4pYCCwFtQddrN1zNltuzEaP+YT9GV2I2wDsj1p5i5Edbx/XV0c+YMW33IH1d0PBVj3jcD9AP6HoGu3eg8gM9EXppi6wb6shcIc2zk7ObLTbxvvo2CJgM/twXhEe6BKP6Bjd6Mq8brwOmYLuyKv/CHoH+jTu3xrsarQb54H8dW8AWMfVVNJpGTjAGZQsMtbjHkPv1M79hCxEm+xM9jVeQmehndqk4l6VfddePA8vDtb2Wi2FvHiX16iH1GJiuHbtTvRWgdLG2StU8jsgw4nhsKNRFKxXhCOaG8vk/jsVWadJxSLpvirJGWHC2g7ESbddjRCni1fbmYREdA1jvConudl7Mbfijy8FrOPyMOKFwAJ5rnHbgF2GP9y5rXBgnZKWWULYXPk4YJ8t3FZ4sL6TVonWsyWHdUxacYL1HodjDltwWIoLrM9nOEaw3hOPeMH6iXAqZrBJr8XD+ThFVu2cuEa4J0awcpzxytI7YwQr/h6vCG9W2zNxgJU96TdcgdvrU/IMz4sBrBzzvl86pNdzxyPdkDoqv2slOxSDFFZ+e6ge2I5A75Zqd/VdxqnnMOeik7jqclsN0xUGK28opfv+gN+ObgT2XGhvDwf7Uf1PHlXgKvDgPv4TYADaYjhCGf7jWQAAAABJRU5ErkJggg=="
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
