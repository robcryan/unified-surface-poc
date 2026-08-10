import 'server-only'

import { cache } from 'react'
import { forbidden } from 'next/navigation'

import { adapters } from '@/adapters'
import { db } from '@/db/client'
import * as s from '@/db/schema'

import type { CurrentUser } from './auth'

/**
 * Who may see which learners.
 *
 * This is the single choke point for learner-record access. Nothing above this
 * layer decides scope, so there is one place to audit rather than a check
 * scattered across every widget.
 *
 *   student        → only themselves
 *   guardian       → only learners they are recorded as guardian for
 *   teacher        → only learners actively enrolled in a section they teach
 *   counselor      → only learners on their assigned caseload
 *   administrator  → all learners in the program
 */
export const getScopedLearnerIds = cache(
  async (user: CurrentUser): Promise<string[]> => {
    switch (user.role) {
      case 'student':
        return user.learnerId ? [user.learnerId] : []
      case 'guardian':
        return adapters.sis.listLearnerIdsByGuardian(user.id)
      case 'teacher':
        return adapters.sis.listLearnerIdsByTeacher(user.id)
      case 'counselor':
        return adapters.sis.listLearnerIdsByCounselor(user.id)
      case 'administrator':
        return adapters.sis.listAllLearnerIds()
      default:
        return []
    }
  },
)

/**
 * Records an access to an individual learner's records, shaped after the
 * disclosure record contemplated by FERPA § 99.32.
 *
 * Written for detail-level reads — opening a learner's record — rather than
 * for aggregate or roster views, which is the distinction the regulation
 * actually cares about. Denials are recorded too: an attempt to reach outside
 * scope is exactly what an audit wants to see.
 */
async function recordAccess(opts: {
  user: CurrentUser
  learnerId: string
  purpose: string
  granted: boolean
}) {
  await db.insert(s.accessLog).values({
    id: crypto.randomUUID(),
    actorUserId: opts.user.id,
    actorRole: opts.user.role,
    subjectLearnerId: opts.learnerId,
    purpose: opts.purpose,
    granted: opts.granted,
  })
}

/**
 * Gate a detail-level read of one learner. Throws Next's `forbidden()` on a
 * scope violation, which renders the 403 boundary rather than leaking whether
 * the learner exists.
 */
export async function assertCanViewLearner(
  user: CurrentUser,
  learnerId: string,
  purpose: string,
): Promise<void> {
  const scoped = await getScopedLearnerIds(user)
  const granted = scoped.includes(learnerId)
  await recordAccess({ user, learnerId, purpose, granted })
  if (!granted) forbidden()
}

/**
 * Section-level authorization.
 *
 * Viewing a section is allowed for any staff role; changing it — grading,
 * enrolling, withdrawing — is limited to the teacher of record and
 * administrators. Families and learners never reach either.
 */
export async function getSectionAccess(
  user: CurrentUser,
  sectionId: string,
): Promise<{ canView: boolean; canEdit: boolean }> {
  if (user.role === 'student' || user.role === 'guardian') {
    return { canView: false, canEdit: false }
  }
  if (user.role === 'administrator') return { canView: true, canEdit: true }

  const { eq } = await import('drizzle-orm')
  const [section] = await db
    .select({ teacherUserId: s.sections.teacherUserId })
    .from(s.sections)
    .where(eq(s.sections.id, sectionId))
    .limit(1)
  if (!section) return { canView: false, canEdit: false }

  const owns = section.teacherUserId === user.id
  // A specialist can read a section to understand a learner's context, but
  // cannot change the gradebook or the roster.
  return { canView: owns || user.role === 'counselor', canEdit: owns }
}

export async function assertCanViewSection(
  user: CurrentUser,
  sectionId: string,
): Promise<{ canEdit: boolean }> {
  const { canView, canEdit } = await getSectionAccess(user, sectionId)
  if (!canView) forbidden()
  return { canEdit }
}

export async function assertCanEditSection(
  user: CurrentUser,
  sectionId: string,
): Promise<void> {
  const { canEdit } = await getSectionAccess(user, sectionId)
  if (!canEdit) forbidden()
}

/** Recent access history for one learner — surfaced on the detail view. */
export async function getAccessHistory(learnerId: string, limit = 8) {
  const { desc, eq } = await import('drizzle-orm')
  return db
    .select({
      at: s.accessLog.at,
      actorRole: s.accessLog.actorRole,
      purpose: s.accessLog.purpose,
      granted: s.accessLog.granted,
      actorGiven: s.users.givenName,
      actorFamily: s.users.familyName,
    })
    .from(s.accessLog)
    .innerJoin(s.users, eq(s.users.id, s.accessLog.actorUserId))
    .where(eq(s.accessLog.subjectLearnerId, learnerId))
    .orderBy(desc(s.accessLog.at))
    .limit(limit)
}
