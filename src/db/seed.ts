/**
 * Synthetic seed for the unified surface prototype.
 *
 * Everything generated here is fictional. No real learner record is used,
 * copied, or approximated — which is also most of what makes the prototype
 * safe to demo under FERPA.
 *
 * The ordering matters. Engagement, progress and submissions are generated
 * first from behavioural archetypes; the Engagement / Pace / Performance
 * scores are then *derived* from those rows. Nothing about the risk model is
 * assigned independently, so the administrator's aggregate, the counselor's
 * caseload list and the learner's own detail page always reconcile.
 */
import { faker } from '@faker-js/faker'

import { db } from './client'
import {
  ARCHETYPE_MIX,
  COMPOSITE_WEIGHTS,
  DISTRICT_NAME,
  INTEGRATION_SOURCES,
  STORY_LEARNERS,
  type Archetype,
  tierFor,
} from './demo-config'
import * as s from './schema'

// ─────────────────────────────────────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────────────────────────────────────

const SEED = 20260803
faker.seed(SEED)

/** mulberry32 — small, fast, seedable. Keeps re-seeds byte-identical so a
 *  rehearsed demo doesn't change numbers between run-throughs. */
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(SEED)

const rand = (min: number, max: number) => min + rng() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const pick = <T,>(xs: readonly T[]): T => xs[randInt(0, xs.length - 1)]
const chance = (p: number) => rng() < p
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

// ─────────────────────────────────────────────────────────────────────────────
// Dates — everything is relative to the run date so the demo never goes stale
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6

/** The last `n` weekdays, oldest first, ending today (or the prior weekday). */
function weekdaysBack(n: number): Date[] {
  const out: Date[] = []
  let cursor = new Date(TODAY)
  while (out.length < n) {
    if (isWeekday(cursor)) out.unshift(new Date(cursor))
    cursor = addDays(cursor, -1)
  }
  return out
}

/** A year-round virtual term: started 11 weeks ago, runs 4 more weeks. */
const TERM_START = addDays(TODAY, -77)
const TERM_END = addDays(TODAY, 28)
const TERM_TOTAL_DAYS = 105
const TERM_ELAPSED_DAYS = 77
/** Percent of the term the calendar says is done — the Pace benchmark. */
const EXPECTED_PCT = round1((TERM_ELAPSED_DAYS / TERM_TOTAL_DAYS) * 100)

const ENGAGEMENT_WINDOW = weekdaysBack(40)
/** The trailing window the Engagement signal actually scores. */
const SCORING_WINDOW = ENGAGEMENT_WINDOW.slice(-20)

// ─────────────────────────────────────────────────────────────────────────────
// Archetype behaviour
// ─────────────────────────────────────────────────────────────────────────────

type Profile = {
  loginProb: number
  liveProb: number
  activeMinutes: number
  paceGap: number
  gradeBase: number
  missingRate: number
  daysSinceLastLogin: number
}

const PROFILES: Record<Archetype, Profile> = {
  thriving: {
    loginProb: 0.95,
    liveProb: 0.95,
    activeMinutes: 68,
    paceGap: -4,
    gradeBase: 92,
    missingRate: 0.02,
    daysSinceLastLogin: 0,
  },
  steady: {
    loginProb: 0.86,
    liveProb: 0.85,
    activeMinutes: 52,
    paceGap: 3,
    gradeBase: 84,
    missingRate: 0.06,
    daysSinceLastLogin: 1,
  },
  // Engaged and passing — the gap is purely completion pace.
  slipping_pace: {
    loginProb: 0.9,
    liveProb: 0.8,
    activeMinutes: 41,
    paceGap: 23,
    gradeBase: 82,
    missingRate: 0.08,
    daysSinceLastLogin: 1,
  },
  // Shows up and keeps pace, but the work coming in is not passing.
  slipping_performance: {
    loginProb: 0.93,
    liveProb: 0.9,
    activeMinutes: 46,
    paceGap: 6,
    gradeBase: 58,
    missingRate: 0.24,
    daysSinceLastLogin: 1,
  },
  disengaging: {
    loginProb: 0.32,
    liveProb: 0.22,
    activeMinutes: 14,
    paceGap: 29,
    gradeBase: 60,
    missingRate: 0.38,
    daysSinceLastLogin: 6,
  },
  // Engagement collapses while grades and pace stay respectable — the tell
  // that this is a device problem rather than a motivation problem.
  connectivity: {
    loginProb: 0.44,
    liveProb: 0.28,
    activeMinutes: 19,
    paceGap: 18,
    gradeBase: 76,
    missingRate: 0.22,
    daysSinceLastLogin: 4,
  },
  recovering: {
    loginProb: 0.92,
    liveProb: 0.88,
    activeMinutes: 57,
    paceGap: 4,
    gradeBase: 84,
    missingRate: 0.07,
    daysSinceLastLogin: 0,
  },
}

