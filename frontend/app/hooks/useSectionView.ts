"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/app/components/analytics/track";

const trackedSections = new Set<string>();

export function useSectionView(sectionId: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Skip if already tracked in this session
    if (trackedSections.has(sectionId)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !trackedSections.has(sectionId)) {
            trackedSections.add(sectionId);
            trackEvent({
              type: "section_view",
              path: window.location.pathname,
              element: {
                type: "section",
                id: sectionId,
                label: sectionId,
              },
            });
          }
        });
      },
      {
        threshold: 0.5, // 50% visible
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
