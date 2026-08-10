import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'

import type {
  Gradebook,
  GradebookHealth,
  LmsProvider,
  SectionProgress,
  SectionSummary,
  WorkItem,
} from './types'

const today = () => new Date().toISOString().slice(0, 10)

export const mockLms: LmsProvider = {
  key: 'lms',

  async listSectionsForTeacher(teacherUserId): Promise<SectionSummary[]> {
    const rows = await db
      .select({
        id: s.sections.id,
        name: s.sections.name,
        cadence: s.sections.cadence,
        courseTitle: s.courses.title,
        subject: s.courses.subject,
        enrolledCount: sql<number>`count(${s.enrollments.id})`,
      })
      .from(s.sections)
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .leftJoin(s.enrollments, eq(s.enrollments.sectionId, s.sections.id))
      .where(eq(s.sections.teacherUserId, teacherUserId))
      .groupBy(s.sections.id, s.sections.name, s.sections.cadence, s.courses.title, s.courses.subject)
      .orderBy(asc(s.courses.title), asc(s.sections.name))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      courseTitle: r.courseTitle,
      subject: r.subject,
      cadence: r.cadence,
      enrolledCount: Number(r.enrolledCount),
    }))
  },

  async listSectionProgress(learnerId): Promise<SectionProgress[]> {
    const rows = await db
      .select({
        sectionId: s.courseProgress.sectionId,
        sectionName: s.sections.name,
        courseTitle: s.courses.title,
        subject: s.courses.subject,
        teacherGiven: s.users.givenName,
        teacherFamily: s.users.familyName,
        lessonsComplete: s.courseProgress.lessonsComplete,
        lessonsTotal: s.courseProgress.lessonsTotal,
        expectedPct: s.courseProgress.expectedPct,
        actualPct: s.courseProgress.actualPct,
        currentGrade: s.courseProgress.currentGrade,
      })
      .from(s.courseProgress)
      .innerJoin(s.sections, eq(s.sections.id, s.courseProgress.sectionId))
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .innerJoin(s.users, eq(s.users.id, s.sections.teacherUserId))
      .where(eq(s.courseProgress.learnerId, learnerId))
      .orderBy(asc(s.courses.title))

    return rows.map((r) => ({
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      courseTitle: r.courseTitle,
      subject: r.subject,
      teacherName: `${r.teacherGiven} ${r.teacherFamily}`,
      lessonsComplete: r.lessonsComplete,
      lessonsTotal: r.lessonsTotal,
      expectedPct: r.expectedPct,
      actualPct: r.actualPct,
      currentGrade: r.currentGrade,
    }))
  },

  async listWork(learnerId, limit): Promise<WorkItem[]> {
    const rows = await db
      .select({
        id: s.assignments.id,
        title: s.assignments.title,
        dueOn: s.assignments.dueOn,
        kind: s.assignments.kind,
        courseTitle: s.courses.title,
        status: s.submissions.status,
        score: s.submissions.score,
      })
      .from(s.enrollments)
      .innerJoin(s.assignments, eq(s.assignments.sectionId, s.enrollments.sectionId))
      .innerJoin(s.sections, eq(s.sections.id, s.enrollments.sectionId))
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .leftJoin(
        s.submissions,
        and(
          eq(s.submissions.assignmentId, s.assignments.id),
          eq(s.submissions.learnerId, learnerId),
        ),
      )
      .where(eq(s.enrollments.learnerId, learnerId))
      .orderBy(asc(s.assignments.dueOn))

    const now = today()
    const shaped: WorkItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      courseTitle: r.courseTitle,
      dueOn: r.dueOn,
      kind: r.kind,
      status: r.status ?? (r.dueOn > now ? 'upcoming' : 'not_started'),
      score: r.score,
    }))

    // Anything missing first, then what is coming up next.
    const missing = shaped.filter((w) => w.status === 'missing')
    const upcoming = shaped.filter((w) => w.status === 'upcoming')
    const rest = shaped.filter((w) => w.status !== 'missing' && w.status !== 'upcoming').reverse()
    return [...missing, ...upcoming, ...rest].slice(0, limit)
  },

  async getGradebookHealth(teacherUserId): Promise<GradebookHealth[]> {
    const sections = await db
      .select({ id: s.sections.id, name: s.sections.name, courseTitle: s.courses.title })
      .from(s.sections)
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .where(eq(s.sections.teacherUserId, teacherUserId))
      .orderBy(asc(s.courses.title))

    if (!sections.length) return []
    const sectionIds = sections.map((x) => x.id)

    const progress = await db
      .select({
        sectionId: s.courseProgress.sectionId,
        learners: sql<number>`count(*)`,
        avgGrade: sql<number>`avg(${s.courseProgress.currentGrade})`,
        belowPassing: sql<number>`count(*) filter (where ${s.courseProgress.currentGrade} < 60)`,
      })
      .from(s.courseProgress)
      .where(inArray(s.courseProgress.sectionId, sectionIds))
      .groupBy(s.courseProgress.sectionId)

    const missing = await db
      .select({
        sectionId: s.assignments.sectionId,
        missingCount: sql<number>`count(*)`,
      })
      .from(s.submissions)
      .innerJoin(s.assignments, eq(s.assignments.id, s.submissions.assignmentId))
      .where(
        and(
          inArray(s.assignments.sectionId, sectionIds),
          eq(s.submissions.status, 'missing'),
        ),
      )
      .groupBy(s.assignments.sectionId)

    const progressBy = new Map(progress.map((p) => [p.sectionId, p]))
    const missingBy = new Map(missing.map((m) => [m.sectionId, Number(m.missingCount)]))

    return sections.map((sec) => {
      const p = progressBy.get(sec.id)
      return {
        sectionId: sec.id,
        sectionName: sec.name,
        courseTitle: sec.courseTitle,
        learners: p ? Number(p.learners) : 0,
        avgGrade: p ? Math.round(Number(p.avgGrade) * 10) / 10 : 0,
        missingCount: missingBy.get(sec.id) ?? 0,
        belowPassing: p ? Number(p.belowPassing) : 0,
      }
    })
  },

  async countMissingWork(learnerIds) {
    const out = new Map<string, number>()
    if (!learnerIds.length) return out
    const rows = await db
      .select({
        learnerId: s.submissions.learnerId,
        missing: sql<number>`count(*)`,
      })
      .from(s.submissions)
      .where(
        and(
          inArray(s.submissions.learnerId, learnerIds),
          eq(s.submissions.status, 'missing'),
        ),
      )
      .groupBy(s.submissions.learnerId)
    for (const r of rows) out.set(r.learnerId, Number(r.missing))
    return out
  },

  // ── Writes ────────────────────────────────────────────────────────────────

  async getGradebook(sectionId): Promise<Gradebook | null> {
    const [section] = await db
      .select({
        id: s.sections.id,
        name: s.sections.name,
        courseTitle: s.courses.title,
        given: s.users.givenName,
        family: s.users.familyName,
      })
      .from(s.sections)
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .innerJoin(s.users, eq(s.users.id, s.sections.teacherUserId))
      .where(eq(s.sections.id, sectionId))
      .limit(1)
    if (!section) return null

    const assignments = await db
      .select()
      .from(s.assignments)
      .where(eq(s.assignments.sectionId, sectionId))
      .orderBy(asc(s.assignments.dueOn))

    const enrolled = await db
      .select({
        learnerId: s.learners.id,
        given: s.users.givenName,
        family: s.users.familyName,
        gradeLevel: s.learners.gradeLevel,
      })
      .from(s.enrollments)
      .innerJoin(s.learners, eq(s.learners.id, s.enrollments.learnerId))
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(
        and(
          eq(s.enrollments.sectionId, sectionId),
          eq(s.enrollments.status, 'active'),
        ),
      )
      .orderBy(asc(s.users.familyName), asc(s.users.givenName))

    const learnerIds = enrolled.map((e) => e.learnerId)
    const assignmentIds = assignments.map((a) => a.id)

    const subs =
      learnerIds.length && assignmentIds.length
        ? await db
            .select()
            .from(s.submissions)
            .where(
              and(
                inArray(s.submissions.learnerId, learnerIds),
                inArray(s.submissions.assignmentId, assignmentIds),
              ),
            )
        : []

    const grades =
      learnerIds.length
        ? await db
            .select({
              learnerId: s.courseProgress.learnerId,
              currentGrade: s.courseProgress.currentGrade,
            })
            .from(s.courseProgress)
            .where(
              and(
                eq(s.courseProgress.sectionId, sectionId),
                inArray(s.courseProgress.learnerId, learnerIds),
              ),
            )
        : []
    const gradeBy = new Map(grades.map((g) => [g.learnerId, g.currentGrade]))

    const subBy = new Map(subs.map((x) => [`${x.learnerId}:${x.assignmentId}`, x]))

    return {
      sectionId: section.id,
      sectionName: section.name,
      courseTitle: section.courseTitle,
      teacherName: `${section.given} ${section.family}`,
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueOn: a.dueOn,
        points: a.points,
        kind: a.kind,
      })),
      rows: enrolled.map((e) => ({
        learnerId: e.learnerId,
        learnerName: `${e.given} ${e.family}`,
        gradeLevel: e.gradeLevel,
        currentGrade: gradeBy.get(e.learnerId) ?? null,
        cells: assignments.map((a) => {
          const sub = subBy.get(`${e.learnerId}:${a.id}`)
          return {
            assignmentId: a.id,
            submissionId: sub?.id ?? null,
            // Missing work carries a stored 0 so it drags the average, but the
            // cell must not render as a genuine zero — a teacher has to be able
            // to see at a glance which work never arrived.
            score: sub?.status === 'missing' ? null : (sub?.score ?? null),
            status: sub?.status ?? 'not_started',
          }
        }),
      })),
    }
  },

  async setScore(sectionId, assignmentId, learnerId, score) {
    const [existing] = await db
      .select()
      .from(s.submissions)
      .where(
        and(
          eq(s.submissions.assignmentId, assignmentId),
          eq(s.submissions.learnerId, learnerId),
        ),
      )
      .limit(1)

    const status = score === null ? 'missing' : 'graded'
    const submittedAt = score === null ? null : (existing?.submittedAt ?? new Date())

    if (existing) {
      await db
        .update(s.submissions)
        .set({ score, status, submittedAt })
        .where(eq(s.submissions.id, existing.id))
    } else {
      await db.insert(s.submissions).values({
        id: crypto.randomUUID(),
        assignmentId,
        learnerId,
        score,
        status,
        submittedAt,
      })
    }

    // Recompute the course grade from scored work only, so the knock-on effect
    // is visible everywhere the grade is surfaced.
    const [agg] = await db
      .select({ avg: sql<number | null>`avg(${s.submissions.score})` })
      .from(s.submissions)
      .innerJoin(s.assignments, eq(s.assignments.id, s.submissions.assignmentId))
      .where(
        and(
          eq(s.assignments.sectionId, sectionId),
          eq(s.submissions.learnerId, learnerId),
          sql`${s.submissions.status} in ('graded','late')`,
        ),
      )

    const currentGrade =
      agg?.avg == null ? null : Math.round(Number(agg.avg) * 10) / 10

    await db
      .update(s.courseProgress)
      .set({ currentGrade })
      .where(
        and(
          eq(s.courseProgress.sectionId, sectionId),
          eq(s.courseProgress.learnerId, learnerId),
        ),
      )

    return { currentGrade }
  },

  async createAssignment(sectionId, input) {
    const id = crypto.randomUUID()
    await db.insert(s.assignments).values({
      id,
      sectionId,
      unitId: null,
      title: input.title,
      dueOn: input.dueOn,
      points: input.points,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kind: input.kind as any,
    })
    return id
  },
}
