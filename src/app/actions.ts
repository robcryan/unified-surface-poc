'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'
import { DEMO_PASSWORD } from '@/db/demo-config'
import { getSession } from '@/lib/session'
import { getCurrentUser } from '@/data/auth'
import { resetUserLayout, saveUserLayout } from '@/data/layout'

export type SignInState = { error?: string }

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Enter an email address and password.' }

  const rows = await db
    .select()
    .from(s.users)
    .where(eq(s.users.email, email))
    .limit(1)

  // Prototype authentication: the account must exist and the shared demo
  // password must match. There are no real credentials in this system.
  if (!rows.length || password !== DEMO_PASSWORD) {
    return { error: 'That email and password combination was not recognised.' }
  }
  if (!rows[0].active) return { error: 'That account is inactive.' }

  const session = await getSession()
  session.userId = rows[0].id
  await session.save()

  await db
    .update(s.users)
    .set({ lastSignInAt: new Date() })
    .where(eq(s.users.id, rows[0].id))

  redirect('/')
}

export async function signOut() {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}

export async function persistLayout(items: s.LayoutItem[]) {
  const user = await getCurrentUser()
  if (!user) return
  await saveUserLayout(user.id, items)
  revalidatePath('/')
}

export async function resetLayout() {
  const user = await getCurrentUser()
  if (!user) return
  await resetUserLayout(user.id)
  revalidatePath('/')
}
