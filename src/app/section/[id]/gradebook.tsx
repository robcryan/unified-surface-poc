'use client'

import { useState, useTransition } from 'react'

import { addAssignment, saveScore } from '@/app/section/actions'
import { Badge, cn, formatDay } from '@/components/ui'
import type { Gradebook } from '@/adapters/types'

const STATUS_TONE = {
  graded: 'neutral',
  submitted: 'neutral',
  late: 'watch',
  missing: 'urgent',
  not_started: 'neutral',
} as const

function gradeTone(g: number | null) {
  if (g == null) return 'text-ink-faint'
  if (g >= 80) return 'text-good'
  if (g >= 60) return 'text-watch'
  return 'text-urgent'
}

export function GradebookGrid({
  gradebook,
  canEdit,
}: {
  gradebook: Gradebook
  canEdit: boolean
}) {
  // Local score state keyed learnerId:assignmentId, so edits feel immediate
  // while the server recomputes the course grade.
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const row of gradebook.rows) {
      for (const cell of row.cells) {
        init[`${row.learnerId}:${cell.assignmentId}`] =
          cell.score == null ? '' : String(Math.round(cell.score))
      }
    }
    return init
  })
  const [grades, setGrades] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(gradebook.rows.map((r) => [r.learnerId, r.currentGrade])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()

  async function commit(learnerId: string, assignmentId: string, raw: string) {
    const key = `${learnerId}:${assignmentId}`
    const trimmed = raw.trim()
    const score = trimmed === '' ? null : Number(trimmed)

    if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
      setError('Score must be a number between 0 and 100.')
      return
    }
    setError(null)
    setSaving(key)
    const result = await saveScore(gradebook.sectionId, assignmentId, learnerId, score)
    setSaving(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setGrades((g) => ({ ...g, [learnerId]: result.currentGrade }))
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-ink-muted">
          {gradebook.rows.length} enrolled · {gradebook.assignments.length}{' '}
          assignments
          {canEdit ? ' · type a score and tab away to save' : ' · read only'}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] font-medium text-ink hover:border-accent"
          >
            + Add assignment
          </button>
        )}
      </div>

      {adding && canEdit && (
        <form
          action={(fd) => {
            startTransition(async () => {
              await addAssignment(gradebook.sectionId, fd)
              setAdding(false)
            })
          }}
          className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-panel-muted p-3"
        >
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-[11px] font-medium text-ink">Title</span>
            <input
              name="title"
              required
              placeholder="Unit 5 Quiz"
              className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium text-ink">Due</span>
            <input
              name="dueOn"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium text-ink">Type</span>
            <select
              name="kind"
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent"
            >
              {['assignment', 'quiz', 'discussion', 'project', 'exam'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
          >
            Create
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-urgent-soft px-3 py-2 text-[12px] text-urgent">
          {error}
        </p>
      )}

      <div className="scroll-x rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-panel-muted">
              <th className="sticky left-0 z-10 min-w-[190px] bg-panel-muted px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Learner
              </th>
              <th className="min-w-[70px] px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Grade
              </th>
              {gradebook.assignments.map((a) => (
                <th
                  key={a.id}
                  className="min-w-[92px] px-2 py-2 align-bottom text-[11px] font-medium text-ink-faint"
                >
                  <span className="block truncate font-semibold text-ink" title={a.title}>
                    {a.title}
                  </span>
                  <span className="block whitespace-nowrap">{formatDay(a.dueOn)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {gradebook.rows.map((row) => (
              <tr key={row.learnerId} className="hover:bg-panel-muted/60">
                <td className="sticky left-0 z-10 bg-panel px-3 py-1.5">
                  <span className="block truncate font-medium text-ink">
                    {row.learnerName}
                  </span>
                  <span className="block text-[11px] text-ink-faint">
                    grade {row.gradeLevel}
                  </span>
                </td>
                <td
                  className={cn(
                    'tnum px-2 py-1.5 text-right font-semibold',
                    gradeTone(grades[row.learnerId]),
                  )}
                >
                  {grades[row.learnerId] == null
                    ? '—'
                    : Math.round(grades[row.learnerId]!)}
                </td>
                {row.cells.map((cell) => {
                  const key = `${row.learnerId}:${cell.assignmentId}`
                  const isMissing =
                    cell.status === 'missing' && (scores[key] ?? '') === ''
                  return (
                    <td key={cell.assignmentId} className="px-1.5 py-1.5">
                      {canEdit ? (
                        <input
                          aria-label={`Score for ${row.learnerName}`}
                          inputMode="numeric"
                          value={scores[key] ?? ''}
                          disabled={saving === key}
                          onChange={(e) =>
                            setScores((s) => ({ ...s, [key]: e.target.value }))
                          }
                          onBlur={(e) =>
                            commit(row.learnerId, cell.assignmentId, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          className={cn(
                            'tnum w-full rounded-md border px-1.5 py-1 text-center outline-none transition-colors',
                            saving === key && 'opacity-50',
                            isMissing
                              ? 'border-urgent/40 bg-urgent-soft text-urgent placeholder:text-urgent/60'
                              : 'border-line bg-panel text-ink focus:border-accent',
                          )}
                          placeholder={isMissing ? 'miss' : '—'}
                        />
                      ) : (
                        <span className="tnum block text-center text-ink">
                          {cell.score == null ? (
                            <Badge tone={STATUS_TONE[cell.status]}>
                              {cell.status === 'missing' ? 'missing' : '—'}
                            </Badge>
                          ) : (
                            Math.round(cell.score)
                          )}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
