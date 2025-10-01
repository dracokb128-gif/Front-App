// src/bootLoader.js
(function () {
  if (window.__bootLoaderMounted) return;
  window.__bootLoaderMounted = true;

  // ---------- CSS ----------
  const css = `
  #__boot_loader_overlay{
    position:fixed; inset:0; z-index:2147483647;
    background:rgba(15,23,42,.35); backdrop-filter:blur(1px);
    display:none; place-items:center;
  }
  #__boot_loader_overlay .loader{
    width:50px; aspect-ratio:1; display:grid;
    -webkit-mask:conic-gradient(from 15deg,#0000,#000);
    animation:l26 1s infinite steps(12);
  }
  #__boot_loader_overlay .loader,
  #__boot_loader_overlay .loader:before,
  #__boot_loader_overlay .loader:after{
    background:
      radial-gradient(closest-side at 50% 12.5%, #f03355 96%,#0000) 50% 0/20% 80% repeat-y,
      radial-gradient(closest-side at 12.5% 50%, #f03355 96%,#0000) 0 50%/80% 20% repeat-x;
  }
  #__boot_loader_overlay .loader:before,
  #__boot_loader_overlay .loader:after{ content:""; grid-area:1/1; transform:rotate(30deg); }
  #__boot_loader_overlay .loader:after{ transform:rotate(60deg); }
  @keyframes l26{100%{transform:rotate(1turn)}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- DOM ----------
  const overlay = document.createElement("div");
  overlay.id = "__boot_loader_overlay";
  overlay.innerHTML = `<div class="loader"></div>`;
  document.body.appendChild(overlay);

  // ---------- API ----------
  const state = { active: 0, minUntil: 0, hideT: null, delayT: null, visible: false };

  function clearTimers() {
    if (state.hideT) { clearTimeout(state.hideT); state.hideT = null; }
    if (state.delayT) { clearTimeout(state.delayT); state.delayT = null; }
  }

  function show(opts) {
    const delay = (opts && Number.isFinite(opts.delay)) ? opts.delay : 120;
    const min   = (opts && Number.isFinite(opts.min))   ? opts.min   : 600;
    state.active++;
    if (state.visible) { state.minUntil = Math.max(state.minUntil, Date.now() + min); return; }
    clearTimers();
    state.delayT = setTimeout(() => {
      overlay.style.display = "grid";
      state.visible = true;
      state.minUntil = Date.now() + min;
    }, Math.max(0, delay));
  }

  function hide() {
    if (state.active > 0) state.active--;
    if (state.active > 0) return;
    const left = Math.max(0, state.minUntil - Date.now());
    clearTimers();
    state.hideT = setTimeout(() => {
      overlay.style.display = "none";
      state.visible = false;
    }, left || 120);
  }

  function bump(min) { show({ delay: 0, min: min || 600 }); hide(); }
  function forceHide() { state.active = 0; state.minUntil = 0; clearTimers(); overlay.style.display = "none"; state.visible = false; }

  // global
  window.__loader = { show, hide, bump, forceHide };
  console.log("[BootLoader JS] ready");

  // ---------- Click pulse (throttle) ----------
  let last = 0, THROTTLE = 350;
  document.addEventListener("click", (e) => {
    if (e.target.closest(".no-bump")) return;
    const now = Date.now(); if (now - last < THROTTLE) return;
    last = now; bump(550);
  }, true);

  // ---------- Fetch patch (network-based) ----------
  if (!window.__fetchPatchedGlobal) {
    window.__fetchPatchedGlobal = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      try { show({ delay: 100, min: 700 }); } catch {}
      try { return await orig(...args); }
      finally { try { hide(); } catch {} }
    };
  }
})();