function weightedArchetype(): Archetype {
  const total = ARCHETYPE_MIX.reduce((a, b) => a + b.weight, 0)
  let roll = rng() * total
  for (const entry of ARCHETYPE_MIX) {
    roll -= entry.weight
    if (roll <= 0) return entry.archetype
  }
  return 'steady'
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert helper — chunked so large tables don't blow the parameter limit
// ─────────────────────────────────────────────────────────────────────────────

async function insertAll<T extends Record<string, unknown>>(
  table: never,
  rows: T[],
  chunk = 500,
) {
  for (let i = 0; i < rows.length; i += chunk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table as any).values(rows.slice(i, i + chunk) as any)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────────────────────────────────────────

const MIDDLE_COURSES = [
  { code: 'MTH6', title: 'Mathematics 6', subject: 'Mathematics' },
  { code: 'MTH7', title: 'Mathematics 7', subject: 'Mathematics' },
  { code: 'MTH8', title: 'Pre-Algebra', subject: 'Mathematics' },
  { code: 'ELA6', title: 'English Language Arts 6', subject: 'English' },
  { code: 'ELA7', title: 'English Language Arts 7', subject: 'English' },
  { code: 'ELA8', title: 'English Language Arts 8', subject: 'English' },
  { code: 'SCI7', title: 'Life Science', subject: 'Science' },
  { code: 'SOC7', title: 'World History', subject: 'Social Studies' },
  { code: 'ART6', title: 'Digital Art Foundations', subject: 'Elective' },
]

const HIGH_COURSES = [
  { code: 'ALG1', title: 'Algebra I', subject: 'Mathematics' },
  { code: 'GEO1', title: 'Geometry', subject: 'Mathematics' },
  { code: 'ALG2', title: 'Algebra II', subject: 'Mathematics' },
  { code: 'ENG9', title: 'English I', subject: 'English' },
  { code: 'ENG10', title: 'English II', subject: 'English' },
  { code: 'BIO1', title: 'Biology', subject: 'Science' },
  { code: 'CHEM1', title: 'Chemistry', subject: 'Science' },
  { code: 'USH1', title: 'United States History', subject: 'Social Studies' },
  { code: 'CSP1', title: 'Computer Science Principles', subject: 'Elective' },
]

const UNIT_TITLES: Record<string, string[]> = {
  Mathematics: [
    'Rational Numbers',
    'Expressions & Equations',
    'Proportional Reasoning',
    'Functions & Modeling',
    'Data & Statistics',
  ],
  English: [
    'Narrative Craft',
    'Argument & Evidence',
    'Informational Text',
    'Poetry & Voice',
    'Research & Synthesis',
  ],
  Science: [
    'Scientific Practices',
    'Matter & Energy',
    'Systems & Interactions',
    'Heredity & Variation',
    'Earth & Human Activity',
  ],
  'Social Studies': [
    'Foundations & Geography',
    'Government & Civics',
    'Conflict & Change',
    'Economics in Context',
    'Modern Era',
  ],
  Elective: [
    'Tools & Techniques',
    'Composition',
    'Iteration & Critique',
    'Portfolio',
    'Capstone',
  ],
}

const STAFF = [
  { key: 'priya', given: 'Priya', family: 'Raghunathan', title: 'Mathematics Teacher', role: 'teacher' as const, band: 'high' },
  { key: 'marcus', given: 'Marcus', family: 'Delaney', title: 'English Teacher', role: 'teacher' as const, band: 'high' },
  { key: 'yuki', given: 'Yuki', family: 'Tanaka', title: 'Science Teacher', role: 'teacher' as const, band: 'high' },
  { key: 'rosa', given: 'Rosa', family: 'Iglesias', title: 'Social Studies Teacher', role: 'teacher' as const, band: 'high' },
  { key: 'ben', given: 'Ben', family: 'Aduba', title: 'Elective Teacher', role: 'teacher' as const, band: 'high' },
  { key: 'nadia', given: 'Nadia', family: 'Farouk', title: 'Mathematics Teacher', role: 'teacher' as const, band: 'middle' },
  { key: 'chris', given: 'Chris', family: 'Bellweather', title: 'English Teacher', role: 'teacher' as const, band: 'middle' },
  { key: 'hana', given: 'Hana', family: 'Petrov', title: 'Science Teacher', role: 'teacher' as const, band: 'middle' },
  { key: 'omar', given: 'Omar', family: 'Chaudhry', title: 'Social Studies Teacher', role: 'teacher' as const, band: 'middle' },
  { key: 'dana', given: 'Dana', family: 'Kirkpatrick', title: 'Elective Teacher', role: 'teacher' as const, band: 'middle' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Clearing existing data…')
  // Reverse dependency order.
  for (const table of [
    s.accessLog,
    s.userLayouts,
    s.roleLayouts,
    s.integrationSources,
    s.supportTickets,
    s.outreach,
    s.interventionSessions,
    s.progressPoints,
    s.planGoals,
    s.interventionPlans,
    s.referrals,
    s.riskScores,
    s.assessmentResults,
    s.assessments,
    s.pacing,
    s.lessonStandards,
    s.resources,
    s.lessons,
    s.units,
    s.standards,
    s.courseProgress,
    s.dailyEngagement,
    s.submissions,
    s.assignments,
    s.enrollments,
    s.sections,
    s.courses,
    s.terms,
    s.guardianships,
    s.learners,
    s.users,
    s.orgs,
  ]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.delete(table as any)
  }

  // ── Organizations ──────────────────────────────────────────────────────────
  console.log('Organizations…')
  const districtId = 'org_district'
  const middleId = 'org_middle'
  const highId = 'org_high'
  await insertAll(s.orgs as never, [
    { id: districtId, name: DISTRICT_NAME, type: 'district' as const, parentId: null },
    { id: middleId, name: 'Meridian Virtual Middle (6–8)', type: 'program' as const, parentId: districtId },
    { id: highId, name: 'Meridian Virtual High (9–12)', type: 'program' as const, parentId: districtId },
  ])

  // ── Terms ──────────────────────────────────────────────────────────────────
  const termId = 'term_current'
  await insertAll(s.terms as never, [
    {
      id: termId,
      name: 'Continuous Term B',
      startsOn: iso(TERM_START),
      endsOn: iso(TERM_END),
      orgId: districtId,
    },
  ])

  // ── Staff, counselor, administrator ────────────────────────────────────────
  console.log('Staff…')
  type UserRow = typeof s.users.$inferInsert
  const userRows: UserRow[] = []
  const staffIdByKey = new Map<string, string>()

  for (const st of STAFF) {
    const id = `usr_${st.key}`
    staffIdByKey.set(st.key, id)
    userRows.push({
      id,
      email: `${st.given.toLowerCase()}.${st.family.toLowerCase()}@meridianvirtual.example`,
      givenName: st.given,
      familyName: st.family,
      role: st.role,
      title: st.title,
      orgId: st.band === 'high' ? highId : middleId,
      active: true,
      lastSignInAt: addDays(TODAY, 0),
    })
  }

  const counselorId = 'usr_andre'
  staffIdByKey.set('andre', counselorId)
  userRows.push({
    id: counselorId,
    email: 'andre.whitfield@meridianvirtual.example',
    givenName: 'Andre',
    familyName: 'Whitfield',
    role: 'counselor',
    title: 'Intervention Specialist',
    orgId: districtId,
    active: true,
    lastSignInAt: TODAY,
  })

  const secondCounselorId = 'usr_joelle'
  staffIdByKey.set('joelle', secondCounselorId)
  userRows.push({
    id: secondCounselorId,
    email: 'joelle.baptiste@meridianvirtual.example',
    givenName: 'Joelle',
    familyName: 'Baptiste',
    role: 'counselor',
    title: 'Intervention Specialist',
    orgId: districtId,
    active: true,
    lastSignInAt: TODAY,
  })

  const adminId = 'usr_lena'
  userRows.push({
    id: adminId,
    email: 'lena.torres@meridianvirtual.example',
    givenName: 'Lena',
    familyName: 'Torres',
    role: 'administrator',
    title: 'Program Administrator',
    orgId: districtId,
    active: true,
    lastSignInAt: TODAY,
  })

  // ── Learners ───────────────────────────────────────────────────────────────
  console.log('Learners…')
  type LearnerRow = typeof s.learners.$inferInsert
  const learnerRows: LearnerRow[] = []
  const archetypeByLearner = new Map<string, Archetype>()
  const learnerIdByKey = new Map<string, string>()

  const TOTAL_LEARNERS = 200
  let learnerN = 0

  function addLearner(opts: {
    given: string
    family: string
    grade: number
    archetype: Archetype
    key?: string
    counselor?: string
  }) {
    learnerN += 1
    const num = String(learnerN).padStart(4, '0')
    const userId = `usr_lrn_${num}`
    const learnerId = `lrn_${num}`
    if (opts.key) learnerIdByKey.set(opts.key, learnerId)

    userRows.push({
      id: userId,
      email: `${opts.given.toLowerCase()}.${opts.family.toLowerCase()}.${num}@learner.meridianvirtual.example`,
      givenName: opts.given,
      familyName: opts.family,
      role: 'student',
      title: null,
      orgId: opts.grade <= 8 ? middleId : highId,
      active: true,
      lastSignInAt: addDays(TODAY, -PROFILES[opts.archetype].daysSinceLastLogin),
    })

    learnerRows.push({
      id: learnerId,
      userId,
      stateId: `SY-${String(700000 + learnerN)}`,
      gradeLevel: opts.grade,
      orgId: opts.grade <= 8 ? middleId : highId,
      enrolledOn: iso(addDays(TERM_START, -randInt(0, 400))),
      pathway: chance(0.82) ? 'full_time' : 'supplemental',
      counselorUserId: opts.counselor ?? (chance(0.55) ? counselorId : secondCounselorId),
    })

    archetypeByLearner.set(learnerId, opts.archetype)
    return learnerId
  }

  // Story learners first — all on the demo counselor's caseload.
  for (const sl of STORY_LEARNERS) {
    addLearner({
      given: sl.givenName,
      family: sl.familyName,
      grade: sl.gradeLevel,
      archetype: sl.archetype,
      key: sl.key,
      counselor: counselorId,
    })
  }

  // Sofia Ramirez — Diego's sibling, so the guardian view has two children.
  addLearner({
    given: 'Sofia',
    family: 'Ramirez',
    grade: 10,
    archetype: 'steady',
    key: 'sofia',
    counselor: counselorId,
  })

  while (learnerN < TOTAL_LEARNERS) {
    addLearner({
      given: faker.person.firstName(),
      family: faker.person.lastName(),
      grade: randInt(6, 12),
      archetype: weightedArchetype(),
    })
  }

  // ── Guardians ──────────────────────────────────────────────────────────────
  console.log('Guardians…')
  type GuardianshipRow = typeof s.guardianships.$inferInsert
  const guardianshipRows: GuardianshipRow[] = []

  // The demo guardian, with two children of contrasting profiles.
  const demoGuardianId = 'usr_carmen'
  userRows.push({
    id: demoGuardianId,
    email: 'carmen.ramirez@example.com',
    givenName: 'Carmen',
    familyName: 'Ramirez',
    role: 'guardian',
    title: null,
    orgId: districtId,
    active: true,
    lastSignInAt: addDays(TODAY, -1),
  })
  for (const [key, rel] of [
    ['diego', 'Parent'],
    ['sofia', 'Parent'],
  ] as const) {
    guardianshipRows.push({
      id: `gdn_${key}`,
      guardianUserId: demoGuardianId,
      learnerId: learnerIdByKey.get(key)!,
      relationship: rel,
      isPrimary: true,
      receivesAlerts: true,
    })
  }

  // One guardian for every other learner, so the model is complete.
  let guardianN = 0
  for (const lr of learnerRows) {
    if (lr.id === learnerIdByKey.get('diego') || lr.id === learnerIdByKey.get('sofia')) continue
    guardianN += 1
    const gid = `usr_gdn_${String(guardianN).padStart(4, '0')}`
    const given = faker.person.firstName()
    const family = faker.person.lastName()
    userRows.push({
      id: gid,
      email: `${given.toLowerCase()}.${family.toLowerCase()}.${guardianN}@example.com`,
      givenName: given,
      familyName: family,
      role: 'guardian',
      title: null,
      orgId: districtId,
      active: true,
      lastSignInAt: chance(0.6) ? addDays(TODAY, -randInt(0, 14)) : null,
    })
    guardianshipRows.push({
      id: `gdn_${String(guardianN).padStart(4, '0')}`,
      guardianUserId: gid,
      learnerId: lr.id!,
      relationship: pick(['Parent', 'Parent', 'Grandparent', 'Legal Guardian']),
      isPrimary: true,
      receivesAlerts: chance(0.85),
    })
  }

  await insertAll(s.users as never, userRows)
  await insertAll(s.learners as never, learnerRows)
  await insertAll(s.guardianships as never, guardianshipRows)

  // ── Standards, courses, units, lessons ─────────────────────────────────────
  console.log('Curriculum…')
  type StandardRow = typeof s.standards.$inferInsert
  const standardRows: StandardRow[] = []
  const SUBJECT_PREFIX: Record<string, string> = {
    Mathematics: 'MA',
    English: 'LA',
    Science: 'SC',
    'Social Studies': 'SS',
    Elective: 'EL',
  }
  for (const subject of Object.keys(SUBJECT_PREFIX)) {
    for (let grade = 6; grade <= 12; grade++) {
      for (let n = 1; n <= 4; n++) {
        standardRows.push({
          id: `std_${SUBJECT_PREFIX[subject]}_${grade}_${n}`,
          code: `${SUBJECT_PREFIX[subject]}.${grade}.${n}`,
          description: `${subject} grade ${grade} focus standard ${n}`,
          subject,
          gradeLevel: grade,
        })
      }
    }
  }
  await insertAll(s.standards as never, standardRows)

  type CourseRow = typeof s.courses.$inferInsert
  const courseRows: CourseRow[] = []
  type UnitRow = typeof s.units.$inferInsert
  const unitRows: UnitRow[] = []
  type LessonRow = typeof s.lessons.$inferInsert
  const lessonRows: LessonRow[] = []
  type LessonStandardRow = typeof s.lessonStandards.$inferInsert
  const lessonStandardRows: LessonStandardRow[] = []

  const allCourses = [
    ...MIDDLE_COURSES.map((c) => ({ ...c, band: 'middle' as const })),
    ...HIGH_COURSES.map((c) => ({ ...c, band: 'high' as const })),
  ]

  for (const c of allCourses) {
    const courseId = `crs_${c.code}`
    courseRows.push({
      id: courseId,
      code: c.code,
      title: c.title,
      subject: c.subject,
      gradeBand: c.band,
    })

    const titles = UNIT_TITLES[c.subject] ?? UNIT_TITLES.Elective
    titles.forEach((title, i) => {
      const unitId = `unt_${c.code}_${i + 1}`
      unitRows.push({
        id: unitId,
        courseId,
        title,
        sequence: i + 1,
        weeks: 3,
      })
      for (let l = 1; l <= 4; l++) {
        const lessonId = `lsn_${c.code}_${i + 1}_${l}`
        lessonRows.push({
          id: lessonId,
          unitId,
          title: `${title}: Lesson ${l}`,
          sequence: l,
          estimatedMinutes: randInt(35, 70),
        })
        const grade = c.band === 'middle' ? randInt(6, 8) : randInt(9, 12)
        lessonStandardRows.push({
          id: `lst_${c.code}_${i + 1}_${l}`,
          lessonId,
          standardId: `std_${SUBJECT_PREFIX[c.subject]}_${grade}_${randInt(1, 4)}`,
        })
      }
    })
  }

  await insertAll(s.courses as never, courseRows)
  await insertAll(s.units as never, unitRows)
  await insertAll(s.lessons as never, lessonRows)
  await insertAll(s.lessonStandards as never, lessonStandardRows)

  // Openly licensed intervention resources, used by the counselor view.
  type ResourceRow = typeof s.resources.$inferInsert
  const resourceRows: ResourceRow[] = []
  const RESOURCE_TITLES = [
    'Fluency Builder Practice Set',
    'Guided Notes: Multi-Step Equations',
    'Close Reading Protocol',
    'Vocabulary in Context Routine',
    'Number Talks Warm-Up Bank',
    'Argument Writing Scaffold',
    'Check-In / Check-Out Tracker',
    'Goal-Setting Conference Guide',
  ]
  RESOURCE_TITLES.forEach((title, i) => {
    resourceRows.push({
      id: `res_${i + 1}`,
      title,
      kind: pick(['reading', 'practice', 'intervention', 'video'] as const),
      subject: pick(['Mathematics', 'English', 'Science', 'Social Studies']),
      gradeBand: pick(['middle', 'high']),
      standardId: standardRows[randInt(0, standardRows.length - 1)].id!,
      license: pick(['CC BY 4.0', 'CC BY-SA 4.0', 'Public Domain']),
    })
  })
  await insertAll(s.resources as never, resourceRows)

  // ── Sections ───────────────────────────────────────────────────────────────
  console.log('Sections…')
  type SectionRow = typeof s.sections.$inferInsert
  const sectionRows: SectionRow[] = []
  const sectionsByBand: Record<'middle' | 'high', string[]> = { middle: [], high: [] }

  const teacherForSubject = (subject: string, band: 'middle' | 'high') => {
    const pool = STAFF.filter((st) => st.band === band && st.title.startsWith(subject.split(' ')[0]))
    const chosen = pool.length ? pool[0] : STAFF.filter((st) => st.band === band)[0]
    return staffIdByKey.get(chosen.key)!
  }

  for (const c of allCourses) {
    const sectionCount = 2
    for (let i = 1; i <= sectionCount; i++) {
      const sectionId = `sec_${c.code}_${i}`
      sectionRows.push({
        id: sectionId,
        courseId: `crs_${c.code}`,
        termId,
        name: `${c.title} — Section ${i}`,
        teacherUserId: teacherForSubject(c.subject, c.band),
        cadence: pick(['async_only', 'weekly_live', 'twice_weekly_live'] as const),
      })
      sectionsByBand[c.band].push(sectionId)
    }
  }
  await insertAll(s.sections as never, sectionRows)

  // Pacing: planned unit windows per section, with actual delivery drift.
  type PacingRow = typeof s.pacing.$inferInsert
  const pacingRows: PacingRow[] = []
  for (const sec of sectionRows) {
    const courseCode = sec.id!.split('_')[1]
    const secUnits = unitRows.filter((u) => u.courseId === `crs_${courseCode}`)
    secUnits.forEach((u, i) => {
      const start = addDays(TERM_START, i * 21)
      pacingRows.push({
        id: `pac_${sec.id}_${u.sequence}`,
        sectionId: sec.id!,
        unitId: u.id!,
        plannedStartOn: iso(start),
        plannedEndOn: iso(addDays(start, 20)),
        actualPct: clamp(round1(EXPECTED_PCT + rand(-18, 8)), 0, 100),
      })
    })
  }
  await insertAll(s.pacing as never, pacingRows)

  // ── Enrollments ────────────────────────────────────────────────────────────
  console.log('Enrollments…')
  type EnrollmentRow = typeof s.enrollments.$inferInsert
  const enrollmentRows: EnrollmentRow[] = []
  const sectionsByLearner = new Map<string, string[]>()

  // Guarantee the demo teacher's sections contain the high-school story
  // learners, so her dashboard is the same story from another angle.
  const priyaSections = sectionRows
    .filter((sec) => sec.teacherUserId === staffIdByKey.get('priya'))
    .map((sec) => sec.id!)

  let enrollN = 0
  for (const lr of learnerRows) {
    const band: 'middle' | 'high' = lr.gradeLevel! <= 8 ? 'middle' : 'high'
    const pool = [...sectionsByBand[band]]
    // Shuffle deterministically.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(0, i)
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const chosen = pool.slice(0, 5)

    if (band === 'high' && priyaSections.length) {
      const mathSection = priyaSections[randInt(0, priyaSections.length - 1)]
      if (!chosen.includes(mathSection)) chosen[0] = mathSection
    }

    sectionsByLearner.set(lr.id!, chosen)
    for (const sectionId of chosen) {
      enrollN += 1
      enrollmentRows.push({
        id: `enr_${String(enrollN).padStart(5, '0')}`,
        sectionId,
        learnerId: lr.id!,
        startedOn: iso(TERM_START),
        status: 'active',
      })
    }
  }
  await insertAll(s.enrollments as never, enrollmentRows)

  // ── Assignments & submissions ──────────────────────────────────────────────
  console.log('Assignments & submissions…')
  type AssignmentRow = typeof s.assignments.$inferInsert
  const assignmentRows: AssignmentRow[] = []
  const assignmentsBySection = new Map<string, AssignmentRow[]>()

  for (const sec of sectionRows) {
    const courseCode = sec.id!.split('_')[1]
    const secUnits = unitRows.filter((u) => u.courseId === `crs_${courseCode}`)
    const list: AssignmentRow[] = []
    for (let i = 0; i < 14; i++) {
      const due = addDays(TERM_START, Math.floor((i + 1) * (TERM_TOTAL_DAYS / 16)))
      const row: AssignmentRow = {
        id: `asg_${sec.id}_${i + 1}`,
        sectionId: sec.id!,
        unitId: secUnits[Math.min(secUnits.length - 1, Math.floor(i / 3))]?.id ?? null,
        title: `${['Practice Set', 'Quiz', 'Discussion', 'Lab', 'Essay', 'Project Check'][i % 6]} ${i + 1}`,
        dueOn: iso(due),
        points: 100,
        kind: pick(['assignment', 'quiz', 'discussion', 'project', 'exam'] as const),
      }
      list.push(row)
      assignmentRows.push(row)
    }
    assignmentsBySection.set(sec.id!, list)
  }
  await insertAll(s.assignments as never, assignmentRows)

  type SubmissionRow = typeof s.submissions.$inferInsert
  const submissionRows: SubmissionRow[] = []
  const missingCountByLearner = new Map<string, number>()
  /** Denominator for the missing-work rate — a learner taking more courses
   *  should not be penalised for having more assignments. */
  const dueCountByLearner = new Map<string, number>()

  let subN = 0
  for (const lr of learnerRows) {
    const profile = PROFILES[archetypeByLearner.get(lr.id!)!]
    let missing = 0
    let due = 0
    for (const sectionId of sectionsByLearner.get(lr.id!)!) {
      for (const asg of assignmentsBySection.get(sectionId)!) {
        // Only assignments already due generate a submission record.
        if (new Date(asg.dueOn as string) > TODAY) continue
        due += 1
        subN += 1
        const isMissing = chance(profile.missingRate)
        if (isMissing) missing += 1
        const isLate = !isMissing && chance(profile.missingRate * 0.8)
        const score = isMissing
          ? 0
          : clamp(profile.gradeBase + rand(-12, 10), 0, 100)
        submissionRows.push({
          id: `sub_${String(subN).padStart(6, '0')}`,
          assignmentId: asg.id!,
          learnerId: lr.id!,
          submittedAt: isMissing ? null : addDays(new Date(asg.dueOn as string), isLate ? randInt(1, 5) : -randInt(0, 2)),
          score: isMissing ? 0 : round1(score),
          status: isMissing ? 'missing' : isLate ? 'late' : 'graded',
        })
      }
    }
    missingCountByLearner.set(lr.id!, missing)
    dueCountByLearner.set(lr.id!, due)
  }
  await insertAll(s.submissions as never, submissionRows)

  // ── Daily engagement ───────────────────────────────────────────────────────
  console.log('Daily engagement…')
  type EngagementRow = typeof s.dailyEngagement.$inferInsert
  const engagementRows: EngagementRow[] = []
  const engagementStats = new Map<
    string,
    { loginRate: number; liveRate: number; avgMinutes: number; daysSinceLastLogin: number }
  >()

  let engN = 0
  for (const lr of learnerRows) {
    const archetype = archetypeByLearner.get(lr.id!)!
    const profile = PROFILES[archetype]
    let loginDays = 0
    let liveScheduled = 0
    let liveAttended = 0
    let minutesTotal = 0
    let lastLoginIndex = -1

    ENGAGEMENT_WINDOW.forEach((day, idx) => {
      const recency = idx / ENGAGEMENT_WINDOW.length
      // Trajectory: 'recovering' climbs over the window, 'disengaging' falls.
      let loginProb = profile.loginProb
      if (archetype === 'recovering') loginProb = 0.35 + recency * 0.6
      if (archetype === 'disengaging') loginProb = 0.85 - recency * 0.65
      if (archetype === 'connectivity') loginProb = recency > 0.75 ? 0.12 : 0.88

      const inScoringWindow = idx >= ENGAGEMENT_WINDOW.length - SCORING_WINDOW.length
      // The most recent `daysSinceLastLogin` days are forced offline so the
      // headline number on the dashboard matches the row-level data.
      const forcedOffline =
        idx >= ENGAGEMENT_WINDOW.length - profile.daysSinceLastLogin
      const loggedIn = forcedOffline ? false : chance(loginProb)

      const scheduled = chance(0.4) ? 1 : 0
      const attended = loggedIn && scheduled && chance(profile.liveProb) ? 1 : 0
      const minutes = loggedIn ? Math.round(clamp(profile.activeMinutes + rand(-18, 22), 0, 240)) : 0

      if (loggedIn) lastLoginIndex = idx
      if (inScoringWindow) {
        if (loggedIn) loginDays += 1
        liveScheduled += scheduled
        liveAttended += attended
        minutesTotal += minutes
      }

      engN += 1
      engagementRows.push({
        id: `eng_${String(engN).padStart(6, '0')}`,
        learnerId: lr.id!,
        day: iso(day),
        loggedIn,
        activeMinutes: minutes,
        lessonsTouched: loggedIn ? randInt(0, 4) : 0,
        liveSessionsScheduled: scheduled,
        liveSessionsAttended: attended,
        contactLogged: loggedIn && chance(0.25),
      })
    })

    const daysSinceLastLogin =
      lastLoginIndex === -1
        ? ENGAGEMENT_WINDOW.length
        : ENGAGEMENT_WINDOW.length - 1 - lastLoginIndex

    engagementStats.set(lr.id!, {
      loginRate: loginDays / SCORING_WINDOW.length,
      liveRate: liveScheduled ? liveAttended / liveScheduled : 1,
      avgMinutes: minutesTotal / SCORING_WINDOW.length,
      daysSinceLastLogin,
    })
  }
  await insertAll(s.dailyEngagement as never, engagementRows)

  // ── Course progress ────────────────────────────────────────────────────────
  console.log('Course progress…')
  type ProgressRow = typeof s.courseProgress.$inferInsert
  const progressRows: ProgressRow[] = []
  const paceStats = new Map<string, { actualPct: number; avgGrade: number }>()

  let progN = 0
  for (const lr of learnerRows) {
    const profile = PROFILES[archetypeByLearner.get(lr.id!)!]
    let actualSum = 0
    let gradeSum = 0
    const sectionIds = sectionsByLearner.get(lr.id!)!

    for (const sectionId of sectionIds) {
      const actualPct = clamp(round1(EXPECTED_PCT - profile.paceGap + rand(-6, 6)), 0, 100)
      const lessonsTotal = 20
      const grade = clamp(round1(profile.gradeBase + rand(-9, 9)), 0, 100)
      actualSum += actualPct
      gradeSum += grade
      progN += 1
      progressRows.push({
        id: `prg_${String(progN).padStart(5, '0')}`,
        learnerId: lr.id!,
        sectionId,
        lessonsTotal,
        lessonsComplete: Math.round((actualPct / 100) * lessonsTotal),
        expectedPct: EXPECTED_PCT,
        actualPct,
        currentGrade: grade,
        asOf: iso(TODAY),
      })
    }

    paceStats.set(lr.id!, {
      actualPct: actualSum / sectionIds.length,
      avgGrade: gradeSum / sectionIds.length,
    })
  }
  await insertAll(s.courseProgress as never, progressRows)

  // ── Derived Engagement / Pace / Performance ────────────────────────────────
  console.log('Computing Engagement / Pace / Performance…')
  type RiskRow = typeof s.riskScores.$inferInsert
  const riskRows: RiskRow[] = []
  const currentByLearner = new Map<
    string,
    { engagement: number; pace: number; performance: number; composite: number; tier: 1 | 2 | 3 }
  >()

  let riskN = 0
  for (const lr of learnerRows) {
    const eng = engagementStats.get(lr.id!)!
    const pace = paceStats.get(lr.id!)!
    const missing = missingCountByLearner.get(lr.id!) ?? 0
    const due = dueCountByLearner.get(lr.id!) ?? 1
    const missingRate = due ? missing / due : 0

    // Engagement: activity in the trailing window, decayed by recency of last
    // login. The decay is multiplicative rather than subtractive — a learner
    // who has been gone a week should read as critically low, not as a
    // suspicious hard zero.
    const activityBase =
      100 *
      (0.55 * eng.loginRate + 0.3 * eng.liveRate + 0.15 * Math.min(1, eng.avgMinutes / 45))
    const recencyDecay = 1 - Math.min(0.6, eng.daysSinceLastLogin * 0.1)
    const engagement = clamp(activityBase * recencyDecay)

    // Pace: how far behind the calendar the learner has fallen.
    const paceGap = Math.max(0, EXPECTED_PCT - pace.actualPct)
    const paceScore = clamp(100 - paceGap * 2.4)

    // Performance: average grade, penalised by the *rate* of missing work so
    // that taking more courses is not itself a risk factor.
    const performance = clamp(pace.avgGrade - missingRate * 35)
    const composite =
      COMPOSITE_WEIGHTS.engagement * engagement +
      COMPOSITE_WEIGHTS.pace * paceScore +
      COMPOSITE_WEIGHTS.performance * performance

    const parts = [
      { key: 'engagement' as const, value: engagement },
      { key: 'pace' as const, value: paceScore },
      { key: 'performance' as const, value: performance },
    ].sort((a, b) => a.value - b.value)

    const tier = tierFor(composite)
    currentByLearner.set(lr.id!, {
      engagement: round1(engagement),
      pace: round1(paceScore),
      performance: round1(performance),
      composite: round1(composite),
      tier,
    })

    // Weekly history. The current week is exactly the derived value above; the
    // prior seven are shaped by the archetype's trajectory so trend lines tell
    // the same story the underlying rows do.
    const archetype = archetypeByLearner.get(lr.id!)!
    for (let w = 7; w >= 0; w--) {
      const weeksAgo = w
      let factor = 1
      if (archetype === 'recovering') factor = 1 - weeksAgo * 0.055
      else if (archetype === 'disengaging') factor = 1 + weeksAgo * 0.06
      else if (archetype === 'connectivity') factor = 1 + (weeksAgo > 1 ? 0.28 : 0)
      else factor = 1 + rand(-0.03, 0.03)

      const wComposite = clamp(composite * factor)
      riskN += 1
      riskRows.push({
        id: `rsk_${String(riskN).padStart(6, '0')}`,
        learnerId: lr.id!,
        asOf: iso(addDays(TODAY, -weeksAgo * 7)),
        engagement: round1(weeksAgo === 0 ? engagement : clamp(engagement * factor)),
        pace: round1(weeksAgo === 0 ? paceScore : clamp(paceScore * factor)),
        performance: round1(weeksAgo === 0 ? performance : clamp(performance * factor)),
        composite: round1(weeksAgo === 0 ? composite : wComposite),
        tier: tierFor(weeksAgo === 0 ? composite : wComposite),
        trend: 0,
        topDriver: parts[0].key,
        daysSinceLastLogin: weeksAgo === 0 ? eng.daysSinceLastLogin : randInt(0, 3),
      })
    }
    // Fill in week-over-week trend for the current row.
    const current = riskRows[riskRows.length - 1]
    const prior = riskRows[riskRows.length - 2]
    current.trend = round1((current.composite as number) - (prior.composite as number))
  }
  await insertAll(s.riskScores as never, riskRows)

  // ── Assessments ────────────────────────────────────────────────────────────
  console.log('Assessments…')
  const assessmentRows: (typeof s.assessments.$inferInsert)[] = [
    { id: 'ass_read', name: 'Reading Universal Screener', subject: 'English', kind: 'universal_screener' },
    { id: 'ass_math', name: 'Mathematics Universal Screener', subject: 'Mathematics', kind: 'universal_screener' },
    { id: 'ass_bench', name: 'Mid-Term Benchmark', subject: 'Mathematics', kind: 'benchmark' },
  ]
  await insertAll(s.assessments as never, assessmentRows)

  type ResultRow = typeof s.assessmentResults.$inferInsert
  const resultRows: ResultRow[] = []
  let resN = 0
  for (const lr of learnerRows) {
    const cur = currentByLearner.get(lr.id!)!
    for (const a of assessmentRows) {
      resN += 1
      const percentile = Math.round(clamp(cur.composite + rand(-18, 18), 1, 99))
      resultRows.push({
        id: `asr_${String(resN).padStart(6, '0')}`,
        assessmentId: a.id!,
        learnerId: lr.id!,
        administeredOn: iso(addDays(TODAY, -randInt(20, 60))),
        scaleScore: Math.round(400 + percentile * 2.4),
        percentile,
        benchmarkStatus:
          percentile >= 60 ? 'above' : percentile >= 40 ? 'at' : percentile >= 20 ? 'below' : 'well_below',
      })
    }
  }
  await insertAll(s.assessmentResults as never, resultRows)

  // ── Referrals, plans, goals, progress monitoring, sessions ─────────────────
  console.log('Supports…')
  type ReferralRow = typeof s.referrals.$inferInsert
  const referralRows: ReferralRow[] = []
  type PlanRow = typeof s.interventionPlans.$inferInsert
  const planRows: PlanRow[] = []
  type GoalRow = typeof s.planGoals.$inferInsert
  const goalRows: GoalRow[] = []
  type PointRow = typeof s.progressPoints.$inferInsert
  const pointRows: PointRow[] = []
  type SessionRow = typeof s.interventionSessions.$inferInsert
  const sessionRows: SessionRow[] = []
  type OutreachRow = typeof s.outreach.$inferInsert
  const outreachRows: OutreachRow[] = []
  type TicketRow = typeof s.supportTickets.$inferInsert
  const ticketRows: TicketRow[] = []

  let refN = 0
  let planN = 0
  let goalN = 0
  let pointN = 0
  let sessN = 0
  let outN = 0
  let tikN = 0

  const REASON_BY_DRIVER: Record<string, string[]> = {
    engagement: [
      'No platform activity for several consecutive days',
      'Missed three consecutive live sessions',
      'Login streak broken after sustained attendance',
    ],
    pace: [
      'Course completion trailing expected pace by more than 15 points',
      'Has not advanced a unit in two weeks',
      'Behind pace in multiple courses simultaneously',
    ],
    performance: [
      'Grade dropped below passing in one or more courses',
      'Repeated missing assignments in the same course',
      'Assessment score fell well below benchmark',
    ],
  }

  for (const lr of learnerRows) {
    const cur = currentByLearner.get(lr.id!)!
    const archetype = archetypeByLearner.get(lr.id!)!
    const driver = riskRows.find((r) => r.learnerId === lr.id && r.asOf === iso(TODAY))!.topDriver as string

    // Connectivity learners get an open device ticket — the reframe.
    if (archetype === 'connectivity') {
      tikN += 1
      ticketRows.push({
        id: `tik_${String(tikN).padStart(4, '0')}`,
        learnerId: lr.id!,
        openedOn: iso(addDays(TODAY, -randInt(2, 6))),
        category: pick(['device', 'connectivity'] as const),
        status: pick(['open', 'awaiting_family'] as const),
        note: pick([
          'Device will not charge; replacement requested.',
          'Home internet outage reported by family.',
          'Learner locked out after password reset.',
        ]),
      })
    }

    // Tier 2 and 3 learners get a referral and an active plan.
    if (cur.tier >= 2) {
      refN += 1
      referralRows.push({
        id: `ref_${String(refN).padStart(4, '0')}`,
        learnerId: lr.id!,
        raisedByUserId: pick([...staffIdByKey.values()].filter((v) => v.startsWith('usr_')) as string[]),
        raisedOn: iso(addDays(TODAY, -randInt(1, 21))),
        category:
          archetype === 'connectivity'
            ? 'connectivity'
            : driver === 'engagement'
              ? 'engagement'
              : driver === 'pace'
                ? 'pace'
                : 'academic',
        reason: pick(REASON_BY_DRIVER[driver] ?? REASON_BY_DRIVER.engagement),
        status: pick(['new', 'acknowledged', 'in_progress', 'in_progress'] as const),
        note: null,
      })

      planN += 1
      const planId = `pln_${String(planN).padStart(4, '0')}`
      planRows.push({
        id: planId,
        learnerId: lr.id!,
        tier: cur.tier,
        focus:
          driver === 'engagement'
            ? 'Daily engagement and check-in routine'
            : driver === 'pace'
              ? 'Course pacing and completion plan'
              : 'Targeted academic support',
        startedOn: iso(addDays(TODAY, -randInt(14, 45))),
        reviewOn: iso(addDays(TODAY, randInt(-3, 18))),
        ownerUserId: lr.counselorUserId ?? counselorId,
        status: archetype === 'recovering' ? 'monitoring' : 'active',
      })

      goalN += 1
      const goalId = `gol_${String(goalN).padStart(4, '0')}`
      const baseline = round1(clamp(cur.composite - rand(8, 20)))
      const target = round1(clamp(baseline + rand(18, 30)))
      goalRows.push({
        id: goalId,
        planId,
        description:
          driver === 'engagement'
            ? 'Log in and complete work on at least 4 of 5 school days'
            : driver === 'pace'
              ? 'Close the pace gap to within 5 points of expected'
              : 'Raise course grade to passing and clear missing work',
        metric: driver === 'engagement' ? 'Weekly engagement score' : driver === 'pace' ? 'Pace score' : 'Course grade',
        baseline,
        target,
      })

      // Eight weekly progress-monitoring points, trending toward the goal for
      // learners whose plan is working.
      const improving = archetype === 'recovering' || chance(0.45)
      for (let w = 7; w >= 0; w--) {
        pointN += 1
        const t = (7 - w) / 7
        const value = improving
          ? baseline + (target - baseline) * t + rand(-4, 4)
          : baseline + rand(-6, 6)
        pointRows.push({
          id: `pnt_${String(pointN).padStart(6, '0')}`,
          goalId,
          measuredOn: iso(addDays(TODAY, -w * 7)),
          value: round1(clamp(value)),
        })
      }

      // Intervention sessions, with fidelity — did the support actually happen.
      for (let w = 3; w >= 0; w--) {
        sessN += 1
        sessionRows.push({
          id: `ses_${String(sessN).padStart(5, '0')}`,
          planId,
          heldOn: iso(addDays(TODAY, -w * 7 - randInt(0, 2))),
          minutes: pick([20, 30, 30, 45]),
          staffUserId: lr.counselorUserId ?? counselorId,
          fidelity: chance(0.75) ? 'as_planned' : chance(0.6) ? 'partial' : 'missed',
          note: null,
        })
      }

      // Outreach — to learner and guardian, with response outcomes.
      for (let i = 0; i < randInt(2, 5); i++) {
        outN += 1
        outreachRows.push({
          id: `out_${String(outN).padStart(5, '0')}`,
          learnerId: lr.id!,
          byUserId: lr.counselorUserId ?? counselorId,
          at: addDays(TODAY, -randInt(0, 18)),
          channel: pick(['call', 'email', 'sms', 'message', 'video'] as const),
          audience: chance(0.55) ? 'guardian' : 'learner',
          outcome: pick(['connected', 'left_message', 'no_answer', 'replied', 'left_message'] as const),
          note: null,
        })
      }
    }

    // A kudos referral for a slice of thriving learners — the surface should
    // not only ever deliver bad news.
    if (cur.tier === 1 && chance(0.06)) {
      refN += 1
      referralRows.push({
        id: `ref_${String(refN).padStart(4, '0')}`,
        learnerId: lr.id!,
        raisedByUserId: staffIdByKey.get('priya')!,
        raisedOn: iso(addDays(TODAY, -randInt(1, 14))),
        category: 'kudos',
        reason: pick([
          'Sustained full attendance and completion for four straight weeks',
          'Moved from behind pace to ahead of pace this term',
          'Consistently supports peers in live sessions',
        ]),
        status: 'acknowledged',
        note: null,
      })
    }
  }

  await insertAll(s.referrals as never, referralRows)
  await insertAll(s.interventionPlans as never, planRows)
  await insertAll(s.planGoals as never, goalRows)
  await insertAll(s.progressPoints as never, pointRows)
  await insertAll(s.interventionSessions as never, sessionRows)
  await insertAll(s.outreach as never, outreachRows)
  await insertAll(s.supportTickets as never, ticketRows)

  // ── Default view per persona ───────────────────────────────────────────────
  // These are the role templates. A user's personalization is stored separately
  // in `user_layouts` and overlaid on top, so "reset to default" is just
  // deleting the override row.
  console.log('Role layouts…')
  await insertAll(s.roleLayouts as never, [
    {
      role: 'student' as const,
      items: [
        { type: 'myWork', span: 8, locked: true },
        { type: 'myPace', span: 4 },
        { type: 'myGrades', span: 6 },
        { type: 'myGoals', span: 6 },
        { type: 'courseMaterials', span: 8 },
        { type: 'getHelp', span: 4 },
      ],
    },
    {
      role: 'teacher' as const,
      items: [
        { type: 'needsAttention', span: 8, locked: true },
        { type: 'mySections', span: 4 },
        { type: 'atRiskInSections', span: 6 },
        { type: 'gradebookHealth', span: 6 },
        { type: 'pacingStatus', span: 12 },
      ],
    },
    {
      role: 'counselor' as const,
      items: [
        { type: 'referralInbox', span: 8, locked: true },
        { type: 'caseloadOverview', span: 4 },
        { type: 'watchlist', span: 12 },
        { type: 'progressMonitoring', span: 6 },
        { type: 'outreachQueue', span: 6 },
        { type: 'supportTickets', span: 12 },
      ],
    },
    {
      role: 'administrator' as const,
      items: [
        { type: 'programHealth', span: 12, locked: true },
        { type: 'tierDistribution', span: 6 },
        { type: 'engagementTrend', span: 6 },
        { type: 'interventionEffectiveness', span: 6 },
        { type: 'pacingAcrossSections', span: 6 },
        { type: 'integrationHealth', span: 12 },
      ],
    },
    {
      role: 'guardian' as const,
      items: [
        { type: 'myLearners', span: 12, locked: true },
        { type: 'weeklySnapshot', span: 6 },
        { type: 'whatWereWorkingOn', span: 6 },
        { type: 'upcomingWork', span: 8 },
        { type: 'supportStatus', span: 4 },
      ],
    },
  ])

  // ── Integration health ─────────────────────────────────────────────────────
  await insertAll(
    s.integrationSources as never,
    INTEGRATION_SOURCES.map((src) => ({
      key: src.key,
      label: src.label,
      category: src.category,
      status: src.status,
      lastSyncAt: new Date(Date.now() - src.syncMinutesAgo * 60_000),
      recordCount:
        src.key === 'sis'
          ? learnerRows.length
          : src.key === 'lms'
            ? submissionRows.length
            : src.key === 'mtss'
              ? referralRows.length + planRows.length
              : src.key === 'curriculum'
                ? lessonRows.length
                : userRows.length,
      note: src.note,
    })),
  )

  const tierCounts = { 1: 0, 2: 0, 3: 0 }
  for (const v of currentByLearner.values()) tierCounts[v.tier] += 1

  console.log('\nSeed complete.')
  console.table({
    learners: learnerRows.length,
    users: userRows.length,
    sections: sectionRows.length,
    enrollments: enrollmentRows.length,
    assignments: assignmentRows.length,
    submissions: submissionRows.length,
    engagementDays: engagementRows.length,
    riskSnapshots: riskRows.length,
    referrals: referralRows.length,
    plans: planRows.length,
    'tier 1': tierCounts[1],
    'tier 2': tierCounts[2],
    'tier 3': tierCounts[3],
  })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
