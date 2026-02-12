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
    if (!path || path === lastTrackedPathRef.current) {
      return;
    }
    lastTrackedPathRef.current = path;

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
      // bfcache 복귀 시에도 페이지뷰를 재기록해 누락을 줄입니다.
      if (!event.persisted) return;
      lastTrackedPathRef.current = "";
      sendPageview();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [sendPageview]);

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
