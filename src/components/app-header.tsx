import { signOut } from '@/app/actions'
import type { CurrentUser } from '@/data/auth'
import { DISTRICT_NAME } from '@/db/demo-config'
import { Avatar } from '@/components/ui'

const ROLE_LABEL: Record<string, string> = {
  student: 'Learner',
  teacher: 'Teacher',
  counselor: 'Intervention Specialist',
  administrator: 'Administrator',
  guardian: 'Parent / Guardian',
}

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-[12px] font-bold text-white"
            aria-hidden
          >
            M
          </span>
          <span className="truncate text-[13px] font-semibold tracking-tight text-ink">
            {DISTRICT_NAME}
          </span>
        </div>

        {/*
          Slot for the tile-surface controls. TileCanvas owns the customization
          state, so it portals its toolbar in here rather than the state being
          lifted or duplicated. Stays empty on pages without a canvas.
        */}
        <div id="tile-controls" className="flex flex-1 items-center gap-2" />

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[12.5px] font-medium leading-tight text-ink">
              {user.fullName}
            </div>
            <div className="text-[11px] leading-tight text-ink-muted">
              {user.title ?? ROLE_LABEL[user.role] ?? user.role}
            </div>
          </div>
          <Avatar name={user.fullName} size={30} />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
