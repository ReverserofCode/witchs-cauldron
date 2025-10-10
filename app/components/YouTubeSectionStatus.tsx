import type { ReactNode } from "react";

interface YouTubeSectionStatusProps {
  tone: "info" | "error" | "empty";
  children: ReactNode;
}

const toneClasses: Record<YouTubeSectionStatusProps["tone"], string> = {
  info: "text-purple-900/75 border-purple-200/60 bg-white/85",
  error: "text-red-600 border-red-200 bg-red-50/85",
  empty: "text-purple-800/70 border-purple-200/60 bg-white/80",
};

export default function YouTubeSectionStatus({ tone, children }: YouTubeSectionStatusProps) {
  return (
    <div
      className={`rounded-2xl border p-3 text-sm typography-body shadow-sm backdrop-blur-sm ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
