// Intercept fetch calls to api.anthropic.com and route through local proxy
// This lets lyra.jsx work unchanged — no need to modify API URLs

const originalFetch = window.fetch;

window.fetch = function (url, options = {}) {
  if (typeof url === "string" && url.includes("api.anthropic.com/v1/messages")) {
    // Strip auth headers (proxy adds them), route through local proxy
    const newHeaders = { ...options.headers };
    delete newHeaders["x-api-key"];
    delete newHeaders["anthropic-version"];

    return originalFetch("/api/anthropic", {
      ...options,
      headers: newHeaders,
    });
  }
  return originalFetch(url, options);
};
