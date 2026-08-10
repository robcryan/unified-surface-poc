import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'

import type { CurrentUser } from './auth'

export type ResolvedLayout = {
  /** Tiles to render, in order. */
  items: s.LayoutItem[]
  /** Tiles the user has removed — offered back in the "add tile" tray. */
  hidden: s.LayoutItem[]
  /** True when the user has personalised away from their role default. */
  customized: boolean
}

/**
 * Effective layout = the role template, overlaid with the user's saved
 * personalization.
 *
 * Locked tiles are re-asserted from the template on every read. An
 * administrator can therefore add a required tile to a role after users have
 * already personalised, and it appears for everyone — the stored override
 * cannot suppress it.
 */
export async function getEffectiveLayout(
  user: CurrentUser,
): Promise<ResolvedLayout> {
  const [template] = await db
    .select()
    .from(s.roleLayouts)
    .where(eq(s.roleLayouts.role, user.role))
    .limit(1)

  const templateItems = template?.items ?? []

  const [override] = await db
    .select()
    .from(s.userLayouts)
    .where(eq(s.userLayouts.userId, user.id))
    .limit(1)

  if (!override) return { items: templateItems, hidden: [], customized: false }

  const lockedTypes = new Set(
    templateItems.filter((i) => i.locked).map((i) => i.type),
  )
  // Every type the user's saved layout knows about, hidden ones included. A
  // type the user has decided about must not be re-added below.
  const decided = new Set(override.items.map((i) => i.type))

  // Start from the user's own order. "Locked" means the tile cannot be
  // removed — not that it cannot be moved, which is what the drag handle
  // implies. Force-hoisting it here would make dragging it appear to work and
  // then silently revert on the next load.
  const visible = override.items
    .filter((i) => !i.hidden || lockedTypes.has(i.type))
    .map((i) =>
      lockedTypes.has(i.type) ? { ...i, locked: true, hidden: false } : i,
    )

  // A locked tile the override never mentions is inserted at its template
  // position, so a newly required tile still reaches people who personalised.
  templateItems.forEach((item, index) => {
    if (item.locked && !decided.has(item.type)) {
      visible.splice(Math.min(index, visible.length), 0, { ...item, locked: true })
    }
  })

  // Non-locked tiles the user has never seen get appended; ones they
  // deliberately removed stay gone.
  for (const item of templateItems) {
    if (!decided.has(item.type) && !item.locked) visible.push(item)
  }

  const hidden = override.items.filter(
    (i) => i.hidden && !lockedTypes.has(i.type),
  )

  return { items: visible, hidden, customized: true }
}

export async function saveUserLayout(userId: string, items: s.LayoutItem[]) {
  await db
    .insert(s.userLayouts)
    .values({ userId, items, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: s.userLayouts.userId,
      set: { items, updatedAt: new Date() },
    })
}

/** Reset to default is simply dropping the override row. */
export async function resetUserLayout(userId: string) {
  await db.delete(s.userLayouts).where(eq(s.userLayouts.userId, userId))
}

/** Tiles available to a role but not currently placed — the "add tile" menu. */
export async function getAvailableTiles(
  user: CurrentUser,
  placed: s.LayoutItem[],
): Promise<string[]> {
  const [template] = await db
    .select()
    .from(s.roleLayouts)
    .where(eq(s.roleLayouts.role, user.role))
    .limit(1)
  const placedTypes = new Set(placed.map((i) => i.type))
  return (template?.items ?? [])
    .map((i) => i.type)
    .filter((t) => !placedTypes.has(t))
}
