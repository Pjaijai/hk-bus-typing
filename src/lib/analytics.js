// Google Analytics 4, loaded only when VITE_GA_ID is set (e.g. G-XXXXXXXXXX).
// Locally and on previews without the variable this is a no-op.
export function initAnalytics() {
  const id = import.meta.env.VITE_GA_ID;
  if (!id) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

export function trackEvent(name, params = {}) {
  window.gtag?.("event", name, params);
}
