'use client'

import { useActionState, useState } from 'react'

import { signIn, type SignInState } from '@/app/actions'
import { Avatar, cn } from '@/components/ui'

export type DemoAccount = {
  email: string
  fullName: string
  role: string
  title: string | null
  blurb: string
}

const ROLE_LABEL: Record<string, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  counselor: 'Intervention Specialist',
  administrator: 'Administrator',
  guardian: 'Parent / Guardian',
}

export function LoginForm({
  accounts,
  demoPassword,
}: {
  accounts: DemoAccount[]
  demoPassword: string
}) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="w-full max-w-md">
      <form action={formAction} className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-[12px] font-medium text-ink"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="you@meridianvirtual.example"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-[12px] font-medium text-ink"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="••••••••"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-urgent-soft px-3 py-2 text-[12px] text-urgent"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Demonstration accounts
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <ul className="space-y-1.5">
          {accounts.map((acct) => {
            const selected = email === acct.email
            return (
              <li key={acct.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(acct.email)
                    setPassword(demoPassword)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-panel hover:bg-panel-muted',
                  )}
                >
                  <Avatar name={acct.fullName} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[12.5px] font-semibold text-ink">
                        {acct.fullName}
                      </span>
                      <span className="text-[11px] text-ink-faint">
                        {ROLE_LABEL[acct.role] ?? acct.role}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                      {acct.blurb}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
          Selecting an account fills the form; press Sign in to continue. Every
          record in this environment is synthetic — no real learner data is
          present.
        </p>
      </div>
    </div>
  )
}
