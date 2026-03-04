"use client";

import { ReactNode } from "react";
import { useSectionView } from "@/app/hooks/useSectionView";

interface SectionTrackerProps {
  sectionId: string;
  children: ReactNode;
  className?: string;
}

export function SectionTracker({
  sectionId,
  children,
  className,
}: SectionTrackerProps) {
  const ref = useSectionView(sectionId);

  return (
    <section ref={ref} id={sectionId} className={["scroll-mt-24 sm:scroll-mt-28", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
