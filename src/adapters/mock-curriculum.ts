import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'

import type { CurriculumProvider, ResourceItem, UnitProgress } from './types'

const today = () => new Date().toISOString().slice(0, 10)

/** Percent of the planned window that has elapsed — the pacing benchmark. */
function expectedPctFor(plannedStartOn: string, plannedEndOn: string): number {
  const start = new Date(plannedStartOn).getTime()
  const end = new Date(plannedEndOn).getTime()
  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

export const mockCurriculum: CurriculumProvider = {
  key: 'curriculum',

  async getPacingForTeacher(teacherUserId): Promise<UnitProgress[]> {
    const now = today()
    const rows = await db
      .select({
        sectionId: s.pacing.sectionId,
        sectionName: s.sections.name,
        unitTitle: s.units.title,
        plannedStartOn: s.pacing.plannedStartOn,
        plannedEndOn: s.pacing.plannedEndOn,
        actualPct: s.pacing.actualPct,
      })
      .from(s.pacing)
      .innerJoin(s.sections, eq(s.sections.id, s.pacing.sectionId))
      .innerJoin(s.units, eq(s.units.id, s.pacing.unitId))
      .where(
        and(
          eq(s.sections.teacherUserId, teacherUserId),
          lte(s.pacing.plannedStartOn, now),
          gte(s.pacing.plannedEndOn, now),
        ),
      )
      .orderBy(asc(s.sections.name))

    return rows.map((r) => ({
      ...r,
      expectedPct: expectedPctFor(r.plannedStartOn, r.plannedEndOn),
    }))
  },

  async getPacingAcrossProgram(limit): Promise<UnitProgress[]> {
    const now = today()
    const rows = await db
      .select({
        sectionId: s.pacing.sectionId,
        sectionName: s.sections.name,
        unitTitle: s.units.title,
        plannedStartOn: s.pacing.plannedStartOn,
        plannedEndOn: s.pacing.plannedEndOn,
        actualPct: s.pacing.actualPct,
      })
      .from(s.pacing)
      .innerJoin(s.sections, eq(s.sections.id, s.pacing.sectionId))
      .innerJoin(s.units, eq(s.units.id, s.pacing.unitId))
      .where(
        and(lte(s.pacing.plannedStartOn, now), gte(s.pacing.plannedEndOn, now)),
      )
      .orderBy(asc(s.pacing.actualPct))
      .limit(limit)

    return rows.map((r) => ({
      ...r,
      expectedPct: expectedPctFor(r.plannedStartOn, r.plannedEndOn),
    }))
  },

  async getCurrentMaterials(learnerId) {
    const now = today()
    const rows = await db
      .select({
        courseTitle: s.courses.title,
        unitTitle: s.units.title,
        lessonTitle: s.lessons.title,
      })
      .from(s.enrollments)
      .innerJoin(s.sections, eq(s.sections.id, s.enrollments.sectionId))
      .innerJoin(s.courses, eq(s.courses.id, s.sections.courseId))
      .innerJoin(s.pacing, eq(s.pacing.sectionId, s.sections.id))
      .innerJoin(s.units, eq(s.units.id, s.pacing.unitId))
      .innerJoin(s.lessons, eq(s.lessons.unitId, s.units.id))
      .where(
        and(
          eq(s.enrollments.learnerId, learnerId),
          lte(s.pacing.plannedStartOn, now),
          gte(s.pacing.plannedEndOn, now),
        ),
      )
      .orderBy(asc(s.courses.title), asc(s.lessons.sequence))

    const grouped = new Map<string, { courseTitle: string; unitTitle: string; lessons: string[] }>()
    for (const r of rows) {
      const key = `${r.courseTitle}::${r.unitTitle}`
      const entry = grouped.get(key) ?? {
        courseTitle: r.courseTitle,
        unitTitle: r.unitTitle,
        lessons: [],
      }
      if (entry.lessons.length < 4) entry.lessons.push(r.lessonTitle)
      grouped.set(key, entry)
    }
    return [...grouped.values()]
  },

  async listResourcesFor(subject, limit): Promise<ResourceItem[]> {
    const rows = await db
      .select({
        id: s.resources.id,
        title: s.resources.title,
        kind: s.resources.kind,
        subject: s.resources.subject,
        license: s.resources.license,
        standardCode: s.standards.code,
      })
      .from(s.resources)
      .leftJoin(s.standards, eq(s.standards.id, s.resources.standardId))
      .where(subject ? eq(s.resources.subject, subject) : sql`true`)
      .limit(limit)

    return rows.map((r) => ({ ...r, standardCode: r.standardCode ?? null }))
  },
}
