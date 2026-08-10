/**
 * Canonical schema for the unified surface prototype.
 *
 * Entity shapes follow the openly published Ed-Fi data standard and the
 * 1EdTech rostering spec where practical, so the model stays portable to real
 * integrations later. This is modelling *against* those public specs — it does
 * not imply certification against either.
 *
 * Two deliberate departures from brick-and-mortar models, because this is a
 * fully virtual program:
 *
 *  1. Attendance is not seat time. `dailyEngagement` is the evidence table:
 *     login, active minutes, work touched, live-session participation. State
 *     attendance/FTE reporting derives from documented progress and contact,
 *     which is what this table records.
 *  2. There are no office discipline referrals. The early-warning composite is
 *     Engagement / Pace / Performance (see `riskScores`), not Attendance /
 *     Behavior / Course performance.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────────────────────────────
// Shared union types
// ─────────────────────────────────────────────────────────────────────────────

export type Role =
  | 'student'
  | 'teacher'
  | 'counselor'
  | 'administrator'
  | 'guardian'

export const ROLES: Role[] = [
  'student',
  'teacher',
  'counselor',
  'administrator',
  'guardian',
]

export type Tier = 1 | 2 | 3

// ─────────────────────────────────────────────────────────────────────────────
// Identity & organization
// ─────────────────────────────────────────────────────────────────────────────

export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** district | program — no school buildings in a virtual model. */
  type: text('type').$type<'district' | 'program'>().notNull(),
  parentId: text('parent_id'),
})

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    givenName: text('given_name').notNull(),
    familyName: text('family_name').notNull(),
    role: text('role').$type<Role>().notNull(),
    /** Job title for staff; null for students and guardians. */
    title: text('title'),
    orgId: text('org_id').references(() => orgs.id),
    active: boolean('active').notNull().default(true),
    lastSignInAt: timestamp('last_sign_in_at', { mode: 'date' }),
  },
  (t) => [index('users_role_idx').on(t.role)],
)

export const learners = pgTable(
  'learners',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** Synthetic state student identifier — never a real one. */
    stateId: text('state_id').notNull(),
    gradeLevel: integer('grade_level').notNull(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id),
    enrolledOn: date('enrolled_on', { mode: 'string' }).notNull(),
    /** Full-time virtual vs. supplemental course-taker — changes expectations. */
    pathway: text('pathway').$type<'full_time' | 'supplemental'>().notNull(),
    /** Assigned counselor / intervention specialist. */
    counselorUserId: text('counselor_user_id').references(() => users.id),
  },
  (t) => [index('learners_counselor_idx').on(t.counselorUserId)],
)

export const guardianships = pgTable(
  'guardianships',
  {
    id: text('id').primaryKey(),
    guardianUserId: text('guardian_user_id')
      .notNull()
      .references(() => users.id),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    relationship: text('relationship').notNull(),
    isPrimary: boolean('is_primary').notNull().default(true),
    receivesAlerts: boolean('receives_alerts').notNull().default(true),
  },
  (t) => [
    index('guardianships_guardian_idx').on(t.guardianUserId),
    index('guardianships_learner_idx').on(t.learnerId),
  ],
)

// ─────────────────────────────────────────────────────────────────────────────
// Academic structure
// ─────────────────────────────────────────────────────────────────────────────

export const terms = pgTable('terms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }).notNull(),
  orgId: text('org_id').references(() => orgs.id),
})

export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  gradeBand: text('grade_band').notNull(),
})

export const sections = pgTable(
  'sections',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id),
    name: text('name').notNull(),
    teacherUserId: text('teacher_user_id')
      .notNull()
      .references(() => users.id),
    /** How often the section meets synchronously, if at all. */
    cadence: text('cadence')
      .$type<'async_only' | 'weekly_live' | 'twice_weekly_live' | 'daily_live'>()
      .notNull(),
  },
  (t) => [index('sections_teacher_idx').on(t.teacherUserId)],
)

export const enrollments = pgTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    startedOn: date('started_on', { mode: 'string' }).notNull(),
    status: text('status')
      .$type<'active' | 'withdrawn' | 'completed'>()
      .notNull()
      .default('active'),
  },
  (t) => [
    index('enrollments_section_idx').on(t.sectionId),
    index('enrollments_learner_idx').on(t.learnerId),
  ],
)

