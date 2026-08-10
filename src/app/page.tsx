import { Suspense } from 'react'

import { AppHeader } from '@/components/app-header'
import {
  TileCanvas,
  type CanvasTile,
  type CatalogEntry,
  type HiddenTile,
} from '@/components/tile-canvas'
import { Tile } from '@/components/ui'
import { requireUser } from '@/data/auth'
import { getEffectiveLayout } from '@/data/layout'
import {
  SOURCE_BLURB,
  SOURCE_ORDER,
  catalogForRole,
  widgetFor,
} from '@/widgets/registry'

function TileSkeleton() {
  return (
    <div className="h-full space-y-2 p-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-line"
          style={{ width: `${100 - i * 18}%` }}
        />
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const user = await requireUser()
  const { items, hidden, customized } = await getEffectiveLayout(user)

  // Everything this role may place — the "Add tile" catalog.
  const catalog: CatalogEntry[] = catalogForRole(user.role)

  // Removed tiles are listed but not rendered — no point running a widget's
  // queries for something the user has taken off their view.
  const hiddenTiles: HiddenTile[] = hidden.flatMap((item) => {
    const def = widgetFor(item.type)
    return def ? [{ type: item.type, span: item.span, title: def.title }] : []
  })

  const tiles: CanvasTile[] = items.flatMap((item) => {
    const def = widgetFor(item.type)
    // An unknown key degrades to nothing rather than crashing the page —
    // layout rows are data, and data can outlive a widget.
    if (!def) return []
    const { Component } = def

    return [
      {
        type: item.type,
        span: item.span,
        locked: Boolean(item.locked),
        title: def.title,
        node: (
          <Tile title={def.title} subtitle={def.subtitle} source={def.source}>
            <Suspense fallback={<TileSkeleton />}>
              <Component user={user} />
            </Suspense>
          </Tile>
        ),
      },
    ]
  })

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8">
        <TileCanvas
          initialTiles={tiles}
          initialHidden={hiddenTiles}
          catalog={catalog}
          sourceOrder={SOURCE_ORDER}
          sourceBlurb={SOURCE_BLURB}
          customized={customized}
        />
      </main>
    </>
  )
}
