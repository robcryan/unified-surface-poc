/**
 * Provider interfaces for the four source systems the surface federates.
 *
 * The prototype ships one mock implementation of each, reading the seeded
 * database. Swapping in a real connector means writing another implementation
 * of the same interface and changing the wiring in `./index.ts` — the widgets,
 * the data access layer and the UI never learn where the data came from.
 *
 * Source systems are named by *function* rather than by vendor, deliberately.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared DTOs
// ─────────────────────────────────────────────────────────────────────────────

export type LearnerRecord = {
  id: string
  userId: string
  givenName: string
  familyName: string
  fullName: string
  gradeLevel: number
  stateId: string
  pathway: 'full_time' | 'supplemental'
  orgId: string
  counselorUserId: string | null
}

export type EngagementDay = {
  day: string
  loggedIn: boolean
  activeMinutes: number
  lessonsTouched: number
  liveSessionsScheduled: number
  liveSessionsAttended: number
}

export type SectionSummary = {
  id: string
  name: string
  courseTitle: string
  subject: string
  cadence: string
  enrolledCount: number
}

export type SectionProgress = {
  sectionId: string
  sectionName: string
  courseTitle: string
  subject: string
  teacherName: string
  lessonsComplete: number
  lessonsTotal: number
  expectedPct: number
  actualPct: number
  currentGrade: number | null
}

export type WorkItem = {
  id: string
  title: string
  courseTitle: string
  dueOn: string
  kind: string
  status: 'graded' | 'submitted' | 'late' | 'missing' | 'not_started' | 'upcoming'
  score: number | null
}

export type GradebookHealth = {
  sectionId: string
  sectionName: string
  courseTitle: string
  learners: number
  avgGrade: number
  missingCount: number
  belowPassing: number
}

export type RiskSnapshot = {
  learnerId: string
  asOf: string
  engagement: number
  pace: number
  performance: number
  composite: number
  tier: 1 | 2 | 3
  trend: number
  topDriver: 'engagement' | 'pace' | 'performance'
  daysSinceLastLogin: number
}

export type RiskWithLearner = RiskSnapshot & {
  learner: LearnerRecord
  hasOpenTicket: boolean
}

export type ReferralItem = {
  id: string
  learnerId: string
  learnerName: string
  raisedByName: string
  raisedOn: string
  category: string
  reason: string
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved'
}

export type PlanDetail = {
  id: string
  learnerId: string
  tier: 1 | 2 | 3
  focus: string
  startedOn: string
  reviewOn: string
  ownerName: string
  status: string
  goals: {
    id: string
    description: string
    metric: string
    baseline: number
    target: number
    points: { measuredOn: string; value: number }[]
  }[]
  sessions: {
    heldOn: string
    minutes: number
    fidelity: 'as_planned' | 'partial' | 'missed'
  }[]
}

export type OutreachItem = {
  id: string
  learnerId: string
  learnerName: string
  at: Date
  channel: string
  audience: 'learner' | 'guardian'
  outcome: string
  byName: string
}

export type SupportTicketItem = {
  id: string
  learnerId: string
  learnerName: string
  openedOn: string
  category: 'device' | 'connectivity' | 'platform_access' | 'materials'
  status: 'open' | 'awaiting_family' | 'resolved'
  note: string | null
}

// ── Gradebook (LMS write surface) ────────────────────────────────────────────

export type GradebookAssignment = {
  id: string
  title: string
  dueOn: string
  points: number
  kind: string
}

export type GradebookCell = {
  assignmentId: string
  submissionId: string | null
  score: number | null
  status: 'graded' | 'submitted' | 'late' | 'missing' | 'not_started'
}

export type GradebookRow = {
  learnerId: string
  learnerName: string
  gradeLevel: number
  currentGrade: number | null
  cells: GradebookCell[]
}

export type Gradebook = {
  sectionId: string
  sectionName: string
  courseTitle: string
  teacherName: string
  assignments: GradebookAssignment[]
  rows: GradebookRow[]
}

// ── Roster (SIS write surface) ───────────────────────────────────────────────

export type RosterEntry = {
  enrollmentId: string
  learnerId: string
  learnerName: string
  gradeLevel: number
  stateId: string
  startedOn: string
  status: 'active' | 'withdrawn' | 'completed'
}

export type SectionRoster = {
  sectionId: string
  sectionName: string
  courseTitle: string
  termName: string
  cadence: string
  entries: RosterEntry[]
}

export type UnitProgress = {
  sectionId: string
  sectionName: string
  unitTitle: string
  plannedStartOn: string
  plannedEndOn: string
  actualPct: number
  expectedPct: number
}

export type ResourceItem = {
  id: string
  title: string
  kind: string
  subject: string
  license: string
  standardCode: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Enrollment & Records — the system of record for people and enrollment. */
