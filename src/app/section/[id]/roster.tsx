'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import {
  enrolLearner,
  searchEnrollable,
  withdrawEnrolment,
} from '@/app/section/actions'
import { Avatar, Badge, formatDay } from '@/components/ui'
import type { SectionRoster } from '@/adapters/types'

type Candidate = {
  id: string
  fullName: string
  gradeLevel: number
  stateId: string
}

export function RosterPanel({
  roster,
  canEdit,
}: {
  roster: SectionRoster
  canEdit: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const active = roster.entries.filter((e) => e.status === 'active')
  const inactive = roster.entries.filter((e) => e.status !== 'active')

  async function runSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    setResults(await searchEnrollable(roster.sectionId, q))
  }

  function doEnrol(learnerId: string) {
    setBusy(learnerId)
    startTransition(async () => {
      await enrolLearner(roster.sectionId, learnerId)
      setBusy(null)
      setQuery('')
      setResults(null)
      router.refresh()
    })
  }

  function doWithdraw(enrollmentId: string) {
    setBusy(enrollmentId)
    startTransition(async () => {
      await withdrawEnrolment(roster.sectionId, enrollmentId)
      setBusy(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-lg border border-line bg-panel-muted p-3">
          <label htmlFor="enrol-search" className="mb-1 block text-[12px] font-medium text-ink">
            Enrol a learner
          </label>
          <input
            id="enrol-search"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search by name or state ID…"
            className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
          />

          {results && (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-panel">
              {results.length === 0 && (
                <li className="px-3 py-2 text-[12px] text-ink-muted">
                  No learners match “{query}” who are not already enrolled.
                </li>
              )}
              {results.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={c.fullName} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {c.fullName}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      grade {c.gradeLevel} · {c.stateId}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => doEnrol(c.id)}
                    className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === c.id ? 'Enrolling…' : 'Enrol'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
          Enrolled — {active.length}
        </h3>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {active.map((e) => (
            <li key={e.enrollmentId} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar name={e.learnerName} size={26} />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/learner/${e.learnerId}`}
                  className="block truncate text-[12.5px] font-medium text-ink hover:text-accent-text"
                >
                  {e.learnerName}
                </Link>
                <span className="block text-[11px] text-ink-faint">
                  grade {e.gradeLevel} · {e.stateId} · since {formatDay(e.startedOn)}
                </span>
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy === e.enrollmentId}
                  onClick={() => doWithdraw(e.enrollmentId)}
                  className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-muted hover:border-urgent hover:text-urgent disabled:opacity-50"
                >
                  {busy === e.enrollmentId ? 'Withdrawing…' : 'Withdraw'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {inactive.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
            Withdrawn — {inactive.length}
          </h3>
          <p className="mb-2 text-[11.5px] text-ink-muted">
            Withdrawn enrolments are kept rather than deleted; re-enrolling
            reactivates the original record.
          </p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {inactive.map((e) => (
              <li key={e.enrollmentId} className="flex items-center gap-2.5 px-3 py-2">
                <Avatar name={e.learnerName} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {e.learnerName}
                  </span>
                  <span className="block text-[11px] text-ink-faint">
                    grade {e.gradeLevel} · {e.stateId}
                  </span>
                </span>
                <Badge tone="neutral">{e.status}</Badge>
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy === e.learnerId}
                    onClick={() => doEnrol(e.learnerId)}
                    className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-muted hover:border-accent hover:text-accent-text disabled:opacity-50"
                  >
                    {busy === e.learnerId ? 'Re-enrolling…' : 'Re-enrol'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
