import type { ReactNode } from "react";

export interface SectionStatusProps {
  tone: "info" | "error" | "empty";
  children: ReactNode;
  title?: string;
  loading?: boolean;
  centered?: boolean;
  className?: string;
}

const toneClasses: Record<SectionStatusProps["tone"], string> = {
  info: "border-purple-200/60 bg-white/85 text-purple-900/80",
  error: "border-red-200 bg-red-50/90 text-red-700",
  empty: "border-purple-200/60 bg-white/80 text-purple-800/75",
};

function StatusIcon({ tone, loading }: Pick<SectionStatusProps, "tone" | "loading">) {
  if (loading) {
    return <span className="mt-0.5 h-4 w-4 animate-spin rounded-full border-2 border-current/20 border-t-current" aria-hidden="true" />;
  }

  if (tone === "error") {
    return (
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 114.64 4.14a8 8 0 0113.36 5.86zm-8.75-3.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 7.5a.875.875 0 100-1.75.875.875 0 000 1.75z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (tone === "empty") {
    return (
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3.5 5.25A1.75 1.75 0 015.25 3.5h9.5A1.75 1.75 0 0116.5 5.25v9.5a1.75 1.75 0 01-1.75 1.75h-9.5A1.75 1.75 0 013.5 14.75v-9.5zm1.75-.25a.25.25 0 00-.25.25v2h10v-2a.25.25 0 00-.25-.25h-9.5zm9.75 3.75H5v6a.25.25 0 00.25.25h9.5a.25.25 0 00.25-.25v-6z" />
      </svg>
    );
  }

  return (
    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 114.64 4.14a8 8 0 0113.36 5.86zM9.25 8.5a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V8.5zm.75-2.75a.875.875 0 100 1.75.875.875 0 000-1.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function SectionStatus({
  tone,
  children,
  title,
  loading = false,
  centered = false,
  className,
}: SectionStatusProps) {
  return (
    <div
      className={[
        "rounded-2xl border p-3 text-sm shadow-sm backdrop-blur-sm typography-body",
        centered ? "flex min-h-[9rem] flex-col items-center justify-center text-center" : "flex items-start gap-2.5",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      {centered ? (
        <>
          <StatusIcon tone={tone} loading={loading} />
          <div className="mt-2 space-y-1">
            {title && <p className="font-semibold">{title}</p>}
            <div>{children}</div>
          </div>
        </>
      ) : (
        <>
          <StatusIcon tone={tone} loading={loading} />
          <div className="min-w-0 space-y-0.5">
            {title && <p className="font-semibold">{title}</p>}
            <div>{children}</div>
          </div>
        </>
      )}
    </div>
  );
}
