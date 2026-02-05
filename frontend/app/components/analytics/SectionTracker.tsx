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
    <section ref={ref} id={sectionId} className={className}>
      {children}
    </section>
  );
}
