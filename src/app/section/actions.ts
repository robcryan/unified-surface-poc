'use server'

import { revalidatePath } from 'next/cache'

import { adapters } from '@/adapters'
import { requireUser } from '@/data/auth'
import { assertCanEditSection } from '@/data/scope'

/**
 * Writes back to the two source systems from one surface.
 *
 * Every one of these authorises through the same data access layer the reads
 * use, then delegates to the adapter — so a real LMS or SIS connector would
 * slot in with no change here.
 */

export async function saveScore(
  sectionId: string,
  assignmentId: string,
  learnerId: string,
  score: number | null,
): Promise<{ currentGrade: number | null; error?: string }> {
  const user = await requireUser()
  await assertCanEditSection(user, sectionId)

  if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) {
    return { currentGrade: null, error: 'Score must be between 0 and 100.' }
  }

  const result = await adapters.lms.setScore(
    sectionId,
    assignmentId,
    learnerId,
    score,
  )
  revalidatePath(`/section/${sectionId}`)
  revalidatePath('/')
  return result
}

export async function enrolLearner(sectionId: string, learnerId: string) {
  const user = await requireUser()
  await assertCanEditSection(user, sectionId)
  await adapters.sis.enrolLearner(sectionId, learnerId)
  revalidatePath(`/section/${sectionId}`)
  revalidatePath('/')
}

export async function withdrawEnrolment(
  sectionId: string,
  enrollmentId: string,
) {
  const user = await requireUser()
  await assertCanEditSection(user, sectionId)
  await adapters.sis.withdrawEnrolment(enrollmentId)
  revalidatePath(`/section/${sectionId}`)
  revalidatePath('/')
}

export async function searchEnrollable(sectionId: string, query: string) {
  const user = await requireUser()
  await assertCanEditSection(user, sectionId)
  const results = await adapters.sis.searchEnrollableLearners(sectionId, query, 8)
  return results.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    gradeLevel: r.gradeLevel,
    stateId: r.stateId,
  }))
}

export async function addAssignment(sectionId: string, formData: FormData) {
  const user = await requireUser()
  await assertCanEditSection(user, sectionId)

  const title = String(formData.get('title') ?? '').trim()
  const dueOn = String(formData.get('dueOn') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'assignment')
  if (!title || !dueOn) return

  await adapters.lms.createAssignment(sectionId, {
    title,
    dueOn,
    points: 100,
    kind,
  })
  revalidatePath(`/section/${sectionId}`)
}
