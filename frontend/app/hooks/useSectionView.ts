"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/app/components/analytics/track";

const trackedSections = new Set<string>();
const SECTION_TRACK_KEY = "wc_tracked_sections";

function hasTrackedSection(key: string) {
  if (trackedSections.has(key)) return true;
  try {
    const raw = sessionStorage.getItem(SECTION_TRACK_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.includes(key);
  } catch {
    return false;
  }
}

function markTrackedSection(key: string) {
  trackedSections.add(key);
  try {
    const raw = sessionStorage.getItem(SECTION_TRACK_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(list) ? list : [];
    if (!next.includes(key)) next.push(key);
    sessionStorage.setItem(SECTION_TRACK_KEY, JSON.stringify(next.slice(-200)));
  } catch {
    // ignore storage failures
  }
}

export function useSectionView(sectionId: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const path = window.location.pathname;
    const sectionKey = `${path}::${sectionId}`;

    // 같은 세션에서 같은 페이지/섹션은 1회만 집계
    if (hasTrackedSection(sectionKey)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedSection(sectionKey)) {
            markTrackedSection(sectionKey);
            trackEvent({
              type: "section_view",
              path,
              element: {
                type: "section",
                id: sectionId,
                label: sectionId,
              },
              metadata: {
                visibility_ratio: Number(entry.intersectionRatio.toFixed(3)),
              },
            });
          }
        });
      },
      {
        threshold: 0.55,
        rootMargin: "0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [sectionId]);

  return ref;
}
