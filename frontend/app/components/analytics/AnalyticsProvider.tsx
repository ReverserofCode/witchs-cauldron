"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "./track";

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function inferLocation(target: HTMLElement) {
  if (target.closest("header")) return "header";
  if (target.closest("footer")) return "footer";
  if (target.closest("aside")) return "aside";
  if (target.closest("nav")) return "nav";
  return "unknown";
}

const PAGEVIEW_TRACK_KEY = "wc_tracked_pageviews";

function hasTrackedInSession(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(PAGEVIEW_TRACK_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.includes(path);
  } catch {
    return false;
  }
}

function markTrackedInSession(path: string) {
  try {
    const raw = sessionStorage.getItem(PAGEVIEW_TRACK_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(list) ? list : [];
    if (!next.includes(path)) next.push(path);
    sessionStorage.setItem(PAGEVIEW_TRACK_KEY, JSON.stringify(next.slice(-100)));
  } catch {
    // ignore storage failures
  }
}

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string>("");

  const currentPath = useCallback(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const sendPageview = useCallback(() => {
    if (pathname.startsWith("/admin")) return;

    const path = currentPath();
    if (!path || path === lastTrackedPathRef.current || hasTrackedInSession(path)) {
      return;
    }
    lastTrackedPathRef.current = path;
    markTrackedInSession(path);

    trackEvent({
      type: "pageview",
      path,
      referrer: document.referrer || undefined,
    });
  }, [pathname, currentPath]);

  useEffect(() => {
    sendPageview();
  }, [sendPageview]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // bfcache 복귀는 페이지 재방문이 아니라 상태 복원으로 간주하여
      // pageview 중복 집계를 방지합니다.
      if (!event.persisted) return;
      lastTrackedPathRef.current = currentPath();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [currentPath]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const action = target.closest<HTMLElement>("[data-analytics-menu]");
      if (!action) return;

      const href = action instanceof HTMLAnchorElement ? action.href : action.getAttribute("href");
      const label = normalizeLabel(
        action.getAttribute("data-analytics-label") ||
          action.getAttribute("aria-label") ||
          action.textContent ||
          ""
      );
      const elementType = action.getAttribute("data-analytics-type") || action.tagName.toLowerCase();
      const elementId =
        action.getAttribute("data-analytics-id") || href || action.id || label || "(unknown)";

      trackEvent({
        type: "menu_click",
        path: currentPath(),
        element: {
          type: elementType,
          id: elementId,
          label: label || undefined,
        },
        metadata: {
          location: action.getAttribute("data-analytics-location") || inferLocation(action),
        },
      });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [currentPath]);

  return null;
}
