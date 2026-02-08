"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "./track";

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string>("");

  useEffect(() => {
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    if (!path || path === lastTrackedPathRef.current) {
      return;
    }
    lastTrackedPathRef.current = path;

    trackEvent({
      type: "pageview",
      path,
      referrer: document.referrer || undefined,
    });
  }, [pathname, searchParams]);

  return null;
}
