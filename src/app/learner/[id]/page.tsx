import Link from 'next/link'
import { notFound } from 'next/navigation'

import { adapters } from '@/adapters'
import { AppHeader } from '@/components/app-header'
import { ProgressMonitorChart } from '@/components/charts'
import {
  Avatar,
  Badge,
  Delta,
  Muted,
  Progress,
  Row,
  Rows,
  SignalTriad,
  Stat,
  Tile,
  TierBadge,
  formatDay,
  relativeTime,
  toneForScore,
} from '@/components/ui'
import { requireUser } from '@/data/auth'
import { assertCanViewLearner, getAccessHistory } from '@/data/scope'

export default async function LearnerPage(props: PageProps<'/learner/[id]'>) {
  const { id } = await props.params
  const user = await requireUser()

  // Gate first: this both authorises and writes the access record. A denial
  // renders the 403 boundary and is itself logged.
  await assertCanViewLearner(user, id, 'Opened learner record')

  const learner = await adapters.sis.getLearner(id)
  if (!learner) notFound()

  const [risk, history, plans, progress, engagement, outreach, tickets, access] =
    await Promise.all([
      adapters.mtss.getRisk(id),
      adapters.mtss.getRiskHistory(id),
      adapters.mtss.listPlans(id),
      adapters.lms.listSectionProgress(id),
      adapters.sis.getEngagementWindow(id, 20),
      adapters.mtss.listOutreach([id], 6),
      adapters.mtss.listSupportTickets([id]),
      getAccessHistory(id, 6),
    ])

  const openTickets = tickets.filter((t) => t.status !== 'resolved')
  const goal = plans[0]?.goals[0]
  const maxComposite = Math.max(100, ...history.map((h) => h.composite))

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
        <Link
          href="/"
          className="text-[12px] text-ink-muted transition-colors hover:text-accent-text"
        >
          ← Back to my view
        </Link>

        <div className="mt-3 mb-5 flex flex-wrap items-center gap-3">
          <Avatar name={learner.fullName} size={44} />
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">
              {learner.fullName}
            </h1>
            <p className="text-[12.5px] text-ink-muted">
              Grade {learner.gradeLevel} · {learner.pathway.replace('_', '-')} ·
              ID {learner.stateId}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {risk && <TierBadge tier={risk.tier} />}
            {openTickets.length > 0 && <Badge tone="watch">device request open</Badge>}
          </div>
        </div>

        {/* The reframe: when engagement is low but pace and performance are
            not, the problem is usually access, not motivation. */}
        {risk && openTickets.length > 0 && risk.engagement < 50 && risk.performance > 60 && (
          <div className="mb-5 rounded-xl border border-watch/40 bg-watch-soft px-4 py-3">
            <p className="text-[13px] font-semibold text-watch">
              Engagement is depressed but coursework quality is not.
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              There is an open {openTickets[0].category.replace('_', ' ')} request
              from {formatDay(openTickets[0].openedOn)}. Resolve access before
              treating this as a disengagement case.
            </p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <Tile title="Signals" subtitle="Engagement, Pace, Performance" source="Composed">
              {risk && (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="tnum text-3xl font-semibold text-ink">
                      {Math.round(risk.composite)}
                    </span>
                    <Delta value={risk.trend} />
                    <span className="ml-auto text-[11.5px] text-ink-muted">
                      last seen{' '}
                      {risk.daysSinceLastLogin === 0
                        ? 'today'
                        : `${risk.daysSinceLastLogin} days ago`}
                    </span>
                  </div>
                  <SignalTriad
                    engagement={risk.engagement}
                    pace={risk.pace}
                    performance={risk.performance}
                    topDriver={risk.tier > 1 ? risk.topDriver : undefined}
                  />
                </div>
              )}
            </Tile>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <Tile
              title="Composite over eight weeks"
              subtitle="Weekly snapshot"
              source="Supports"
            >
              <div className="flex h-28 items-end gap-1.5">
                {history.map((h) => (
                  <div key={h.asOf} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(h.composite / maxComposite) * 84}px`,
                        background:
                          h.tier === 1
                            ? 'var(--viz-tier-1)'
                            : h.tier === 2
                              ? 'var(--viz-tier-2)'
                              : 'var(--viz-tier-3)',
                      }}
                      title={`${formatDay(h.asOf)} — composite ${Math.round(h.composite)}, Tier ${h.tier}`}
                    />
                    <span className="tnum text-[10px] text-ink-faint">
                      {Math.round(h.composite)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                Bar shade indicates tier. Oldest week on the left.
              </p>
            </Tile>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <Tile title="Engagement, last 20 school days" source="Records">
              <div className="flex items-end gap-1">
                {engagement.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1"
                    title={`${formatDay(d.day)} — ${d.loggedIn ? `${d.activeMinutes} min, ${d.lessonsTouched} lessons` : 'no activity'}`}
                  >
                    <div
                      className={`rounded-t ${d.loggedIn ? 'bg-good' : 'bg-line'}`}
                      style={{
                        height: `${Math.max(4, Math.min(56, d.activeMinutes * 0.7))}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                Bar height is active minutes. Grey days had no recorded activity —
                this is what attendance means in a virtual program.
              </p>
            </Tile>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Tile title="Support plan" source="Supports">
              {goal ? (
                <div>
                  <p className="mb-1 text-[12.5px] font-medium text-ink">
                    {goal.description}
                  </p>
                  <ProgressMonitorChart
                    points={goal.points}
                    baseline={goal.baseline}
                    target={goal.target}
                    height={130}
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {plans[0].ownerName} · review {formatDay(plans[0].reviewOn)} ·{' '}
                    {plans[0].sessions.filter((x) => x.fidelity === 'as_planned').length}
                    /{plans[0].sessions.length} sessions delivered as planned
                  </p>
                </div>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  No active support plan. This learner is monitored through the
                  weekly composite alongside the rest of the caseload.
                </p>
              )}
            </Tile>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <Tile title="Courses" source="Learning">
              <div className="space-y-2.5">
                {progress.map((p) => (
                  <div key={p.sectionId}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-ink">{p.courseTitle}</span>{' '}
                        <Muted>· {p.teacherName}</Muted>
                      </span>
                      <span className="tnum shrink-0 font-semibold text-ink">
                        {p.currentGrade != null ? Math.round(p.currentGrade) : '—'}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Progress value={p.actualPct} expected={p.expectedPct} />
                    </div>
                  </div>
                ))}
              </div>
            </Tile>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <Tile title="Outreach" subtitle="Contact with learner and family" source="Supports">
              <Rows>
                {outreach.map((o) => (
                  <Row key={o.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">
                        {o.channel} to {o.audience}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {o.byName} · {o.outcome.replace('_', ' ')}
                      </span>
                    </span>
                    <Muted>{relativeTime(o.at)}</Muted>
                  </Row>
                ))}
              </Rows>
            </Tile>
          </div>

          {/* The FERPA-shaped disclosure record, made visible. */}
          <div className="col-span-12">
            <Tile
              title="Access record"
              subtitle="Who has opened this learner's record, and why"
              source="Composed"
            >
              <Rows>
                {access.map((a, i) => (
                  <Row key={i}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">
                        {a.actorGiven} {a.actorFamily}{' '}
                        <Muted>({a.actorRole})</Muted>
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {a.purpose}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!a.granted && <Badge tone="urgent">denied</Badge>}
                      <Muted>{relativeTime(a.at)}</Muted>
                    </span>
                  </Row>
                ))}
              </Rows>
            </Tile>
          </div>
        </div>
      </main>
    </>
  )
}
