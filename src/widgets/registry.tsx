import type { ComponentType } from 'react'

import type { CurrentUser } from '@/data/auth'
import type { Role } from '@/db/schema'

import * as LF from './learner-family'
import * as ST from './staff'

/**
 * The four source systems this surface federates, plus the cross-system case.
 * Every tile declares which one it draws from — that is what the chip in the
 * tile header shows, and how the tile catalog is grouped.
 */
export type SourceSystem =
  | 'SIS'
  | 'LMS'
  | 'Early Intervention'
  | 'Course Content'
  | 'Cross-system'

export const SOURCE_ORDER: SourceSystem[] = [
  'Cross-system',
  'SIS',
  'LMS',
  'Early Intervention',
  'Course Content',
]

export const SOURCE_BLURB: Record<SourceSystem, string> = {
  'Cross-system': 'Composed from more than one system — cannot come from any single one',
  SIS: 'Enrollment & records',
  LMS: 'Learning platform',
  'Early Intervention': 'Student supports and MTSS',
  'Course Content': 'Curriculum library',
}

export type WidgetDef = {
  title: string
  subtitle?: string
  source: SourceSystem
  /** Roles that can place this tile. Data is scoped separately, in the DAL. */
  roles: Role[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>
}

const ALL_STAFF: Role[] = ['teacher', 'counselor', 'administrator']

/**
 * The widget registry — the catalog a user picks from.
 *
 * Role lists here control *placement*, not data access: `src/data/scope.ts`
 * already limits every widget to the learners the signed-in user may see, so a
 * teacher placing "Watchlist" sees their own sections, not the whole program.
 * That is why most staff tiles are available to all staff roles rather than
 * being locked to one persona.
 */
export const WIDGETS: Record<string, WidgetDef> = {
  // ── Learner ────────────────────────────────────────────────────────────────
  myWork: {
    title: 'What needs doing',
    subtitle: 'Missing work first, then what is coming up',
    source: 'LMS',
    roles: ['student'],
    Component: LF.MyWork,
  },
  myPace: {
    title: 'My pace',
    subtitle: 'Completion against the calendar',
    source: 'Cross-system',
    roles: ['student'],
    Component: LF.MyPace,
  },
  myGrades: {
    title: 'My courses',
    subtitle: 'Grade and lesson progress per course',
    source: 'LMS',
    roles: ['student'],
    Component: LF.MyGrades,
  },
  myGoals: {
    title: 'What I am working on',
    subtitle: 'Support goal and progress',
    source: 'Early Intervention',
    roles: ['student'],
    Component: LF.MyGoals,
  },
  courseMaterials: {
    title: 'This week’s material',
    subtitle: 'Current unit in each course',
    source: 'Course Content',
    roles: ['student'],
    Component: LF.CourseMaterials,
  },
  getHelp: {
    title: 'Get help',
    subtitle: 'Reach a teacher, a counselor, or technology support',
    source: 'Early Intervention',
    roles: ['student'],
    Component: LF.GetHelp,
  },

  // ── Staff ──────────────────────────────────────────────────────────────────
  needsAttention: {
    title: 'Needs your attention',
    subtitle: 'Ranked action list drawn from all four systems',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.NeedsAttention,
  },
  watchlist: {
    title: 'Watchlist',
    subtitle: 'Lowest composite first — who to work today',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.Watchlist,
  },
  caseloadOverview: {
    title: 'Caseload overview',
    subtitle: 'Headcount and tier split',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.CaseloadOverview,
  },
  atRiskInSections: {
    title: 'Flagged learners',
    subtitle: 'Engagement, pace and performance combined',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.AtRiskInSections,
  },
  programHealth: {
    title: 'Program health',
    subtitle: 'Headline indicators as of today',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.ProgramHealth,
  },
  supportTickets: {
    title: 'Device & connectivity',
    subtitle: 'Engagement problems that are not motivation problems',
    source: 'Cross-system',
    roles: ALL_STAFF,
    Component: ST.SupportTickets,
  },
  mySections: {
    title: 'My sections',
    subtitle: 'Courses I teach and enrolment counts',
    source: 'SIS',
    roles: ['teacher'],
    Component: ST.MySections,
  },
  engagementTrend: {
    title: 'Engagement trend',
    subtitle: 'Weekly login and live-session participation',
    source: 'SIS',
    roles: ALL_STAFF,
    Component: ST.EngagementTrend,
  },
  gradebookHealth: {
    title: 'Gradebook health',
    subtitle: 'Averages, missing work and learners below passing',
    source: 'LMS',
    roles: ['teacher'],
    Component: ST.GradebookHealth,
  },
  referralInbox: {
    title: 'Referral inbox',
    subtitle: 'Raised by teachers and by the early-warning model',
    source: 'Early Intervention',
    roles: ALL_STAFF,
    Component: ST.ReferralInbox,
  },
  progressMonitoring: {
    title: 'Progress monitoring',
    subtitle: 'Goal line against actual, next review due',
    source: 'Early Intervention',
    roles: ALL_STAFF,
    Component: ST.ProgressMonitoring,
  },
  outreachQueue: {
    title: 'Outreach log',
    subtitle: 'Contact with learners and families',
    source: 'Early Intervention',
    roles: ALL_STAFF,
    Component: ST.OutreachQueue,
  },
  tierDistribution: {
    title: 'Tier distribution',
    subtitle: 'Where learners sit in the support model',
    source: 'Early Intervention',
    roles: ALL_STAFF,
    Component: ST.TierDistribution,
  },
  interventionEffectiveness: {
    title: 'Is intervention working?',
    subtitle: 'Composite change since a plan was opened',
    source: 'Early Intervention',
    roles: ALL_STAFF,
    Component: ST.InterventionEffectiveness,
  },
  pacingStatus: {
    title: 'Pacing against plan',
    subtitle: 'Current unit in each of my sections',
    source: 'Course Content',
    roles: ['teacher'],
    Component: ST.PacingStatus,
  },
  pacingAcrossSections: {
    title: 'Sections furthest behind pace',
    subtitle: 'Programme-wide curriculum delivery',
    source: 'Course Content',
    roles: ['counselor', 'administrator'],
    Component: ST.PacingAcrossSections,
  },
  integrationHealth: {
    title: 'Integration health',
    subtitle: 'Sync status of the four source systems',
    source: 'Cross-system',
    roles: ['administrator'],
    Component: ST.IntegrationHealth,
  },

  // ── Parent / Guardian ──────────────────────────────────────────────────────
  myLearners: {
    title: 'My learners',
    subtitle: 'Signals for each of my children',
    source: 'Cross-system',
    roles: ['guardian'],
    Component: LF.MyLearners,
  },
  weeklySnapshot: {
    title: 'This week',
    subtitle: 'Daily activity across the last school week',
    source: 'SIS',
    roles: ['guardian'],
    Component: LF.WeeklySnapshot,
  },
  whatWereWorkingOn: {
    title: 'What we are working on',
    subtitle: 'Support plans in plain language',
    source: 'Early Intervention',
    roles: ['guardian'],
    Component: LF.WhatWereWorkingOn,
  },
  upcomingWork: {
    title: 'Work due',
    subtitle: 'Missing and upcoming assignments',
    source: 'LMS',
    roles: ['guardian'],
    Component: LF.UpcomingWork,
  },
  supportStatus: {
    title: 'Requests & contact',
    subtitle: 'Open technology requests and recent contact',
    source: 'Early Intervention',
    roles: ['guardian'],
    Component: LF.SupportStatus,
  },
}

export function widgetFor(type: string): WidgetDef | null {
  return WIDGETS[type] ?? null
}

/** Everything this role is allowed to place, in catalog order. */
export function catalogForRole(role: Role) {
  return Object.entries(WIDGETS)
    .filter(([, def]) => def.roles.includes(role))
    .map(([type, def]) => ({
      type,
      title: def.title,
      subtitle: def.subtitle ?? '',
      source: def.source,
    }))
    .sort(
      (a, b) =>
        SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
        a.title.localeCompare(b.title),
    )
}

export type { CurrentUser }
