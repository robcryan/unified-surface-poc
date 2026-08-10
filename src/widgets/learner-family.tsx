import Link from 'next/link'

import { adapters } from '@/adapters'
import type { CurrentUser } from '@/data/auth'
import { getScopedLearnerIds } from '@/data/scope'
import {
  Badge,
  Meter,
  Muted,
  Progress,
  Row,
  Rows,
  SignalTriad,
  Stat,
  TierBadge,
  formatDay,
  relativeTime,
  toneForScore,
} from '@/components/ui'

const STATUS_TONE = {
  missing: 'urgent',
  late: 'watch',
  upcoming: 'accent',
  graded: 'neutral',
  submitted: 'neutral',
  not_started: 'watch',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Learner
// ─────────────────────────────────────────────────────────────────────────────

export async function MyWork({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const work = await adapters.lms.listWork(user.learnerId, 7)
  const missing = work.filter((w) => w.status === 'missing').length

  return (
    <div className="space-y-3">
      {missing > 0 && (
        <p className="rounded-lg bg-urgent-soft px-3 py-2 text-[12px] text-urgent">
          <strong>{missing} pieces of work are missing.</strong> Clearing these
          is the fastest way to move your grade.
        </p>
      )}
      <Rows>
        {work.map((w) => (
          <Row key={w.id}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{w.title}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">
                {w.courseTitle} · due {formatDay(w.dueOn)}
              </span>
            </span>
            <Badge tone={STATUS_TONE[w.status] ?? 'neutral'}>
              {w.status.replace('_', ' ')}
            </Badge>
          </Row>
        ))}
      </Rows>
    </div>
  )
}

export async function MyPace({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const [risk, progress] = await Promise.all([
    adapters.mtss.getRisk(user.learnerId),
    adapters.lms.listSectionProgress(user.learnerId),
  ])
  if (!risk) return null

  const avgActual =
    progress.reduce((a, p) => a + p.actualPct, 0) / (progress.length || 1)
  const expected = progress[0]?.expectedPct ?? 0
  const gap = Math.round(expected - avgActual)

  return (
    <div className="space-y-3">
      <Stat
        label="Course completion"
        value={`${Math.round(avgActual)}%`}
        tone={toneForScore(risk.pace)}
        hint={
          gap > 3
            ? `${gap} points behind where the calendar expects you`
            : gap < -3
              ? `${Math.abs(gap)} points ahead of schedule`
              : 'On schedule'
        }
      />
      <Progress value={avgActual} expected={expected} />
      <p className="text-[11px] text-ink-faint">
        The marker shows expected progress for today.
      </p>
    </div>
  )
}

export async function MyGrades({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const progress = await adapters.lms.listSectionProgress(user.learnerId)
  return (
    <Rows>
      {progress.map((p) => (
        <Row key={p.sectionId}>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">
              {p.courseTitle}
            </span>
            <span className="block truncate text-[11.5px] text-ink-muted">
              {p.teacherName} · {p.lessonsComplete}/{p.lessonsTotal} lessons
            </span>
          </span>
          <span className="tnum font-semibold text-ink">
            {p.currentGrade != null ? Math.round(p.currentGrade) : '—'}
          </span>
        </Row>
      ))}
    </Rows>
  )
}

export async function MyGoals({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const [plans, risk] = await Promise.all([
    adapters.mtss.listPlans(user.learnerId),
    adapters.mtss.getRisk(user.learnerId),
  ])
  const goal = plans[0]?.goals[0]

  if (!goal) {
    return (
      <div className="space-y-3">
        <p className="text-[12.5px] text-ink-muted">
          No support goal is active right now. Here is where you stand across the
          three signals your school watches.
        </p>
        {risk && (
          <SignalTriad
            engagement={risk.engagement}
            pace={risk.pace}
            performance={risk.performance}
          />
        )}
      </div>
    )
  }

  const latest = goal.points.at(-1)?.value ?? goal.baseline
  const pct = Math.round(
    ((latest - goal.baseline) / Math.max(1, goal.target - goal.baseline)) * 100,
  )

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] font-medium text-ink">{goal.description}</p>
      <Progress value={Math.max(0, Math.min(100, pct))} />
      <div className="flex items-baseline justify-between text-[11.5px] text-ink-muted">
        <span>
          Started at <span className="tnum">{Math.round(goal.baseline)}</span>
        </span>
        <span className="font-semibold text-ink">
          Now <span className="tnum">{Math.round(latest)}</span>
        </span>
        <span>
          Goal <span className="tnum">{Math.round(goal.target)}</span>
        </span>
      </div>
      <p className="text-[11px] text-ink-faint">
        Working with {plans[0].ownerName} · next review {formatDay(plans[0].reviewOn)}
      </p>
    </div>
  )
}

export async function CourseMaterials({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const materials = await adapters.curriculum.getCurrentMaterials(user.learnerId)
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {materials.slice(0, 4).map((m) => (
        <li
          key={`${m.courseTitle}-${m.unitTitle}`}
          className="rounded-lg border border-line bg-panel-muted px-3 py-2.5"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            {m.courseTitle}
          </div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-ink">
            {m.unitTitle}
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {m.lessons.slice(0, 3).map((l) => (
              <li key={l} className="truncate text-[11.5px] text-ink-muted">
                {l}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export async function GetHelp({ user }: { user: CurrentUser }) {
  if (!user.learnerId) return null
  const [learner, tickets] = await Promise.all([
    adapters.sis.getLearner(user.learnerId),
    adapters.mtss.listSupportTickets([user.learnerId]),
  ])
  const open = tickets.filter((t) => t.status !== 'resolved')

  return (
    <div className="space-y-2.5">
      {open.length > 0 && (
        <div className="rounded-lg bg-watch-soft px-3 py-2 text-[12px] text-watch">
          Technology request open since {formatDay(open[0].openedOn)} —{' '}
          {open[0].category.replace('_', ' ')}
        </div>
      )}
      {[
        ['Message my teacher', 'Usually answered within one school day'],
        ['Request a check-in', `With ${learner?.counselorUserId ? 'your specialist' : 'a counselor'}`],
        ['Report a device or internet problem', 'Technology support'],
      ].map(([label, hint]) => (
        <button
          key={label}
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-line bg-panel-muted px-3 py-2.5 text-left transition-colors hover:bg-accent-soft"
        >
          <span>
            <span className="block text-[12.5px] font-medium text-ink">{label}</span>
            <span className="block text-[11px] text-ink-muted">{hint}</span>
          </span>
          <span className="text-ink-faint" aria-hidden>
            →
          </span>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Parent / Guardian
// ─────────────────────────────────────────────────────────────────────────────

export async function MyLearners({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const risks = await adapters.mtss.listRisk(ids)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {risks.map((r) => (
        <Link
          key={r.learnerId}
          href={`/learner/${r.learnerId}`}
          className="rounded-lg border border-line bg-panel-muted p-3 transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">
              {r.learner.fullName}
            </span>
            <TierBadge tier={r.tier} />
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-muted">
            Grade {r.learner.gradeLevel}
            {r.daysSinceLastLogin > 2 && (
              <span className="ml-1 text-urgent">
                · last signed in {r.daysSinceLastLogin} days ago
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <SignalTriad
              engagement={r.engagement}
              pace={r.pace}
              performance={r.performance}
              topDriver={r.tier > 1 ? r.topDriver : undefined}
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

export async function WeeklySnapshot({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const [risks, learners] = await Promise.all([
    adapters.mtss.listRisk(ids),
    adapters.sis.listLearners(ids),
  ])

  const rows = await Promise.all(
    learners.map(async (l) => {
      const days = await adapters.sis.getEngagementWindow(l.id, 5)
      return { learner: l, days }
    }),
  )

  return (
    <div className="space-y-3">
      {rows.map(({ learner, days }) => {
        const risk = risks.find((r) => r.learnerId === learner.id)
        const attended = days.filter((d) => d.loggedIn).length
        const minutes = days.reduce((a, d) => a + d.activeMinutes, 0)
        return (
          <div key={learner.id}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12.5px] font-semibold text-ink">
                {learner.givenName}
              </span>
              <span className="text-[11px] text-ink-muted">
                {attended} of {days.length} school days ·{' '}
                <span className="tnum">{Math.round(minutes / 60)}</span> hrs
              </span>
            </div>
            <div className="flex gap-1">
              {days.map((d) => (
                <div
                  key={d.day}
                  title={`${formatDay(d.day)} — ${d.loggedIn ? `${d.activeMinutes} min` : 'no activity'}`}
                  className={`h-6 flex-1 rounded ${d.loggedIn ? 'bg-good' : 'bg-line'}`}
                />
              ))}
            </div>
            {risk && risk.pace < 60 && (
              <p className="mt-1.5 text-[11px] text-watch">
                Behind pace in coursework — worth a conversation this week.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export async function WhatWereWorkingOn({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const learners = await adapters.sis.listLearners(ids)

  const entries = await Promise.all(
    learners.map(async (l) => ({
      learner: l,
      plans: await adapters.mtss.listPlans(l.id),
    })),
  )

  const withPlans = entries.filter((e) => e.plans.length)

  if (!withPlans.length) {
    return (
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Neither learner has an active support plan. Their teachers and the
        intervention team review progress every week and will reach out here if
        anything changes.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {withPlans.map(({ learner, plans }) => (
        <div key={learner.id} className="rounded-lg border border-line bg-panel-muted p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-ink">
              {learner.givenName}
            </span>
            <Badge tone="accent">Tier {plans[0].tier}</Badge>
          </div>
          {/* Written for families, not for practitioners. */}
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">
            {plans[0].goals[0]?.description ?? plans[0].focus}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-muted">
            Working with {plans[0].ownerName}. Next review{' '}
            {formatDay(plans[0].reviewOn)}.
          </p>
        </div>
      ))}
    </div>
  )
}

export async function UpcomingWork({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const learners = await adapters.sis.listLearners(ids)
  const lists = await Promise.all(
    learners.map(async (l) => ({
      learner: l,
      work: (await adapters.lms.listWork(l.id, 4)).filter(
        (w) => w.status === 'missing' || w.status === 'upcoming',
      ),
    })),
  )

  return (
    <div className="space-y-3">
      {lists.map(({ learner, work }) => (
        <div key={learner.id}>
          <div className="mb-1 text-[12px] font-semibold text-ink">
            {learner.givenName}
          </div>
          <Rows>
            {work.slice(0, 3).map((w) => (
              <Row key={w.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{w.title}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">
                    {w.courseTitle} · due {formatDay(w.dueOn)}
                  </span>
                </span>
                <Badge tone={STATUS_TONE[w.status] ?? 'neutral'}>
                  {w.status.replace('_', ' ')}
                </Badge>
              </Row>
            ))}
          </Rows>
        </div>
      ))}
    </div>
  )
}

export async function SupportStatus({ user }: { user: CurrentUser }) {
  const ids = await getScopedLearnerIds(user)
  const [tickets, outreach] = await Promise.all([
    adapters.mtss.listSupportTickets(ids),
    adapters.mtss.listOutreach(ids, 4),
  ])
  const open = tickets.filter((t) => t.status !== 'resolved')

  return (
    <div className="space-y-3">
      {open.length > 0 ? (
        open.map((t) => (
          <div key={t.id} className="rounded-lg bg-watch-soft px-3 py-2">
            <div className="text-[12px] font-semibold text-watch">
              {t.category.replace('_', ' ')} — {t.status.replace('_', ' ')}
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-muted">
              {t.learnerName} · opened {formatDay(t.openedOn)}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg bg-good-soft px-3 py-2 text-[12px] text-good">
          No open technology or access requests.
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Recent contact from school
        </div>
        <Rows>
          {outreach.slice(0, 3).map((o) => (
            <Row key={o.id}>
              <span className="min-w-0 flex-1 truncate text-ink">
                {o.byName} · {o.channel}
              </span>
              <Muted>{relativeTime(o.at)}</Muted>
            </Row>
          ))}
        </Rows>
      </div>
    </div>
  )
}
