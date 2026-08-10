import Link from 'next/link'
import type { ReactNode } from 'react'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export type Tone = 'good' | 'watch' | 'urgent' | 'neutral' | 'accent'

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  watch: 'bg-watch-soft text-watch',
  urgent: 'bg-urgent-soft text-urgent',
  accent: 'bg-accent-soft text-accent-text',
  neutral: 'bg-panel-muted text-ink-muted',
}

export function toneForScore(score: number): Tone {
  if (score >= 75) return 'good'
  if (score >= 55) return 'watch'
  return 'urgent'
}

export function toneForTier(tier: 1 | 2 | 3): Tone {
  return tier === 1 ? 'good' : tier === 2 ? 'watch' : 'urgent'
}

// ── Tile shell ───────────────────────────────────────────────────────────────

export function Tile({
  title,
  subtitle,
  action,
  source,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  /** Which source system this tile's data came from. */
  source?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex h-full flex-col rounded-xl border border-line bg-panel',
        className,
      )}
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {source && (
            <span className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint sm:inline">
              {source}
            </span>
          )}
          {action}
        </div>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  )
}

export function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  return <Badge tone={toneForTier(tier)}>Tier {tier}</Badge>
}

export function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return <span className="tnum text-[11px] text-ink-faint">no change</span>
  }
  const up = value > 0
  return (
    <span
      className={cn('tnum text-[11px] font-medium', up ? 'text-good' : 'text-urgent')}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}
    </span>
  )
}

// ── Numbers ──────────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
}) {
  const valueTone =
    tone === 'good'
      ? 'text-good'
      : tone === 'watch'
        ? 'text-watch'
        : tone === 'urgent'
          ? 'text-urgent'
          : 'text-ink'
  return (
    <div className="rounded-lg border border-line bg-panel-muted px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className={cn('tnum mt-1 text-2xl font-semibold tracking-tight', valueTone)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</div>}
    </div>
  )
}

/** Horizontal 0–100 meter. Always paired with its numeric value. */
export function Meter({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  const tone = toneForScore(value)
  const barColor =
    tone === 'good' ? 'bg-good' : tone === 'watch' ? 'bg-watch' : 'bg-urgent'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-[11.5px]',
            emphasis ? 'font-semibold text-ink' : 'text-ink-muted',
          )}
        >
          {label}
          {emphasis && (
            <span className="ml-1 text-[10px] font-normal text-ink-faint">
              leading driver
            </span>
          )}
        </span>
        <span className="tnum text-[12px] font-semibold text-ink">
          {Math.round(value)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={cn('h-full rounded-full', barColor)}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

/** The Engagement / Pace / Performance triad, used in several tiles. */
export function SignalTriad({
  engagement,
  pace,
  performance,
  topDriver,
}: {
  engagement: number
  pace: number
  performance: number
  topDriver?: 'engagement' | 'pace' | 'performance'
}) {
  return (
    <div className="space-y-2">
      <Meter label="Engagement" value={engagement} emphasis={topDriver === 'engagement'} />
      <Meter label="Pace" value={pace} emphasis={topDriver === 'pace'} />
      <Meter
        label="Performance"
        value={performance}
        emphasis={topDriver === 'performance'}
      />
    </div>
  )
}

export function Progress({ value, expected }: { value: number; expected?: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.max(1, Math.min(100, value))}%` }}
      />
      {expected != null && (
        <div
          className="absolute top-0 h-full w-0.5 bg-ink-faint"
          style={{ left: `${Math.min(100, expected)}%` }}
          title={`Expected ${Math.round(expected)}%`}
        />
      )}
    </div>
  )
}

/**
 * A labelled proportion bar. Preferred over a bar chart when there are only a
 * few parts of a whole — the counts read directly instead of being decoded off
 * an axis. Segments carry a 2px surface gap so adjacent fills stay separable,
 * and every segment is named in the row beneath, so colour is never the only
 * cue.
 */
export function ProportionBar({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string; hint?: string }[]
  total?: number
}) {
  const sum = total ?? segments.reduce((a, b) => a + b.value, 0)
  const safeSum = sum || 1

  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              width: `${(seg.value / safeSum) * 100}%`,
              background: seg.color,
            }}
            className="first:rounded-l-full last:rounded-r-full"
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: seg.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-ink-muted">
              {seg.label}
              {seg.hint && (
                <span className="ml-1 text-[11px] text-ink-faint">{seg.hint}</span>
              )}
            </span>
            <span className="tnum font-semibold text-ink">{seg.value}</span>
            <span className="tnum w-9 text-right text-[11px] text-ink-faint">
              {Math.round((seg.value / safeSum) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Lists ────────────────────────────────────────────────────────────────────

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line">{children}</ul>
}

export function Row({
  href,
  children,
}: {
  href?: string
  children: ReactNode
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
      {children}
    </div>
  )
  return (
    <li className="first:pt-0 last:pb-0">
      {href ? (
        <Link href={href} className="block rounded transition-colors hover:bg-panel-muted">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-text"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>
}

/** Short relative time, e.g. "4 min ago", "3 days ago". */
export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function formatDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