// ─────────────────────────────────────────────────────────────────────────────
// Learning platform signals
// ─────────────────────────────────────────────────────────────────────────────

export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id),
    unitId: text('unit_id'),
    title: text('title').notNull(),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    points: integer('points').notNull().default(100),
    kind: text('kind')
      .$type<'assignment' | 'quiz' | 'discussion' | 'project' | 'exam'>()
      .notNull(),
  },
  (t) => [index('assignments_section_idx').on(t.sectionId)],
)

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => assignments.id),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    submittedAt: timestamp('submitted_at', { mode: 'date' }),
    score: real('score'),
    status: text('status')
      .$type<'graded' | 'submitted' | 'late' | 'missing' | 'not_started'>()
      .notNull(),
  },
  (t) => [
    index('submissions_learner_idx').on(t.learnerId),
    index('submissions_assignment_idx').on(t.assignmentId),
  ],
)

/** Rolled-up per learner per section — what the Pace signal reads. */
export const courseProgress = pgTable(
  'course_progress',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id),
    lessonsTotal: integer('lessons_total').notNull(),
    lessonsComplete: integer('lessons_complete').notNull(),
    /** Percent of the course the calendar says they should have finished. */
    expectedPct: real('expected_pct').notNull(),
    /** Percent they actually have finished. */
    actualPct: real('actual_pct').notNull(),
    currentGrade: real('current_grade'),
    asOf: date('as_of', { mode: 'string' }).notNull(),
  },
  (t) => [index('course_progress_learner_idx').on(t.learnerId)],
)

// ─────────────────────────────────────────────────────────────────────────────
// Engagement — the virtual-school attendance evidence table
// ─────────────────────────────────────────────────────────────────────────────

export const dailyEngagement = pgTable(
  'daily_engagement',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    day: date('day', { mode: 'string' }).notNull(),
    loggedIn: boolean('logged_in').notNull().default(false),
    activeMinutes: integer('active_minutes').notNull().default(0),
    lessonsTouched: integer('lessons_touched').notNull().default(0),
    liveSessionsScheduled: integer('live_sessions_scheduled')
      .notNull()
      .default(0),
    liveSessionsAttended: integer('live_sessions_attended').notNull().default(0),
    /** Documented instructional contact — the other half of virtual FTE. */
    contactLogged: boolean('contact_logged').notNull().default(false),
  },
  (t) => [index('daily_engagement_learner_day_idx').on(t.learnerId, t.day)],
)

// ─────────────────────────────────────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────────────────────────────────────

export const assessments = pgTable('assessments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  kind: text('kind')
    .$type<'universal_screener' | 'benchmark' | 'progress_monitor'>()
    .notNull(),
})

export const assessmentResults = pgTable(
  'assessment_results',
  {
    id: text('id').primaryKey(),
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    administeredOn: date('administered_on', { mode: 'string' }).notNull(),
    scaleScore: integer('scale_score').notNull(),
    percentile: integer('percentile').notNull(),
    benchmarkStatus: text('benchmark_status')
      .$type<'above' | 'at' | 'below' | 'well_below'>()
      .notNull(),
  },
  (t) => [index('assessment_results_learner_idx').on(t.learnerId)],
)

// ─────────────────────────────────────────────────────────────────────────────
// Curriculum
// ─────────────────────────────────────────────────────────────────────────────

export const standards = pgTable('standards', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  description: text('description').notNull(),
  subject: text('subject').notNull(),
  gradeLevel: integer('grade_level').notNull(),
})

export const units = pgTable(
  'units',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    title: text('title').notNull(),
    sequence: integer('sequence').notNull(),
    weeks: integer('weeks').notNull(),
  },
  (t) => [index('units_course_idx').on(t.courseId)],
)

export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    title: text('title').notNull(),
    sequence: integer('sequence').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
  },
  (t) => [index('lessons_unit_idx').on(t.unitId)],
)

export const lessonStandards = pgTable('lesson_standards', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id')
    .notNull()
    .references(() => lessons.id),
  standardId: text('standard_id')
    .notNull()
    .references(() => standards.id),
})

