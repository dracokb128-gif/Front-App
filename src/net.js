// src/net.js
let patched = false;

export function installFetchInterceptor() {
  if (patched) return;
  patched = true;

  const orig = window.fetch.bind(window);
  const MIN = 800;
  const DELAY = 120;

  window.fetch = async (...args) => {
    try {
      window.__loader?.show({ delay: DELAY, min: MIN });
      return await orig(...args);
    } finally {
      window.__loader?.hide();
    }
  };
}
