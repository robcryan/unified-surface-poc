import { inArray } from 'drizzle-orm'

import { db } from '@/db/client'
import * as s from '@/db/schema'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DISTRICT_NAME } from '@/db/demo-config'

import { LoginForm, type DemoAccount } from './login-form'

export const metadata = {
  title: `Sign in — ${DISTRICT_NAME}`,
}

export default async function LoginPage() {
  const ids = DEMO_ACCOUNTS.map((a) => a.userId)
  const rows = await db.select().from(s.users).where(inArray(s.users.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))

  const accounts: DemoAccount[] = DEMO_ACCOUNTS.flatMap((a) => {
    const u = byId.get(a.userId)
    if (!u) return []
    return [
      {
        email: u.email,
        fullName: `${u.givenName} ${u.familyName}`,
        role: u.role,
        title: u.title,
        blurb: a.blurb,
      },
    ]
  })

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Explainer rail — states what this is before anyone signs in. */}
      <aside className="flex flex-col justify-between bg-panel px-8 py-10 lg:w-[46%] lg:px-14 lg:py-14">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white"
              aria-hidden
            >
              M
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-ink">
              {DISTRICT_NAME}
            </span>
          </div>

          <h1 className="mt-10 max-w-md text-[28px] font-semibold leading-[1.2] tracking-tight text-ink lg:text-[34px]">
            One surface for enrollment, learning, supports and curriculum.
          </h1>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
            Four systems that normally sit apart, composed into a single view
            that changes shape depending on who signs in — and that each person
            can arrange for themselves.
          </p>

          <dl className="mt-9 max-w-md space-y-4">
            {[
              [
                'Built for a fully virtual program',
                'Attendance is engagement, not seat time. The early-warning model is Engagement, Pace and Performance.',
              ],
              [
                'Configurable per person',
                'Every role has a default view. Rearrange it and it stays that way across sign-ins.',
              ],
              [
                'Scoped by role',
                'Teachers see their sections, specialists see their caseload, families see their own learners.',
              ],
            ].map(([term, desc]) => (
              <div key={term}>
                <dt className="text-[12.5px] font-semibold text-ink">{term}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                  {desc}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-10 text-[11px] leading-relaxed text-ink-faint">
          Prototype environment. All learners, staff, families and records shown
          are synthetic and generated — this system contains no real student
          data.
        </p>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-10">
        <LoginForm accounts={accounts} demoPassword={DEMO_PASSWORD} />
      </main>
    </div>
  )
}