/** Planned vs. actual delivery of a unit inside one section. */
export const pacing = pgTable(
  'pacing',
  {
    id: text('id').primaryKey(),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    plannedStartOn: date('planned_start_on', { mode: 'string' }).notNull(),
    plannedEndOn: date('planned_end_on', { mode: 'string' }).notNull(),
    actualPct: real('actual_pct').notNull().default(0),
  },
  (t) => [index('pacing_section_idx').on(t.sectionId)],
)

export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind')
    .$type<'reading' | 'video' | 'practice' | 'intervention' | 'assessment'>()
    .notNull(),
  subject: text('subject').notNull(),
  gradeBand: text('grade_band').notNull(),
  standardId: text('standard_id').references(() => standards.id),
  /** Openly licensed materials only in this prototype. */
  license: text('license').notNull().default('CC BY 4.0'),
})

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tiered system of supports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Engagement / Pace / Performance composite. Each component is 0–100 where
 * higher is healthier; `composite` is the weighted blend and drives `tier`.
 */
export const riskScores = pgTable(
  'risk_scores',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    asOf: date('as_of', { mode: 'string' }).notNull(),
    engagement: real('engagement').notNull(),
    pace: real('pace').notNull(),
    performance: real('performance').notNull(),
    composite: real('composite').notNull(),
    tier: integer('tier').$type<Tier>().notNull(),
    /** Change in composite vs. the prior week. */
    trend: real('trend').notNull().default(0),
    /** Which signal is dragging the composite down most. */
    topDriver: text('top_driver')
      .$type<'engagement' | 'pace' | 'performance'>()
      .notNull(),
    daysSinceLastLogin: integer('days_since_last_login').notNull().default(0),
  },
  (t) => [index('risk_scores_learner_asof_idx').on(t.learnerId, t.asOf)],
)

export const referrals = pgTable(
  'referrals',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    raisedByUserId: text('raised_by_user_id')
      .notNull()
      .references(() => users.id),
    raisedOn: date('raised_on', { mode: 'string' }).notNull(),
    category: text('category')
      .$type<
        | 'engagement'
        | 'academic'
        | 'pace'
        | 'connectivity'
        | 'wellbeing'
        | 'kudos'
      >()
      .notNull(),
    reason: text('reason').notNull(),
    status: text('status')
      .$type<'new' | 'acknowledged' | 'in_progress' | 'resolved'>()
      .notNull()
      .default('new'),
    note: text('note'),
  },
  (t) => [
    index('referrals_learner_idx').on(t.learnerId),
    index('referrals_status_idx').on(t.status),
  ],
)

export const interventionPlans = pgTable(
  'intervention_plans',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    tier: integer('tier').$type<Tier>().notNull(),
    focus: text('focus').notNull(),
    startedOn: date('started_on', { mode: 'string' }).notNull(),
    reviewOn: date('review_on', { mode: 'string' }).notNull(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    status: text('status')
      .$type<'active' | 'monitoring' | 'exited'>()
      .notNull()
      .default('active'),
  },
  (t) => [index('intervention_plans_learner_idx').on(t.learnerId)],
)

export const planGoals = pgTable(
  'plan_goals',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => interventionPlans.id),
    description: text('description').notNull(),
    metric: text('metric').notNull(),
    baseline: real('baseline').notNull(),
    target: real('target').notNull(),
  },
  (t) => [index('plan_goals_plan_idx').on(t.planId)],
)

/** Progress-monitoring data points — plotted against the goal line. */
export const progressPoints = pgTable(
  'progress_points',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => planGoals.id),
    measuredOn: date('measured_on', { mode: 'string' }).notNull(),
    value: real('value').notNull(),
  },
  (t) => [index('progress_points_goal_idx').on(t.goalId)],
)

export const interventionSessions = pgTable(
  'intervention_sessions',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => interventionPlans.id),
    heldOn: date('held_on', { mode: 'string' }).notNull(),
    minutes: integer('minutes').notNull(),
    staffUserId: text('staff_user_id')
      .notNull()
      .references(() => users.id),
    /** Fidelity of implementation — did the support actually happen as designed. */
    fidelity: text('fidelity')
      .$type<'as_planned' | 'partial' | 'missed'>()
      .notNull(),
    note: text('note'),
  },
  (t) => [index('intervention_sessions_plan_idx').on(t.planId)],
)

