import Link from 'next/link'

import { adapters, getIntegrationStatus } from '@/adapters'
import type { CurrentUser } from '@/data/auth'
import { getScopedLearnerIds } from '@/data/scope'
import { EngagementTrendChart, ProgressMonitorChart } from '@/components/charts'
import {
  Avatar,
  Badge,
  Delta,
  Muted,
  Progress,
  ProportionBar,
  Row,
  Rows,
  SignalTriad,
  Stat,
  TierBadge,
  formatDay,
  relativeTime,
  toneForScore,
} from '@/components/ui'

const DRIVER_LABEL = {
  engagement: 'Engagement',
  pace: 'Pace',
  performance: 'Performance',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Teacher
// ─────────────────────────────────────────────────────────────────────────────

/** The action rail: what needs doing, ranked — not a list of places to go. */
export async function NeedsAttention({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const [risks, tickets] = await Promise.all([
    adapters.mtss.listRisk(ids),
    adapters.mtss.listSupportTickets(ids),
  ])

  const dark = risks.filter((r) => r.daysSinceLastLogin >= 4)
  const failing = risks.filter((r) => r.performance < 55)
  const behind = risks.filter((r) => r.pace < 55)
  const openTickets = tickets.filter((t) => t.status !== 'resolved')

  const actions = [
    {
      tone: 'urgent' as const,
      count: dark.length,
      label: 'have not signed in for four or more days',
      cta: 'Start outreach',
      names: dark.slice(0, 3).map((r) => r.learner.fullName),
    },
    {
      tone: 'urgent' as const,
      count: failing.length,
      label: 'are below passing in your sections',
      cta: 'Review gradebook',
      names: failing.slice(0, 3).map((r) => r.learner.fullName),
    },
    {
      tone: 'watch' as const,
      count: behind.length,
      label: 'are more than 15 points behind pace',
      cta: 'Assign catch-up plan',
      names: behind.slice(0, 3).map((r) => r.learner.fullName),
    },
    {
      tone: 'watch' as const,
      count: openTickets.length,
      label: 'have an open device or connectivity request',
      cta: 'Check status',
      names: openTickets.slice(0, 3).map((t) => t.learnerName),
    },
  ].filter((a) => a.count > 0)

  return (
    <ul className="space-y-2">
      {actions.map((a) => (
        <li
          key={a.label}
          className="flex items-center gap-3 rounded-lg border border-line bg-panel-muted px-3 py-2.5"
        >
          <Badge tone={a.tone}>{a.count}</Badge>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-ink">
              {a.count === 1 ? '1 learner' : `${a.count} learners`} {a.label}
            </span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {a.names.join(', ')}
              {a.count > 3 && ` and ${a.count - 3} more`}
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-line bg-panel px-2 py-1 text-[11.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent-text"
          >
            {a.cta}
          </button>
        </li>
      ))}
    </ul>
  )
}

export async function MySections({ user }: { user: CurrentUser }) {
  const sections = await adapters.lms.listSectionsForTeacher(user.id)
  return (
    <Rows>
      {sections.map((s) => (
        <Row key={s.id} href={`/section/${s.id}?tab=roster`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{s.courseTitle}</span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {s.cadence.replace(/_/g, ' ')} · open roster
            </span>
          </span>
          <span className="tnum text-ink-muted">{s.enrolledCount}</span>
        </Row>
      ))}
    </Rows>
  )
}

export async function AtRiskInSections({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const risks = (await adapters.mtss.listRisk(ids)).filter((r) => r.tier > 1)

  return (
    <Rows>
      {risks.slice(0, 6).map((r) => (
        <Row key={r.learnerId} href={`/learner/${r.learnerId}`}>
          <Avatar name={r.learner.fullName} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">
              {r.learner.fullName}
            </span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {DRIVER_LABEL[r.topDriver]} is the leading driver
              {r.hasOpenTicket && ' · open device request'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Delta value={r.trend} />
            <TierBadge tier={r.tier} />
          </span>
        </Row>
      ))}
    </Rows>
  )
}

export async function GradebookHealth({ user }: { user: CurrentUser }) {
  const health = await adapters.lms.getGradebookHealth(user.id)
  return (
    <Rows>
      {health.map((h) => (
        <Row key={h.sectionId} href={`/section/${h.sectionId}?tab=gradebook`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{h.courseTitle}</span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {h.learners} learners · {h.missingCount} missing submissions
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {h.belowPassing > 0 && (
              <Badge tone="urgent">{h.belowPassing} below passing</Badge>
            )}
            <span className="tnum w-8 text-right font-semibold text-ink">
              {Math.round(h.avgGrade)}
            </span>
          </span>
        </Row>
      ))}
    </Rows>
  )
}

export async function PacingStatus({ user }: { user: CurrentUser }) {
  const pacing = await adapters.curriculum.getPacingForTeacher(user.id)
  return (
    <div className="space-y-2.5">
      {pacing.slice(0, 6).map((p) => {
        const gap = Math.round(p.expectedPct - p.actualPct)
        return (
          <div key={`${p.sectionId}-${p.unitTitle}`}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{p.unitTitle}</span>{' '}
                <Muted>· {p.sectionName}</Muted>
              </span>
              <span
                className={`tnum shrink-0 text-[11.5px] font-medium ${
                  gap > 10 ? 'text-urgent' : gap > 0 ? 'text-watch' : 'text-good'
                }`}
              >
                {gap > 0 ? `${gap} behind` : `${Math.abs(gap)} ahead`}
              </span>
            </div>
            <div className="mt-1">
              <Progress value={p.actualPct} expected={p.expectedPct} />
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-ink-faint">
        Marker shows where the pacing guide expects this unit to be today.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Intervention specialist
// ─────────────────────────────────────────────────────────────────────────────

export async function ReferralInbox({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const referrals = await adapters.mtss.listReferrals(ids, 8)
  const open = referrals.filter((r) => r.status !== 'resolved')

  return (
    <Rows>
      {open.slice(0, 6).map((r) => (
        <Row key={r.id} href={`/learner/${r.learnerId}`}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-ink">{r.learnerName}</span>
              <Badge tone={r.category === 'kudos' ? 'good' : 'accent'}>
                {r.category}
              </Badge>
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
              {r.reason}
            </span>
            <span className="block truncate text-[11px] text-ink-faint">
              {r.raisedByName} · {formatDay(r.raisedOn)}
            </span>
          </span>
          <Badge tone={r.status === 'new' ? 'urgent' : 'neutral'}>
            {r.status.replace('_', ' ')}
          </Badge>
        </Row>
      ))}
    </Rows>
  )
}

export async function CaseloadOverview({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const [dist, risks] = await Promise.all([
    adapters.mtss.getTierDistribution(ids),
    adapters.mtss.listRisk(ids),
  ])
  const byTier = new Map(dist.map((d) => [d.tier, d.count]))
  const dark = risks.filter((r) => r.daysSinceLastLogin >= 4).length

  return (
    <div className="space-y-3">
      <Stat label="Caseload" value={ids.length} hint={`${dark} not seen in 4+ days`} />
      <ProportionBar
        segments={[
          { label: 'Tier 1 — Core', value: byTier.get(1) ?? 0, color: 'var(--viz-tier-1)' },
          { label: 'Tier 2 — Targeted', value: byTier.get(2) ?? 0, color: 'var(--viz-tier-2)' },
          { label: 'Tier 3 — Intensive', value: byTier.get(3) ?? 0, color: 'var(--viz-tier-3)' },
        ]}
      />
    </div>
  )
}

export async function Watchlist({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const risks = (await adapters.mtss.listRisk(ids)).slice(0, 8)

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="py-1.5 pr-2 font-medium">Learner</th>
            <th className="py-1.5 pr-2 font-medium">Tier</th>
            <th className="py-1.5 pr-2 text-right font-medium">Composite</th>
            <th className="py-1.5 pr-2 text-right font-medium">Week</th>
            <th className="py-1.5 pr-2 font-medium">Leading driver</th>
            <th className="py-1.5 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {risks.map((r) => (
            <tr key={r.learnerId} className="hover:bg-panel-muted">
              <td className="py-2 pr-2">
                <Link
                  href={`/learner/${r.learnerId}`}
                  className="flex items-center gap-2 font-medium text-ink hover:text-accent-text"
                >
                  <Avatar name={r.learner.fullName} size={24} />
                  <span className="truncate">{r.learner.fullName}</span>
                  <span className="text-[11px] font-normal text-ink-faint">
                    gr {r.learner.gradeLevel}
                  </span>
                </Link>
              </td>
              <td className="py-2 pr-2">
                <TierBadge tier={r.tier} />
              </td>
              <td className="tnum py-2 pr-2 text-right font-semibold text-ink">
                {Math.round(r.composite)}
              </td>
              <td className="py-2 pr-2 text-right">
                <Delta value={r.trend} />
              </td>
              <td className="py-2 pr-2 text-ink-muted">
                {DRIVER_LABEL[r.topDriver]}
                {r.hasOpenTicket && (
                  <span className="ml-1.5">
                    <Badge tone="watch">device</Badge>
                  </span>
                )}
              </td>
              <td className="py-2 text-ink-muted">
                {r.daysSinceLastLogin === 0
                  ? 'today'
                  : `${r.daysSinceLastLogin}d ago`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export async function ProgressMonitoring({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const learners = await adapters.sis.listLearners(ids)

  // Surface the plan whose review date is closest — that is the one the
  // specialist has to make a decision about next.
  const withPlans = (
    await Promise.all(
      learners.slice(0, 40).map(async (l) => ({
        learner: l,
        plans: await adapters.mtss.listPlans(l.id),
      })),
    )
  ).filter((e) => e.plans.length && e.plans[0].goals.length)

  withPlans.sort((a, b) => a.plans[0].reviewOn.localeCompare(b.plans[0].reviewOn))
  const top = withPlans[0]
  if (!top) return null

  const plan = top.plans[0]
  const goal = plan.goals[0]
  const latest = goal.points.at(-1)?.value ?? goal.baseline
  const closing = latest > goal.baseline

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Link
          href={`/learner/${top.learner.id}`}
          className="truncate text-[12.5px] font-semibold text-ink hover:text-accent-text"
        >
          {top.learner.fullName}
        </Link>
        <Badge tone={closing ? 'good' : 'urgent'}>
          {closing ? 'gap closing' : 'not responding'}
        </Badge>
      </div>
      <p className="mb-1 truncate text-[11.5px] text-ink-muted">{goal.description}</p>
      <ProgressMonitorChart
        points={goal.points}
        baseline={goal.baseline}
        target={goal.target}
      />
      <p className="mt-1 text-[11px] text-ink-faint">
        Review due {formatDay(plan.reviewOn)} · {plan.sessions.length} sessions
        logged ·{' '}
        {plan.sessions.filter((x) => x.fidelity === 'as_planned').length} delivered
        as planned
      </p>
    </div>
  )
}

export async function OutreachQueue({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const outreach = await adapters.mtss.listOutreach(ids, 8)

  return (
    <Rows>
      {outreach.slice(0, 6).map((o) => (
        <Row key={o.id} href={`/learner/${o.learnerId}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">
              {o.learnerName}
            </span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {o.channel} to {o.audience} · {o.outcome.replace('_', ' ')}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {o.outcome === 'no_answer' && <Badge tone="watch">retry</Badge>}
            <Muted>{relativeTime(o.at)}</Muted>
          </span>
        </Row>
      ))}
    </Rows>
  )
}

export async function SupportTickets({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const tickets = (await adapters.mtss.listSupportTickets(ids)).filter(
    (t) => t.status !== 'resolved',
  )

  return (
    <div className="space-y-2">
      <p className="text-[11.5px] leading-relaxed text-ink-muted">
        Learners whose engagement signal is depressed by a device or access
        problem rather than by disengagement. Treating these as motivation
        problems is the most common way a virtual program loses a learner.
      </p>
      <Rows>
        {tickets.slice(0, 6).map((t) => (
          <Row key={t.id} href={`/learner/${t.learnerId}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">
                {t.learnerName}
              </span>
              <span className="block truncate text-[11.5px] text-ink-muted">
                {t.note ?? t.category.replace('_', ' ')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge tone={t.status === 'open' ? 'urgent' : 'watch'}>
                {t.status.replace('_', ' ')}
              </Badge>
              <Muted>{formatDay(t.openedOn)}</Muted>
            </span>
          </Row>
        ))}
      </Rows>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Administrator
// ─────────────────────────────────────────────────────────────────────────────

export async function ProgramHealth({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const risks = await adapters.mtss.listRisk(ids)

  const dark = risks.filter((r) => r.daysSinceLastLogin >= 5).length
  const tier3 = risks.filter((r) => r.tier === 3).length
  const behind = risks.filter((r) => r.pace < 60).length
  const failing = risks.filter((r) => r.performance < 60).length
  const avgEngagement =
    risks.reduce((a, r) => a + r.engagement, 0) / (risks.length || 1)

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
      <Stat label="Enrolled" value={ids.length} hint="active learners" />
      <Stat
        label="Not seen 5+ days"
        value={dark}
        tone={dark > 10 ? 'urgent' : 'watch'}
        hint={`${Math.round((dark / (ids.length || 1)) * 100)}% of program`}
      />
      <Stat
        label="Tier 3"
        value={tier3}
        tone={tier3 > 20 ? 'urgent' : 'watch'}
        hint="intensive support"
      />
      <Stat label="Behind pace" value={behind} tone="watch" hint="pace below 60" />
      <Stat
        label="Avg engagement"
        value={Math.round(avgEngagement)}
        tone={toneForScore(avgEngagement)}
        hint={`${failing} below passing`}
      />
    </div>
  )
}

export async function TierDistribution({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const [dist, movement] = await Promise.all([
    adapters.mtss.getTierDistribution(ids),
    adapters.mtss.getTierMovement(ids, 8),
  ])
  const byTier = new Map(dist.map((d) => [d.tier, d.count]))
  const first = movement[0]
  const last = movement.at(-1)
  const tier3Delta = first && last ? last.tier3 - first.tier3 : 0

  return (
    <div className="space-y-3">
      <ProportionBar
        segments={[
          { label: 'Tier 1 — Core', value: byTier.get(1) ?? 0, color: 'var(--viz-tier-1)' },
          { label: 'Tier 2 — Targeted', value: byTier.get(2) ?? 0, color: 'var(--viz-tier-2)' },
          { label: 'Tier 3 — Intensive', value: byTier.get(3) ?? 0, color: 'var(--viz-tier-3)' },
        ]}
      />
      <p className="text-[11.5px] text-ink-muted">
        Over the last eight weeks Tier 3 has{' '}
        {tier3Delta === 0
          ? 'held steady'
          : tier3Delta > 0
            ? `grown by ${tier3Delta}`
            : `shrunk by ${Math.abs(tier3Delta)}`}
        .
      </p>
    </div>
  )
}

export async function EngagementTrend({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const trend = await adapters.sis.getProgramEngagementTrend(ids, 8)
  return <EngagementTrendChart data={trend} />
}

export async function InterventionEffectiveness({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const eff = await adapters.mtss.getInterventionEffectiveness(ids)
  const total = eff.improving + eff.flat + eff.declining

  return (
    <div className="space-y-3">
      <ProportionBar
        segments={[
          { label: 'Improving', value: eff.improving, color: 'var(--viz-positive)' },
          { label: 'Holding steady', value: eff.flat, color: 'var(--viz-neutral)' },
          { label: 'Still declining', value: eff.declining, color: 'var(--viz-negative)' },
        ]}
      />
      <p className="text-[11.5px] leading-relaxed text-ink-muted">
        Composite change since a plan was opened, across {total} learners
        currently on one. Measures whether support is working — not whether the
        population drifted.
      </p>
    </div>
  )
}

export async function PacingAcrossSections() {
  const pacing = await adapters.curriculum.getPacingAcrossProgram(6)
  return (
    <div className="space-y-2.5">
      {pacing.map((p) => {
        const gap = Math.round(p.expectedPct - p.actualPct)
        return (
          <div key={`${p.sectionId}-${p.unitTitle}`}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <Link
                href={`/section/${p.sectionId}?tab=gradebook`}
                className="min-w-0 truncate text-ink hover:text-accent-text"
              >
                {p.sectionName}
              </Link>
              <span
                className={`tnum shrink-0 text-[11.5px] font-medium ${
                  gap > 10 ? 'text-urgent' : gap > 0 ? 'text-watch' : 'text-good'
                }`}
              >
                {gap > 0 ? `${gap} behind` : `${Math.abs(gap)} ahead`}
              </span>
            </div>
            <div className="mt-1">
              <Progress value={p.actualPct} expected={p.expectedPct} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export async function IntegrationHealth() {
  const sources = await getIntegrationStatus()
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[520px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="py-1.5 pr-2 font-medium">Source system</th>
            <th className="py-1.5 pr-2 font-medium">Status</th>
            <th className="py-1.5 pr-2 text-right font-medium">Records</th>
            <th className="py-1.5 font-medium">Last sync</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sources.map((s) => (
            <tr key={s.key}>
              <td className="py-2 pr-2">
                <span className="font-medium text-ink">{s.label}</span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {s.note}
                </span>
              </td>
              <td className="py-2 pr-2">
                <Badge
                  tone={
                    s.status === 'healthy'
                      ? 'good'
                      : s.status === 'degraded'
                        ? 'watch'
                        : 'urgent'
                  }
                >
                  {s.status}
                </Badge>
              </td>
              <td className="tnum py-2 pr-2 text-right text-ink-muted">
                {s.recordCount.toLocaleString()}
              </td>
              <td className="py-2 text-ink-muted">{relativeTime(s.lastSyncAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Shared by several tiles that want the triad for one learner. */
export async function LearnerSignals({ learnerId }: { learnerId: string }) {
  const risk = await adapters.mtss.getRisk(learnerId)
  if (!risk) return null
  return (
    <SignalTriad
      engagement={risk.engagement}
      pace={risk.pace}
      performance={risk.performance}
      topDriver={risk.tier > 1 ? risk.topDriver : undefined}
    />
  )
}
