export type AnalyticsEventPayload = {
  type: "pageview" | "menu_click" | "content_click";
  path?: string;
  referrer?: string;
  element?: {
    type?: string;
    id?: string;
    label?: string;
  };
  metadata?: Record<string, unknown>;
};

export function trackEvent(payload: AnalyticsEventPayload) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
      return;
    }
  } catch {
    // ignore sendBeacon failures
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}
