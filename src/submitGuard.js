// src/submitGuard.js
(function () {
  const ORIG_FETCH = window.fetch;
  let lastClickTs = 0;

  // any real user click updates timestamp
  window.addEventListener(
    "click",
    () => {
      lastClickTs = Date.now();
    },
    { capture: true }
  );

  window.fetch = function patchedFetch(input, init = {}) {
    const url =
      typeof input === "string" ? input : (input && input.url) || "";
    const method =
      (init && init.method) ||
      (typeof input === "object" && input && input.method) ||
      "GET";

    try {
      // ✅ Guard only the real submit endpoint
      if (
        url.includes("/api/task/submit") &&
        String(method).toUpperCase() === "POST"
      ) {
        const headers = init.headers || {};
        const manualHeader =
          headers["X-Manual-Submit"] || headers["x-manual-submit"];

        // allow if header present OR the call is within 1.5s of a real click
        const fromUi = Date.now() - lastClickTs < 1500;
        if (!manualHeader && !fromUi) {
          return Promise.reject(
            new Error("Blocked: Submit must be from the button.")
          );
        }
      }

      // All other routes (next/reset/progress/etc.) go through
      return ORIG_FETCH.apply(this, arguments);
    } catch (e) {
      return Promise.reject(e);
    }
  };
})();
