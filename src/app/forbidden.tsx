import Link from 'next/link'

/**
 * Rendered when the data access layer calls `forbidden()` — a signed-in user
 * reached for a learner outside their scope. Deliberately says nothing about
 * whether that learner exists.
 */
export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-urgent">
          Not available
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
          This record is outside your access
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Learner records are limited to the staff and families with a
          responsibility for that learner. The attempt has been recorded in the
          access log.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
        >
          Back to my view
        </Link>
      </div>
    </main>
  )
}
