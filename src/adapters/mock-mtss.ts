import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '@/db/client'
import * as s from '@/db/schema'

/** `users` joined a second time to resolve the learner's own name. */
const learnerUser = alias(s.users, 'learner_user')

import type {
  MtssProvider,
  OutreachItem,
  PlanDetail,
  ReferralItem,
  RiskSnapshot,
  RiskWithLearner,
  SupportTicketItem,
} from './types'

/** The most recent snapshot date present in the data. */
async function latestAsOf(): Promise<string | null> {
  const rows = await db
    .select({ asOf: sql<string>`max(${s.riskScores.asOf})` })
    .from(s.riskScores)
  return rows[0]?.asOf ?? null
}

function toSnapshot(r: typeof s.riskScores.$inferSelect): RiskSnapshot {
  return {
    learnerId: r.learnerId,
    asOf: r.asOf,
    engagement: r.engagement,
    pace: r.pace,
    performance: r.performance,
    composite: r.composite,
    tier: r.tier,
    trend: r.trend,
    topDriver: r.topDriver,
    daysSinceLastLogin: r.daysSinceLastLogin,
  }
}

export const mockMtss: MtssProvider = {
  key: 'mtss',

  async getRisk(learnerId) {
    const rows = await db
      .select()
      .from(s.riskScores)
      .where(eq(s.riskScores.learnerId, learnerId))
      .orderBy(desc(s.riskScores.asOf))
      .limit(1)
    return rows.length ? toSnapshot(rows[0]) : null
  },

  async getRiskHistory(learnerId) {
    const rows = await db
      .select()
      .from(s.riskScores)
      .where(eq(s.riskScores.learnerId, learnerId))
      .orderBy(asc(s.riskScores.asOf))
    return rows.map(toSnapshot)
  },

  async listRisk(learnerIds): Promise<RiskWithLearner[]> {
    if (!learnerIds.length) return []
    const asOf = await latestAsOf()
    if (!asOf) return []

    const rows = await db
      .select({
        risk: s.riskScores,
        learner: s.learners,
        user: s.users,
      })
      .from(s.riskScores)
      .innerJoin(s.learners, eq(s.learners.id, s.riskScores.learnerId))
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(
        and(
          inArray(s.riskScores.learnerId, learnerIds),
          eq(s.riskScores.asOf, asOf),
        ),
      )
      .orderBy(asc(s.riskScores.composite))

    const openTickets = await db
      .select({ learnerId: s.supportTickets.learnerId })
      .from(s.supportTickets)
      .where(
        and(
          inArray(s.supportTickets.learnerId, learnerIds),
          sql`${s.supportTickets.status} <> 'resolved'`,
        ),
      )
    const ticketSet = new Set(openTickets.map((t) => t.learnerId))

    return rows.map((r) => ({
      ...toSnapshot(r.risk),
      hasOpenTicket: ticketSet.has(r.risk.learnerId),
      learner: {
        id: r.learner.id,
        userId: r.user.id,
        givenName: r.user.givenName,
        familyName: r.user.familyName,
        fullName: `${r.user.givenName} ${r.user.familyName}`,
        gradeLevel: r.learner.gradeLevel,
        stateId: r.learner.stateId,
        pathway: r.learner.pathway,
        orgId: r.learner.orgId,
        counselorUserId: r.learner.counselorUserId,
      },
    }))
  },

  async listReferrals(learnerIds, limit): Promise<ReferralItem[]> {
    if (!learnerIds.length) return []

    const rows = await db
      .select({
        id: s.referrals.id,
        learnerId: s.referrals.learnerId,
        raisedOn: s.referrals.raisedOn,
        category: s.referrals.category,
        reason: s.referrals.reason,
        status: s.referrals.status,
        raisedByGiven: s.users.givenName,
        raisedByFamily: s.users.familyName,
        learnerGiven: learnerUser.givenName,
        learnerFamily: learnerUser.familyName,
      })
      .from(s.referrals)
      .innerJoin(s.users, eq(s.users.id, s.referrals.raisedByUserId))
      .innerJoin(s.learners, eq(s.learners.id, s.referrals.learnerId))
      .innerJoin(learnerUser, eq(learnerUser.id, s.learners.userId))
      .where(inArray(s.referrals.learnerId, learnerIds))
      .orderBy(desc(s.referrals.raisedOn))
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      learnerId: r.learnerId,
      learnerName: `${r.learnerGiven} ${r.learnerFamily}`,
      raisedByName: `${r.raisedByGiven} ${r.raisedByFamily}`,
      raisedOn: r.raisedOn,
      category: r.category,
      reason: r.reason,
      status: r.status,
    }))
  },

  async listPlans(learnerId): Promise<PlanDetail[]> {
    const plans = await db
      .select({ plan: s.interventionPlans, owner: s.users })
      .from(s.interventionPlans)
      .innerJoin(s.users, eq(s.users.id, s.interventionPlans.ownerUserId))
      .where(eq(s.interventionPlans.learnerId, learnerId))
      .orderBy(desc(s.interventionPlans.startedOn))

    if (!plans.length) return []
    const planIds = plans.map((p) => p.plan.id)

    const goals = await db
      .select()
      .from(s.planGoals)
      .where(inArray(s.planGoals.planId, planIds))

    const goalIds = goals.map((g) => g.id)
    const points = goalIds.length
      ? await db
          .select()
          .from(s.progressPoints)
          .where(inArray(s.progressPoints.goalId, goalIds))
          .orderBy(asc(s.progressPoints.measuredOn))
      : []

    const sessions = await db
      .select()
      .from(s.interventionSessions)
      .where(inArray(s.interventionSessions.planId, planIds))
      .orderBy(desc(s.interventionSessions.heldOn))

    return plans.map(({ plan, owner }) => ({
      id: plan.id,
      learnerId: plan.learnerId,
      tier: plan.tier,
      focus: plan.focus,
      startedOn: plan.startedOn,
      reviewOn: plan.reviewOn,
      ownerName: `${owner.givenName} ${owner.familyName}`,
      status: plan.status,
      goals: goals
        .filter((g) => g.planId === plan.id)
        .map((g) => ({
          id: g.id,
          description: g.description,
          metric: g.metric,
          baseline: g.baseline,
          target: g.target,
          points: points
            .filter((p) => p.goalId === g.id)
            .map((p) => ({ measuredOn: p.measuredOn, value: p.value })),
        })),
      sessions: sessions
        .filter((x) => x.planId === plan.id)
        .map((x) => ({ heldOn: x.heldOn, minutes: x.minutes, fidelity: x.fidelity })),
    }))
  },

  async listOutreach(learnerIds, limit): Promise<OutreachItem[]> {
    if (!learnerIds.length) return []

    const rows = await db
      .select({
        id: s.outreach.id,
        learnerId: s.outreach.learnerId,
        at: s.outreach.at,
        channel: s.outreach.channel,
        audience: s.outreach.audience,
        outcome: s.outreach.outcome,
        byGiven: s.users.givenName,
        byFamily: s.users.familyName,
        learnerGiven: learnerUser.givenName,
        learnerFamily: learnerUser.familyName,
      })
      .from(s.outreach)
      .innerJoin(s.users, eq(s.users.id, s.outreach.byUserId))
      .innerJoin(s.learners, eq(s.learners.id, s.outreach.learnerId))
      .innerJoin(learnerUser, eq(learnerUser.id, s.learners.userId))
      .where(inArray(s.outreach.learnerId, learnerIds))
      .orderBy(desc(s.outreach.at))
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      learnerId: r.learnerId,
      learnerName: `${r.learnerGiven} ${r.learnerFamily}`,
      at: r.at,
      channel: r.channel,
      audience: r.audience,
      outcome: r.outcome,
      byName: `${r.byGiven} ${r.byFamily}`,
    }))
  },

  async listSupportTickets(learnerIds): Promise<SupportTicketItem[]> {
    if (!learnerIds.length) return []
    const rows = await db
      .select({
        id: s.supportTickets.id,
        learnerId: s.supportTickets.learnerId,
        openedOn: s.supportTickets.openedOn,
        category: s.supportTickets.category,
        status: s.supportTickets.status,
        note: s.supportTickets.note,
        given: s.users.givenName,
        family: s.users.familyName,
      })
      .from(s.supportTickets)
      .innerJoin(s.learners, eq(s.learners.id, s.supportTickets.learnerId))
      .innerJoin(s.users, eq(s.users.id, s.learners.userId))
      .where(inArray(s.supportTickets.learnerId, learnerIds))
      .orderBy(desc(s.supportTickets.openedOn))

    return rows.map((r) => ({
      id: r.id,
      learnerId: r.learnerId,
      learnerName: `${r.given} ${r.family}`,
      openedOn: r.openedOn,
      category: r.category,
      status: r.status,
      note: r.note,
    }))
  },

  async getTierDistribution(learnerIds) {
    if (!learnerIds.length) return []
    const asOf = await latestAsOf()
    if (!asOf) return []
    const rows = await db
      .select({ tier: s.riskScores.tier, count: sql<number>`count(*)` })
      .from(s.riskScores)
      .where(
        and(inArray(s.riskScores.learnerId, learnerIds), eq(s.riskScores.asOf, asOf)),
      )
      .groupBy(s.riskScores.tier)
      .orderBy(asc(s.riskScores.tier))
    return rows.map((r) => ({ tier: r.tier, count: Number(r.count) }))
  },

  async getTierMovement(learnerIds, weeks) {
    if (!learnerIds.length) return []
    const rows = await db
      .select({
        asOf: s.riskScores.asOf,
        tier1: sql<number>`count(*) filter (where ${s.riskScores.tier} = 1)`,
        tier2: sql<number>`count(*) filter (where ${s.riskScores.tier} = 2)`,
        tier3: sql<number>`count(*) filter (where ${s.riskScores.tier} = 3)`,
      })
      .from(s.riskScores)
      .where(inArray(s.riskScores.learnerId, learnerIds))
      .groupBy(s.riskScores.asOf)
      .orderBy(asc(s.riskScores.asOf))

    return rows.slice(-weeks).map((r) => ({
      weekOf: r.asOf,
      tier1: Number(r.tier1),
      tier2: Number(r.tier2),
      tier3: Number(r.tier3),
    }))
  },

  async getInterventionEffectiveness(learnerIds) {
    const result = { improving: 0, flat: 0, declining: 0 }
    if (!learnerIds.length) return result

    // Only learners who actually have a plan — this measures whether support
    // is working, not whether the population drifted.
    const planned = await db
      .selectDistinct({ learnerId: s.interventionPlans.learnerId })
      .from(s.interventionPlans)
      .where(inArray(s.interventionPlans.learnerId, learnerIds))
    const plannedIds = planned.map((p) => p.learnerId)
    if (!plannedIds.length) return result

    const rows = await db
      .select({
        learnerId: s.riskScores.learnerId,
        asOf: s.riskScores.asOf,
        composite: s.riskScores.composite,
      })
      .from(s.riskScores)
      .where(inArray(s.riskScores.learnerId, plannedIds))
      .orderBy(asc(s.riskScores.learnerId), asc(s.riskScores.asOf))

    const byLearner = new Map<string, number[]>()
    for (const r of rows) {
      const list = byLearner.get(r.learnerId) ?? []
      list.push(r.composite)
      byLearner.set(r.learnerId, list)
    }

    for (const series of byLearner.values()) {
      if (series.length < 2) continue
      const delta = series[series.length - 1] - series[0]
      if (delta > 4) result.improving += 1
      else if (delta < -4) result.declining += 1
      else result.flat += 1
    }
    return result
  },
}