/**
 * Outreach attempts. In a virtual program this is first-class: reaching the
 * guardian is often the intervention, and response rate is itself a signal.
 */
export const outreach = pgTable(
  'outreach',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    byUserId: text('by_user_id')
      .notNull()
      .references(() => users.id),
    at: timestamp('at', { mode: 'date' }).notNull(),
    channel: text('channel')
      .$type<'call' | 'email' | 'sms' | 'video' | 'message'>()
      .notNull(),
    audience: text('audience').$type<'learner' | 'guardian'>().notNull(),
    outcome: text('outcome')
      .$type<'connected' | 'left_message' | 'no_answer' | 'replied' | 'bounced'>()
      .notNull(),
    note: text('note'),
  },
  (t) => [index('outreach_learner_idx').on(t.learnerId)],
)

/**
 * Device / connectivity triage. In a virtual school "at risk" sometimes just
 * means the laptop died — and no conventional dashboard surfaces that.
 */
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id),
    openedOn: date('opened_on', { mode: 'string' }).notNull(),
    category: text('category')
      .$type<'device' | 'connectivity' | 'platform_access' | 'materials'>()
      .notNull(),
    status: text('status')
      .$type<'open' | 'awaiting_family' | 'resolved'>()
      .notNull()
      .default('open'),
    note: text('note'),
  },
  (t) => [index('support_tickets_learner_idx').on(t.learnerId)],
)

// ─────────────────────────────────────────────────────────────────────────────
// Portal configuration
// ─────────────────────────────────────────────────────────────────────────────

/** One placed tile in a layout document. */
export type LayoutItem = {
  /** Widget type key — must exist in the client widget registry. */
  type: string
  /** Column span on a 12-column grid. */
  span: number
  /** Set by a role template; the user cannot remove it. */
  locked?: boolean
  /**
   * Set when the user has removed the tile. Removals are recorded rather than
   * inferred from absence: a tile missing from a user's layout is ambiguous
   * between "they removed it" and "an administrator added it to the role
   * template after they personalised", and those two cases need opposite
   * behaviour.
   */
  hidden?: boolean
  /** Per-instance widget settings. */
  config?: Record<string, unknown>
}

/** Seeded default view per persona. */
export const roleLayouts = pgTable('role_layouts', {
  role: text('role').$type<Role>().primaryKey(),
  items: jsonb('items').$type<LayoutItem[]>().notNull(),
})

/** A user's personalization, overlaid on their role template. */
export const userLayouts = pgTable('user_layouts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  items: jsonb('items').$type<LayoutItem[]>().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

/**
 * Record of access to an individual learner's records, shaped after the
 * disclosure record FERPA § 99.32 contemplates. Written by the data access
 * layer, not by callers, so it cannot be forgotten at a call site.
 */
export const accessLog = pgTable(
  'access_log',
  {
    id: text('id').primaryKey(),
    at: timestamp('at', { mode: 'date' }).notNull().defaultNow(),
    actorUserId: text('actor_user_id').notNull(),
    actorRole: text('actor_role').$type<Role>().notNull(),
    subjectLearnerId: text('subject_learner_id').notNull(),
    /** Legitimate educational interest asserted for the access. */
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull(),
  },
  (t) => [
    index('access_log_subject_idx').on(t.subjectLearnerId),
    index('access_log_actor_idx').on(t.actorUserId),
  ],
)

/** Backs the integration-health tile. One row per mocked source system. */
export const integrationSources = pgTable('integration_sources', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  category: text('category')
    .$type<'sis' | 'lms' | 'mtss' | 'curriculum' | 'identity'>()
    .notNull(),
  status: text('status')
    .$type<'healthy' | 'degraded' | 'failed'>()
    .notNull()
    .default('healthy'),
  lastSyncAt: timestamp('last_sync_at', { mode: 'date' }).notNull(),
  recordCount: integer('record_count').notNull().default(0),
  note: text('note'),
})
