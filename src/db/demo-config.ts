/**
 * Demo constants shared by the seed and the UI.
 *
 * Everything here is fictional. The organization, staff, learners and vendor
 * names below do not refer to any real school, person, or product.
 */

export const DISTRICT_NAME = 'Meridian Virtual Academy'

/**
 * The five demo sign-ins shown on the login screen. Passwords are cosmetic —
 * the prototype checks the email against this list and nothing else.
 */
export const DEMO_PASSWORD = 'demo'

/**
 * The five accounts offered on the sign-in screen. IDs are deterministic
 * because the seed assigns them; the screen loads names and emails from the
 * database so it can never drift from the seeded data.
 *
 * `usr_lrn_0003` is Aisha Bello — the third entry in STORY_LEARNERS.
 */
export const DEMO_ACCOUNTS: {
  userId: string
  blurb: string
}[] = [
  {
    userId: 'usr_lrn_0003',
    blurb: 'Grade 11 learner. Logs in daily and is passing, but well behind pace.',
  },
  {
    userId: 'usr_priya',
    blurb: 'High school mathematics. Six sections, four of them with flagged learners.',
  },
  {
    userId: 'usr_andre',
    blurb: 'Intervention specialist. Caseload spans both programs.',
  },
  {
    userId: 'usr_lena',
    blurb: 'Program administrator. Whole-program view plus integration health.',
  },
  {
    userId: 'usr_carmen',
    blurb: 'Parent of two learners, grades 7 and 10.',
  },
]

/**
 * Source systems the surface federates. Deliberately named by *function*, not
 * by vendor: the point of the prototype is that these are integration
 * categories behind one interface.
 */
export const INTEGRATION_SOURCES = [
  {
    key: 'sis',
    label: 'Enrollment & Records',
    category: 'sis' as const,
    status: 'healthy' as const,
    syncMinutesAgo: 4,
    note: 'Nightly roster delta plus on-demand enrollment reads.',
  },
  {
    key: 'lms',
    label: 'Learning Platform',
    category: 'lms' as const,
    status: 'healthy' as const,
    syncMinutesAgo: 11,
    note: 'Gradebook, submissions and course progress.',
  },
  {
    key: 'mtss',
    label: 'Student Supports',
    category: 'mtss' as const,
    status: 'healthy' as const,
    syncMinutesAgo: 2,
    note: 'Referrals, plans, progress monitoring and outreach.',
  },
  {
    key: 'curriculum',
    label: 'Curriculum Library',
    category: 'curriculum' as const,
    status: 'degraded' as const,
    syncMinutesAgo: 186,
    note: 'Standards alignment refresh is running behind schedule.',
  },
  {
    key: 'identity',
    label: 'Identity & Rostering',
    category: 'identity' as const,
    status: 'healthy' as const,
    syncMinutesAgo: 7,
    note: 'Single sign-on and daily roster provisioning.',
  },
]

/**
 * Behavioural archetypes that drive generation. The early-warning scores are
 * *computed* from the generated engagement/progress/submission rows rather
 * than assigned, so every view reconciles with every other view.
 */
export type Archetype =
  | 'thriving'
  | 'steady'
  | 'slipping_pace'
  | 'slipping_performance'
  | 'disengaging'
  | 'connectivity'
  | 'recovering'

export const ARCHETYPE_MIX: { archetype: Archetype; weight: number }[] = [
  { archetype: 'thriving', weight: 46 },
  { archetype: 'steady', weight: 27 },
  { archetype: 'slipping_pace', weight: 9 },
  { archetype: 'slipping_performance', weight: 7 },
  { archetype: 'disengaging', weight: 5 },
  { archetype: 'connectivity', weight: 3 },
  { archetype: 'recovering', weight: 3 },
]

/**
 * The six learners whose data threads through every persona view. These are
 * the demo script: each one exists to make a different point.
 */
export const STORY_LEARNERS: {
  key: string
  givenName: string
  familyName: string
  gradeLevel: number
  archetype: Archetype
  /** What this learner demonstrates, shown in the README demo script. */
  demonstrates: string
}[] = [
  {
    key: 'maya',
    givenName: 'Maya',
    familyName: 'Okonkwo',
    gradeLevel: 9,
    archetype: 'disengaging',
    demonstrates:
      'Classic virtual disengagement — six days since last login. Engagement collapse leads the composite before grades have moved.',
  },
  {
    key: 'diego',
    givenName: 'Diego',
    familyName: 'Ramirez',
    gradeLevel: 7,
    archetype: 'connectivity',
    demonstrates:
      'Looks like disengagement, is actually a dead laptop. Open device ticket reframes the intervention.',
  },
  {
    key: 'aisha',
    givenName: 'Aisha',
    familyName: 'Bello',
    gradeLevel: 11,
    archetype: 'slipping_pace',
    demonstrates:
      'Logs in every day and grades are fine, but is 20+ points behind pace. The signal no attendance model catches.',
  },
  {
    key: 'tyler',
    givenName: 'Tyler',
    familyName: 'Novak',
    gradeLevel: 9,
    archetype: 'slipping_performance',
    demonstrates:
      'Engaged and on pace, but math grades sliding. Has an active plan with progress-monitoring data trending up.',
  },
  {
    key: 'grace',
    givenName: 'Grace',
    familyName: 'Lindqvist',
    gradeLevel: 10,
    archetype: 'recovering',
    demonstrates:
      'Was Tier 3 eight weeks ago, now Tier 1. The intervention-worked story, visible in the trend.',
  },
  {
    key: 'sam',
    givenName: 'Sam',
    familyName: 'Whitaker',
    gradeLevel: 6,
    archetype: 'thriving',
    demonstrates:
      'Healthy baseline, with a kudos referral. Proves the system surfaces more than problems.',
  },
]

/** Scoring weights for the Engagement / Pace / Performance composite. */
export const COMPOSITE_WEIGHTS = {
  engagement: 0.4,
  pace: 0.3,
  performance: 0.3,
} as const

export function tierFor(composite: number): 1 | 2 | 3 {
  if (composite >= 75) return 1
  if (composite >= 55) return 2
  return 3
}

export const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Tier 1 — Core',
  2: 'Tier 2 — Targeted',
  3: 'Tier 3 — Intensive',
}