export interface SisProvider {
  readonly key: 'sis'
  getLearner(learnerId: string): Promise<LearnerRecord | null>
  listLearners(learnerIds: string[]): Promise<LearnerRecord[]>
  listLearnerIdsByCounselor(counselorUserId: string): Promise<string[]>
  listLearnerIdsByTeacher(teacherUserId: string): Promise<string[]>
  listLearnerIdsByGuardian(guardianUserId: string): Promise<string[]>
  listAllLearnerIds(): Promise<string[]>
  getLearnerIdForUser(userId: string): Promise<string | null>
  getEngagementWindow(learnerId: string, days: number): Promise<EngagementDay[]>
  getProgramEngagementTrend(
    learnerIds: string[],
    weeks: number,
  ): Promise<{ weekOf: string; loginRate: number; liveAttendanceRate: number }[]>
  listSectionsForUser(
    userId: string,
    role: string,
  ): Promise<{ id: string; label: string }[]>

  // ── Writes ────────────────────────────────────────────────────────────────
  getSectionRoster(sectionId: string): Promise<SectionRoster | null>
  /** Learners not currently enrolled in this section, for the add picker. */
  searchEnrollableLearners(
    sectionId: string,
    query: string,
    limit: number,
  ): Promise<LearnerRecord[]>
  /** Enrol, or reactivate a previously withdrawn enrolment. */
  enrolLearner(sectionId: string, learnerId: string): Promise<void>
  /** Withdraw rather than delete — an SIS keeps the history. */
  withdrawEnrolment(enrollmentId: string): Promise<void>
}

/** Learning Platform — coursework, gradebook and completion. */
export interface LmsProvider {
  readonly key: 'lms'
  listSectionsForTeacher(teacherUserId: string): Promise<SectionSummary[]>
  listSectionProgress(learnerId: string): Promise<SectionProgress[]>
  listWork(learnerId: string, limit: number): Promise<WorkItem[]>
  getGradebookHealth(teacherUserId: string): Promise<GradebookHealth[]>
  countMissingWork(learnerIds: string[]): Promise<Map<string, number>>

  // ── Writes ────────────────────────────────────────────────────────────────
  /** Full grid for one section: assignments across, learners down. */
  getGradebook(sectionId: string): Promise<Gradebook | null>
  /**
   * Record a score. Passing `null` clears it back to missing. Returns the
   * learner's recomputed course grade so the caller can reflect the knock-on
   * effect without a round trip.
   */
  setScore(
    sectionId: string,
    assignmentId: string,
    learnerId: string,
    score: number | null,
  ): Promise<{ currentGrade: number | null }>
  /** Add an assignment to a section. */
  createAssignment(
    sectionId: string,
    input: { title: string; dueOn: string; points: number; kind: string },
  ): Promise<string>
}

/** Student Supports — the MTSS layer: risk, referrals, plans, outreach. */
export interface MtssProvider {
  readonly key: 'mtss'
  getRisk(learnerId: string): Promise<RiskSnapshot | null>
  getRiskHistory(learnerId: string): Promise<RiskSnapshot[]>
  listRisk(learnerIds: string[]): Promise<RiskWithLearner[]>
  listReferrals(learnerIds: string[], limit: number): Promise<ReferralItem[]>
  listPlans(learnerId: string): Promise<PlanDetail[]>
  listOutreach(learnerIds: string[], limit: number): Promise<OutreachItem[]>
  listSupportTickets(learnerIds: string[]): Promise<SupportTicketItem[]>
  getTierDistribution(
    learnerIds: string[],
  ): Promise<{ tier: 1 | 2 | 3; count: number }[]>
  getTierMovement(
    learnerIds: string[],
    weeks: number,
  ): Promise<{ weekOf: string; tier1: number; tier2: number; tier3: number }[]>
  getInterventionEffectiveness(
    learnerIds: string[],
  ): Promise<{ improving: number; flat: number; declining: number }>
}

/** Curriculum Library — units, pacing, standards and openly licensed materials. */
export interface CurriculumProvider {
  readonly key: 'curriculum'
  getPacingForTeacher(teacherUserId: string): Promise<UnitProgress[]>
  getPacingAcrossProgram(limit: number): Promise<UnitProgress[]>
  getCurrentMaterials(learnerId: string): Promise<
    { courseTitle: string; unitTitle: string; lessons: string[] }[]
  >
  listResourcesFor(subject: string | null, limit: number): Promise<ResourceItem[]>
}

/** Integration health, surfaced on the administrator view. */
export type IntegrationStatus = {
  key: string
  label: string
  category: string
  status: 'healthy' | 'degraded' | 'failed'
  lastSyncAt: Date
  recordCount: number
  note: string | null
}
