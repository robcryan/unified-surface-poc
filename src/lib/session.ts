import 'server-only'

import { cookies } from 'next/headers'
import { getIronSession, type SessionOptions } from 'iron-session'

export type SessionData = {
  userId?: string
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    'prototype-only-session-secret-change-me-32+',
  cookieName: 'unified_surface_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
}

/** Cookie name the proxy checks for a cheap signed-in/signed-out decision. */
export const SESSION_COOKIE = sessionOptions.cookieName

export async function getSession() {
  // `cookies()` is async-only as of Next 16.
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
