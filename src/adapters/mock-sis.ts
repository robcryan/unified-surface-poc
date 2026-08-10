import { and, asc, desc, eq, gte, inArray, notInArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'

import type { EngagementDay, LearnerRecord, SisProvider } from './types'

function toLearnerRecord(row: {
  learner: typeof s.learners.$inferSelect
  user: typeof s.users.$inferSelect
}): LearnerRecord {
  return {
    id: row.learner.id,
    userId: row.user.id,
    givenName: row.user.givenName,
    familyName: row.user.familyName,
    fullName: `${row.user.givenName} ${row.user.familyName}`,
    gradeLevel: row.learner.gradeLevel,
    stateId: row.learner.stateId,
    pathway: row.learner.pathway,
    orgId: row.learner.orgId,
    counselorUserId: row.learner.counselorUserId,
  }
}

export const mockSis: SisProvider = {
  key: 'sis',

  async getLearner(learnerId) {
    const rows = await db
      .select({ learner: s.learners, user: s.users })
      .from(s.learners)
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(eq(s.learners.id, learnerId))
      .limit(1)
    return rows.length ? toLearnerRecord(rows[0]) : null
  },

  async listLearners(learnerIds) {
    if (!learnerIds.length) return []
    const rows = await db
      .select({ learner: s.learners, user: s.users })
      .from(s.learners)
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(inArray(s.learners.id, learnerIds))
      .orderBy(asc(s.users.familyName), asc(s.users.givenName))
    return rows.map(toLearnerRecord)
  },

  async listLearnerIdsByCounselor(counselorUserId) {
    const rows = await db
      .select({ id: s.learners.id })
      .from(s.learners)
      .where(eq(s.learners.counselorUserId, counselorUserId))
    return rows.map((r) => r.id)
  },

  async listLearnerIdsByTeacher(teacherUserId) {
    const rows = await db
      .selectDistinct({ id: s.enrollments.learnerId })
      .from(s.enrollments)
      .innerJoin(s.sections, eq(s.sections.id, s.enrollments.sectionId))
      .where(
        and(
          eq(s.sections.teacherUserId, teacherUserId),
          eq(s.enrollments.status, 'active'),
        ),
      )
    return rows.map((r) => r.id)
  },

  async listLearnerIdsByGuardian(guardianUserId) {
    const rows = await db
      .select({ id: s.guardianships.learnerId })
      .from(s.guardianships)
      .where(eq(s.guardianships.guardianUserId, guardianUserId))
    return rows.map((r) => r.id)
  },

  async listAllLearnerIds() {
    const rows = await db.select({ id: s.learners.id }).from(s.learners)
    return rows.map((r) => r.id)
  },

  async getLearnerIdForUser(userId) {
    const rows = await db
      .select({ id: s.learners.id })
      .from(s.learners)
      .where(eq(s.learners.userId, userId))
      .limit(1)
    return rows.length ? rows[0].id : null
  },

  async getEngagementWindow(learnerId, days): Promise<EngagementDay[]> {
    const rows = await db
      .select()
      .from(s.dailyEngagement)
      .where(eq(s.dailyEngagement.learnerId, learnerId))
      .orderBy(desc(s.dailyEngagement.day))
      .limit(days)
    return rows.reverse().map((r) => ({
      day: r.day,
      loggedIn: r.loggedIn,
      activeMinutes: r.activeMinutes,
      lessonsTouched: r.lessonsTouched,
      liveSessionsScheduled: r.liveSessionsScheduled,
      liveSessionsAttended: r.liveSessionsAttended,
    }))
  },

  async getProgramEngagementTrend(learnerIds, weeks) {
    if (!learnerIds.length) return []
    const since = new Date()
    since.setDate(since.getDate() - weeks * 7)

    const rows = await db
      .select({
        weekOf: sql<string>`to_char(date_trunc('week', ${s.dailyEngagement.day}), 'YYYY-MM-DD')`,
        loginRate: sql<number>`avg(case when ${s.dailyEngagement.loggedIn} then 1.0 else 0.0 end)`,
        scheduled: sql<number>`sum(${s.dailyEngagement.liveSessionsScheduled})`,
        attended: sql<number>`sum(${s.dailyEngagement.liveSessionsAttended})`,
      })
      .from(s.dailyEngagement)
      .where(
        and(
          inArray(s.dailyEngagement.learnerId, learnerIds),
          gte(s.dailyEngagement.day, since.toISOString().slice(0, 10)),
        ),
      )
      .groupBy(sql`date_trunc('week', ${s.dailyEngagement.day})`)
      .orderBy(sql`date_trunc('week', ${s.dailyEngagement.day})`)

    return rows.map((r) => ({
      weekOf: r.weekOf,
      loginRate: Math.round(Number(r.loginRate) * 100),
      liveAttendanceRate: Number(r.scheduled)
        ? Math.round((Number(r.attended) / Number(r.scheduled)) * 100)
        : 0,
    }))
  },

  async listSectionsForUser(userId, role) {
    const base = db
      .select({
        id: s.sections.id,
        course: s.courses.title,
        name: s.sections.name,
      })
      .from(s.sections)
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))

    const rows =
      role === 'teacher'
        ? await base
            .where(eq(s.sections.teacherUserId, userId))
            .orderBy(asc(s.courses.title))
        : await base.orderBy(asc(s.courses.title))

    return rows.map((r) => ({ id: r.id, label: r.name }))
  },

  // ── Writes ────────────────────────────────────────────────────────────────

  async getSectionRoster(sectionId) {
    const [section] = await db
      .select({
        id: s.sections.id,
        name: s.sections.name,
        cadence: s.sections.cadence,
        courseTitle: s.courses.title,
        termName: s.terms.name,
      })
      .from(s.sections)
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .innerJoin(s.terms, eq(s.terms.id, s.sections.termId))
      .where(eq(s.sections.id, sectionId))
      .limit(1)
    if (!section) return null

    const entries = await db
      .select({
        enrollmentId: s.enrollments.id,
        learnerId: s.learners.id,
        given: s.users.givenName,
        family: s.users.familyName,
        gradeLevel: s.learners.gradeLevel,
        stateId: s.learners.stateId,
        startedOn: s.enrollments.startedOn,
        status: s.enrollments.status,
      })
      .from(s.enrollments)
      .innerJoin(s.learners, eq(s.learners.id, s.enrollments.learnerId))
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(eq(s.enrollments.sectionId, sectionId))
      .orderBy(asc(s.users.familyName), asc(s.users.givenName))

    return {
      sectionId: section.id,
      sectionName: section.name,
      courseTitle: section.courseTitle,
      termName: section.termName,
      cadence: section.cadence,
      entries: entries.map((e) => ({
        enrollmentId: e.enrollmentId,
        learnerId: e.learnerId,
        learnerName: `${e.given} ${e.family}`,
        gradeLevel: e.gradeLevel,
        stateId: e.stateId,
        startedOn: e.startedOn,
        status: e.status,
      })),
    }
  },

  async searchEnrollableLearners(sectionId, query, limit) {
    const active = await db
      .select({ learnerId: s.enrollments.learnerId })
      .from(s.enrollments)
      .where(
        and(
          eq(s.enrollments.sectionId, sectionId),
          eq(s.enrollments.status, 'active'),
        ),
      )
    const excluded = active.map((a) => a.learnerId)

    const term = `%${query.trim()}%`
    const rows = await db
      .select({ learner: s.learners, user: s.users })
      .from(s.learners)
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(
        and(
          excluded.length ? notInArray(s.learners.id, excluded) : sql`true`,
          query.trim()
            ? sql`(${s.users.givenName} ilike ${term} or ${s.users.familyName} ilike ${term} or ${s.learners.stateId} ilike ${term})`
            : sql`true`,
        ),
      )
      .orderBy(asc(s.users.familyName), asc(s.users.givenName))
      .limit(limit)

    return rows.map(toLearnerRecord)
  },

  async enrolLearner(sectionId, learnerId) {
    const [existing] = await db
      .select()
      .from(s.enrollments)
      .where(
        and(
          eq(s.enrollments.sectionId, sectionId),
          eq(s.enrollments.learnerId, learnerId),
        ),
      )
      .limit(1)

    if (existing) {
      // Re-enrolling a withdrawn learner reactivates the existing record
      // rather than creating a duplicate enrolment.
      await db
        .update(s.enrollments)
        .set({ status: 'active' })
        .where(eq(s.enrollments.id, existing.id))
    } else {
      await db.insert(s.enrollments).values({
        id: crypto.randomUUID(),
        sectionId,
        learnerId,
        startedOn: new Date().toISOString().slice(0, 10),
        status: 'active',
      })
    }

    // Give the learner a progress row so they appear in pace and grade views.
    const [hasProgress] = await db
      .select({ id: s.courseProgress.id })
      .from(s.courseProgress)
      .where(
        and(
          eq(s.courseProgress.sectionId, sectionId),
          eq(s.courseProgress.learnerId, learnerId),
        ),
      )
      .limit(1)

    if (!hasProgress) {
      const [peer] = await db
        .select({
          expectedPct: s.courseProgress.expectedPct,
          lessonsTotal: s.courseProgress.lessonsTotal,
        })
        .from(s.courseProgress)
        .where(eq(s.courseProgress.sectionId, sectionId))
        .limit(1)

      await db.insert(s.courseProgress).values({
        id: crypto.randomUUID(),
        learnerId,
        sectionId,
        lessonsTotal: peer?.lessonsTotal ?? 20,
        lessonsComplete: 0,
        expectedPct: peer?.expectedPct ?? 0,
        actualPct: 0,
        currentGrade: null,
        asOf: new Date().toISOString().slice(0, 10),
      })
    }
  },

  async withdrawEnrolment(enrollmentId) {
    await db
      .update(s.enrollments)
      .set({ status: 'withdrawn' })
      .where(eq(s.enrollments.id, enrollmentId))
  },
}
