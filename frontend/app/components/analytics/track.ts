export type AnalyticsEventPayload = {
  type:
    | "pageview"
    | "menu_click"
    | "content_click"
    | "section_view"
    | "scroll_depth"
    | "page_exit";
  event_id?: string;
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
  const eventPayload: AnalyticsEventPayload = {
    ...payload,
    event_id: payload.event_id ?? crypto.randomUUID(),
  };
  const body = JSON.stringify(eventPayload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const queued = navigator.sendBeacon("/api/analytics/track", blob);
      if (queued) {
        return;
      }
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
