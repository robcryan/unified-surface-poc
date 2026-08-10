import Link from 'next/link'
import { notFound } from 'next/navigation'

import { adapters } from '@/adapters'
import { AppHeader } from '@/components/app-header'
import { Badge, Tile, cn } from '@/components/ui'
import { requireUser } from '@/data/auth'
import { assertCanViewSection } from '@/data/scope'

import { GradebookGrid } from './gradebook'
import { RosterPanel } from './roster'

export default async function SectionPage(props: PageProps<'/section/[id]'>) {
  const { id } = await props.params
  const search = await props.searchParams
  const tab = search.tab === 'roster' ? 'roster' : 'gradebook'

  const user = await requireUser()
  const { canEdit } = await assertCanViewSection(user, id)

  const [gradebook, roster] = await Promise.all([
    adapters.lms.getGradebook(id),
    adapters.sis.getSectionRoster(id),
  ])
  if (!gradebook || !roster) notFound()

  const missingCount = gradebook.rows.reduce(
    (a, r) => a + r.cells.filter((c) => c.status === 'missing').length,
    0,
  )
  const graded = gradebook.rows.flatMap((r) =>
    r.currentGrade == null ? [] : [r.currentGrade],
  )
  const avg = graded.length
    ? Math.round((graded.reduce((a, b) => a + b, 0) / graded.length) * 10) / 10
    : null

  const TABS = [
    { key: 'gradebook', label: 'Gradebook', source: 'LMS' },
    { key: 'roster', label: 'Roster & enrolment', source: 'SIS' },
  ] as const

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8">
        <Link
          href="/"
          className="text-[12px] text-ink-muted transition-colors hover:text-accent-text"
        >
          ← Back to my view
        </Link>

        <div className="mt-3 mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">
            {gradebook.courseTitle}
          </h1>
          <span className="text-[12.5px] text-ink-muted">
            {roster.sectionName} · {roster.termName} ·{' '}
            {roster.cadence.replace(/_/g, ' ')} · {gradebook.teacherName}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {avg != null && <Badge tone="neutral">class average {avg}</Badge>}
            {missingCount > 0 && (
              <Badge tone="urgent">{missingCount} missing</Badge>
            )}
            {!canEdit && <Badge tone="watch">read only</Badge>}
          </span>
        </div>

        {/*
          The point of the page: two different source systems, edited from one
          place. The chip on each tab names which system the tab writes to.
        */}
        <div className="mb-4 flex items-center gap-1 border-b border-line">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/section/${id}?tab=${t.key}`}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
                tab === t.key
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
              <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                {t.source}
              </span>
            </Link>
          ))}
        </div>

        {tab === 'gradebook' ? (
          <Tile
            title="Gradebook"
            subtitle="Scores write straight back to the learning platform"
            source="LMS"
          >
            <GradebookGrid gradebook={gradebook} canEdit={canEdit} />
          </Tile>
        ) : (
          <Tile
            title="Roster & enrolment"
            subtitle="Enrolment changes write straight back to enrollment & records"
            source="SIS"
          >
            <RosterPanel roster={roster} canEdit={canEdit} />
          </Tile>
        )}
      </main>
    </>
  )
}
