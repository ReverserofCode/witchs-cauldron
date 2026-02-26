"use client";

import { useEffect, useState } from "react";

/**
 * IntersectionObserver 기반 스크롤 스파이 훅.
 * 관찰 대상 섹션 ID 배열을 받아 현재 뷰포트에 보이는 섹션 ID를 반환한다.
 * useSectionView(analytics 1회성)와 달리 지속적으로 업데이트된다.
 */
export function useActiveSection(sectionIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visibleSet = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSet.set(entry.target.id, entry);
          } else {
            visibleSet.delete(entry.target.id);
          }
        }

        // 보이는 섹션 중 페이지 상단에 가장 가까운 것을 선택
        if (visibleSet.size === 0) return;

        let topmost: string | null = null;
        let topY = Infinity;

        for (const [id, entry] of Array.from(visibleSet)) {
          if (entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topmost = id;
          }
        }

        if (topmost) setActiveId(topmost);
      },
      { threshold: 0.3, rootMargin: "-80px 0px 0px 0px" }
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
