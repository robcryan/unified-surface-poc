import { desc } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'

import { mockCurriculum } from './mock-curriculum'
import { mockLms } from './mock-lms'
import { mockMtss } from './mock-mtss'
import { mockSis } from './mock-sis'
import type { IntegrationStatus } from './types'

/**
 * The wiring point. Every provider is resolved here and nowhere else, so
 * replacing a mock with a real connector is a one-line change that the rest of
 * the application cannot observe.
 */
export const adapters = {
  sis: mockSis,
  lms: mockLms,
  mtss: mockMtss,
  curriculum: mockCurriculum,
} as const

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const rows = await db
    .select()
    .from(s.integrationSources)
    .orderBy(desc(s.integrationSources.status))
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    category: r.category,
    status: r.status,
    lastSyncAt: r.lastSyncAt,
    recordCount: r.recordCount,
    note: r.note,
  }))
}

export * from './types'
