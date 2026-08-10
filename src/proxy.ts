import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/session'

/**
 * Renamed from `middleware` in Next 16.
 *
 * This is deliberately only an *optimistic* check — cookie present or not.
 * Real authorization happens in the data access layer (src/data/scope.ts),
 * which is the only place that can decide whether this particular user may see
 * this particular learner. Next's own guidance is not to rely on shared modules
 * or database access here.
 */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE)
  const { pathname } = request.nextUrl

  if (!signedIn && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (signedIn && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Odoo's own paths (/odoo, /web, /website, /mail, /bus, /jsonrpc) are
     * excluded: they are proxied straight through to the real application,
     * which does its own authentication. Guarding them here would break its
     * asset and RPC traffic.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|odoo|web|website|mail|bus|jsonrpc|.*\\.svg$).*)',
  ],
}
