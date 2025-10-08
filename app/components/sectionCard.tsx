import { ElementType, ReactNode } from 'react'

type SectionCardTone = 'neutral' | 'lavender' | 'dimmed'

type HeadingLevel = 'h2' | 'h3' | 'h4'

interface SectionCardProps {
  id?: string
  className?: string
  bodyClassName?: string
  tone?: SectionCardTone
  headingLevel?: HeadingLevel
  as?: ElementType
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  footer?: ReactNode
  header?: ReactNode
  children: ReactNode
}

const toneVariants: Record<SectionCardTone, string> = {
  neutral:
    'border-white/25 bg-white/75 text-purple-950/90 shadow-lg shadow-purple-900/10 backdrop-blur',
  lavender:
    'border-purple-200/60 bg-gradient-to-br from-purple-100/70 via-white/70 to-white/90 text-purple-950/90 shadow-lg shadow-purple-900/20 backdrop-blur',
  dimmed:
    'border-purple-500/40 bg-gradient-to-br from-[#362955]/90 via-[#2e2350]/85 to-[#1f1a3d]/90 text-white shadow-xl shadow-purple-900/30 backdrop-blur'
}

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter((value) => Boolean(value && value.trim().length > 0)).join(' ')
}

export default function SectionCard({
  id,
  className,
  bodyClassName,
  tone = 'neutral',
  headingLevel = 'h2',
  as = 'section',
  eyebrow,
  title,
  description,
  actions,
  footer,
  header,
  children,
}: SectionCardProps) {
  const HeadingTag = headingLevel as ElementType
  const Component = as

  return (
    <Component
      id={id}
      className={cn(
        'relative overflow-hidden rounded-3xl border p-6 transition-colors duration-300',
        toneVariants[tone],
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-48 w-56 -translate-x-1/2 rounded-full bg-white/20 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-purple-300/25 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        {header ?? (
          (title || eyebrow || description || actions) && (
            <header className="flex flex-col gap-2">
              {eyebrow && (
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-700/70">
                  {eyebrow}
                </span>
              )}
              {title && (
                <HeadingTag className="text-2xl font-black leading-tight text-current">
                  {title}
                </HeadingTag>
              )}
              {description && <p className="text-sm text-purple-900/70">{description}</p>}
              {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
            </header>
          )
        )}

        <div className={cn('flex flex-col gap-4', bodyClassName)}>{children}</div>

        {footer && <footer className="pt-4 text-xs text-purple-900/60">{footer}</footer>}
      </div>
    </Component>
  )
}
