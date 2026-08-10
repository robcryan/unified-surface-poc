import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'
import { getSession } from '@/lib/session'

/**
 * The safe, minimal view of the signed-in user. Deliberately a narrow DTO —
 * nothing here is sensitive if it reaches a client component.
 */
export type CurrentUser = {
  id: string
  givenName: string
  familyName: string
  fullName: string
  initials: string
  email: string
  role: s.Role
  title: string | null
  orgId: string | null
  /** Set only when the signed-in user is themselves a learner. */
  learnerId: string | null
}

/**
 * Cached per request, so every widget on a dashboard resolves the same user
 * without re-reading the cookie or re-querying. This is the pattern Next
 * recommends for a data access layer: read it back where you need it rather
 * than threading it through props.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession()
  if (!session.userId) return null

  const rows = await db
    .select()
    .from(s.users)
    .where(eq(s.users.id, session.userId))
    .limit(1)
  if (!rows.length || !rows[0].active) return null
  const u = rows[0]

  let learnerId: string | null = null
  if (u.role === 'student') {
    const l = await db
      .select({ id: s.learners.id })
      .from(s.learners)
      .where(eq(s.learners.userId, u.id))
      .limit(1)
    learnerId = l.length ? l[0].id : null
  }

  return {
    id: u.id,
    givenName: u.givenName,
    familyName: u.familyName,
    fullName: `${u.givenName} ${u.familyName}`,
    initials: `${u.givenName[0] ?? ''}${u.familyName[0] ?? ''}`.toUpperCase(),
    email: u.email,
    role: u.role,
    title: u.title,
    orgId: u.orgId,
    learnerId,
  }
})

/** For pages that must have a user. Redirects rather than rendering empty. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
