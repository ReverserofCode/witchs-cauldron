import { ElementType, ReactNode } from "react";

type SectionCardTone = "neutral" | "lavender" | "dimmed";

type HeadingLevel = "h2" | "h3" | "h4";

export interface SectionCardProps {
  id?: string;
  className?: string;
  bodyClassName?: string;
  tone?: SectionCardTone;
  headingLevel?: HeadingLevel;
  as?: ElementType;
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
}

const toneVariants: Record<SectionCardTone, string> = {
  neutral:
    "border-purple-200/55 bg-white/86 text-purple-950/90 shadow-[0_12px_28px_rgba(91,33,182,0.07)] backdrop-blur",
  lavender:
    "border-purple-200/60 bg-gradient-to-br from-purple-100/60 via-white/90 to-white/96 text-purple-950/90 shadow-[0_14px_30px_rgba(91,33,182,0.08)] backdrop-blur",
  dimmed:
    "border-purple-400/35 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_28%),linear-gradient(145deg,rgba(54,41,85,0.96),rgba(31,26,61,0.94))] text-white shadow-[0_18px_44px_rgba(46,35,80,0.28)] backdrop-blur",
};

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter((value) => Boolean(value && value.trim().length > 0)).join(" ");
}

export default function SectionCard({
  id,
  className,
  bodyClassName,
  tone = "neutral",
  headingLevel = "h2",
  as = "section",
  eyebrow,
  title,
  description,
  actions,
  footer,
  header,
  children,
}: SectionCardProps) {
  const HeadingTag = headingLevel as ElementType;
  const Component = as;

  return (
    <Component
      id={id}
      className={cn(
        "relative overflow-hidden rounded-[24px] border p-4 transition-colors duration-300 sm:p-5",
        toneVariants[tone],
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-28 w-36 -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 right-0 h-28 w-28 rounded-full bg-purple-300/12 blur-3xl"
      />

      <div className="relative flex flex-col gap-4">
        {header ??
          ((title || eyebrow || description || actions) && (
            <header className="flex flex-col gap-2">
              {eyebrow && (
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                  {eyebrow}
                </span>
              )}
              {title && (
                <HeadingTag className="text-[1.4rem] font-black text-current typography-heading sm:text-[1.55rem]">
                  {title}
                </HeadingTag>
              )}
              {description && (
                <p className="max-w-2xl text-xs text-purple-900/70 typography-small">{description}</p>
              )}
              {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
            </header>
          ))}

        <div className={cn("flex flex-col gap-4", bodyClassName)}>{children}</div>

        {footer && <footer className="pt-4 text-xs text-purple-900/60">{footer}</footer>}
      </div>
    </Component>
  );
}
