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

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;

function getScrollDepthPercent() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const full = doc.scrollHeight || 0;
  if (full <= 0 || viewport <= 0) return 0;
  const maxScrollable = Math.max(1, full - viewport);
  return Math.min(100, Math.max(0, Math.round((scrollTop / maxScrollable) * 100)));
}

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string>("");
  const pageStartMsRef = useRef<number>(Date.now());
  const firedScrollThresholdsRef = useRef<Set<number>>(new Set());
  const pageExitSentPathRef = useRef<string>("");

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
    pageStartMsRef.current = Date.now();
    firedScrollThresholdsRef.current = new Set();
    pageExitSentPathRef.current = "";
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

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const handleScroll = () => {
      const depth = getScrollDepthPercent();
      for (const threshold of SCROLL_THRESHOLDS) {
        if (depth >= threshold && !firedScrollThresholdsRef.current.has(threshold)) {
          firedScrollThresholdsRef.current.add(threshold);
          trackEvent({
            type: "scroll_depth",
            path: currentPath(),
            metadata: {
              threshold,
              depth,
            },
          });
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname, currentPath]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const sendPageExit = () => {
      const path = currentPath();
      if (!path || pageExitSentPathRef.current === path) return;
      pageExitSentPathRef.current = path;

      const dwellSeconds = Math.max(0, Math.round((Date.now() - pageStartMsRef.current) / 1000));
      trackEvent({
        type: "page_exit",
        path,
        metadata: {
          dwell_seconds: dwellSeconds,
          max_scroll_depth: getScrollDepthPercent(),
        },
      });
    };

    const handlePageHide = () => sendPageExit();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") sendPageExit();
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, currentPath]);

  return null;
}
