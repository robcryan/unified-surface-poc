'use client'

import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { persistLayout, resetLayout } from '@/app/actions'
import { cn } from '@/components/ui'

export type CanvasTile = {
  type: string
  span: number
  locked: boolean
  /** Used by the restore tray, so it never shows raw widget keys. */
  title: string
  node: ReactNode
}

/** A tile the user has removed. Its body is not rendered, so it has no node. */
export type HiddenTile = {
  type: string
  span: number
  /** Human-readable title, so the restore tray is not a list of keys. */
  title: string
}

const MIN_SPAN = 3
const MAX_SPAN = 12
const RESIZE_STEP = 24

function SortableTile({
  tile,
  editing,
  onResize,
  onRemove,
}: {
  tile: CanvasTile
  editing: boolean
  onResize: (type: string, span: number) => void
  onRemove: (type: string) => void
}) {
  const [isResizing, setIsResizing] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tile.type, disabled: !editing || isResizing })
  const dragStartX = useRef<number | null>(null)
  const startSpan = useRef(tile.span)

  function handleResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (event.button !== 0) return

    dragStartX.current = event.clientX
    startSpan.current = tile.span
    setIsResizing(true)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (dragStartX.current === null) return

      const delta = moveEvent.clientX - dragStartX.current
      const nextSpan = Math.min(
        MAX_SPAN,
        Math.max(MIN_SPAN, Math.round(startSpan.current + delta / RESIZE_STEP)),
      )

      if (nextSpan !== tile.span) {
        onResize(tile.type, nextSpan)
      }
    }

    const handlePointerUp = () => {
      dragStartX.current = null
      setIsResizing(false)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const spanValue = Math.min(MAX_SPAN, Math.max(MIN_SPAN, tile.span))

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        gridColumn: `span ${spanValue} / span ${spanValue}`,
      }}
      className={cn('relative', isDragging && 'opacity-80')}
    >
      {editing && (
        <div className="absolute -top-2.5 right-2 z-10 flex items-center gap-1 rounded-lg border border-line bg-panel px-1 py-0.5 shadow-sm">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${tile.type}`}
            className="cursor-grab rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted active:cursor-grabbing"
          >
            ⠿
          </button>
          <button
            type="button"
            onPointerDown={handleResizePointerDown}
            aria-label={`Resize ${tile.type}`}
            className="cursor-ew-resize rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-panel-muted"
            title="Drag to resize"
          >
            ↔ {tile.span}
          </button>
          {tile.locked ? (
            <span
              className="px-1.5 py-0.5 text-[11px] text-ink-faint"
              title="Required by your role — cannot be removed"
            >
              locked
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onRemove(tile.type)}
              aria-label={`Remove ${tile.type}`}
              className="rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-urgent-soft hover:text-urgent"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div
        className={cn(
          'h-full',
          editing && 'rounded-xl ring-2 ring-accent/30 ring-offset-2 ring-offset-bg',
        )}
      >
        {tile.node}
      </div>

      {editing && (
        <button
          type="button"
          onPointerDown={handleResizePointerDown}
          aria-label={`Resize ${tile.type}`}
          className="absolute bottom-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-accent/30 bg-panel/95 text-[13px] text-accent shadow-sm transition hover:bg-accent-soft"
          title="Drag to resize"
        >
          ↔
        </button>
      )}
    </div>
  )
}

/** One entry in the tile catalog the user can add from. */
export type CatalogEntry = {
  type: string
  title: string
  subtitle: string
  source: string
}

export function TileCanvas({
  initialTiles,
  initialHidden,
  catalog,
  sourceOrder,
  sourceBlurb,
  customized,
}: {
  initialTiles: CanvasTile[]
  initialHidden: HiddenTile[]
  catalog: CatalogEntry[]
  sourceOrder: string[]
  sourceBlurb: Record<string, string>
  customized: boolean
}) {
  const [tiles, setTiles] = useState(initialTiles)
  /** Locally removed this session — we still hold their rendered bodies. */
  const [removed, setRemoved] = useState<CanvasTile[]>([])
  /** Removed in an earlier session — no body was rendered for them. */
  const [hidden, setHidden] = useState<HiddenTile[]>(initialHidden)
  const [editing, setEditing] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [pending, startTransition] = useTransition()

  // The toolbar renders into the header's slot. Resolved after mount so the
  // server and first client render agree.
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('tile-controls')), [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /**
   * Persist visible order plus an explicit record of what was removed. Sending
   * removals rather than just omitting them is what lets the server tell a
   * deliberate removal apart from a tile newly added to the role template.
   */
  function save(
    visible: { type: string; span: number; locked?: boolean }[],
    gone: { type: string; span: number }[],
  ) {
    startTransition(async () => {
      await persistLayout([
        ...visible.map((t) => ({ type: t.type, span: t.span, locked: t.locked })),
        ...gone.map((t) => ({ type: t.type, span: t.span, hidden: true })),
      ])
    })
  }

  const allGone = () => [...removed, ...hidden]

  // NOTE: next state is computed from the current closure and committed with a
  // plain setState. Doing this work inside a `setTiles(current => …)` updater
  // is a bug — updaters must be pure, and calling startTransition from one
  // makes React abort the update, so the tile silently never moves.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = tiles.findIndex((t) => t.type === active.id)
    const to = tiles.findIndex((t) => t.type === over.id)
    if (from === -1 || to === -1) return
    const next = arrayMove(tiles, from, to)
    setTiles(next)
    save(next, allGone())
  }

  function handleResize(type: string, span: number) {
    const next = tiles.map((t) => (t.type === type ? { ...t, span } : t))
    setTiles(next)
    save(next, allGone())
  }

  function handleRemove(type: string) {
    const target = tiles.find((t) => t.type === type)
    if (!target || target.locked) return
    const next = tiles.filter((t) => t.type !== type)
    const nextRemoved = [...removed, target]
    setTiles(next)
    setRemoved(nextRemoved)
    save(next, [...nextRemoved, ...hidden])
  }

  /**
   * Add a tile from the catalog. Its body has never been rendered, so the
   * server has to produce it: persist the new layout, then reload.
   */
  function handleAdd(entry: CatalogEntry) {
    const span = 6
    const nextHidden = hidden.filter((t) => t.type !== entry.type)
    const nextRemoved = removed.filter((t) => t.type !== entry.type)
    setHidden(nextHidden)
    setRemoved(nextRemoved)
    startTransition(async () => {
      await persistLayout([
        ...tiles.map((t) => ({ type: t.type, span: t.span, locked: t.locked })),
        { type: entry.type, span },
        ...[...nextRemoved, ...nextHidden].map((t) => ({
          type: t.type,
          span: t.span,
          hidden: true,
        })),
      ])
      window.location.reload()
    })
  }

  function handleRestore(type: string) {
    const local = removed.find((t) => t.type === type)
    if (local) {
      const nextRemoved = removed.filter((t) => t.type !== type)
      const next = [...tiles, local]
      setRemoved(nextRemoved)
      setTiles(next)
      save(next, [...nextRemoved, ...hidden])
      return
    }

    // Restored from an earlier session: its body was never rendered, so the
    // server has to produce it. Save first, then reload.
    const stale = hidden.find((t) => t.type === type)
    if (!stale) return
    const nextHidden = hidden.filter((t) => t.type !== type)
    setHidden(nextHidden)
    startTransition(async () => {
      await persistLayout([
        ...tiles.map((t) => ({ type: t.type, span: t.span, locked: t.locked })),
        { type: stale.type, span: stale.span },
        ...[...removed, ...nextHidden].map((t) => ({
          type: t.type,
          span: t.span,
          hidden: true,
        })),
      ])
      window.location.reload()
    })
  }

  return (
    <>
      {slot &&
        createPortal(
          <>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                editing
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-panel text-ink hover:border-accent',
              )}
            >
              {editing ? 'Done' : 'Customize view'}
            </button>

            <button
              type="button"
              onClick={() => {
                setBrowsing((v) => !v)
                setEditing(true)
              }}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                browsing
                  ? 'border-accent bg-accent-soft text-accent-text'
                  : 'border-line bg-panel text-ink hover:border-accent',
              )}
            >
              + Add tile
            </button>

            {pending && (
              <span className="text-[11px] text-ink-faint">Saving…</span>
            )}

            {customized && (
              <form
                className="ml-auto"
                action={async () => {
                  await resetLayout()
                  window.location.reload()
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
                >
                  Reset to default
                </button>
              </form>
            )}
          </>,
          slot,
        )}

      {editing && !browsing && (
        <p className="mb-3 text-[11.5px] text-ink-muted">
          Drag ⠿ to move, drag the ↔ handle to resize, ✕ to remove. Saved automatically.
        </p>
      )}

      {/* Tile catalog, grouped by the source system each tile draws from. */}
      {browsing && (
        <div className="mb-5 rounded-xl border border-line bg-panel p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">
                Add a tile
              </h2>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                Everything available to you, grouped by the system it comes from.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBrowsing(false)}
              className="rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-muted hover:border-accent hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="space-y-4">
            {sourceOrder
              .filter((src) => catalog.some((c) => c.source === src))
              .map((src) => (
                <div key={src}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      {src}
                    </span>
                    <span className="text-[11px] text-ink-faint">
                      {sourceBlurb[src]}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {catalog
                      .filter((c) => c.source === src)
                      .map((entry) => {
                        const placed = tiles.some((t) => t.type === entry.type)
                        return (
                          <button
                            key={entry.type}
                            type="button"
                            disabled={placed || pending}
                            onClick={() => handleAdd(entry)}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-left transition-colors',
                              placed
                                ? 'cursor-default border-line bg-panel-muted opacity-60'
                                : 'border-line bg-panel hover:border-accent hover:bg-accent-soft',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[12.5px] font-semibold text-ink">
                                {entry.title}
                              </span>
                              <span className="shrink-0 text-[11px] text-ink-faint">
                                {placed ? 'on your view' : '+ add'}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                              {entry.subtitle}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {editing && (removed.length > 0 || hidden.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2">
          <span className="text-[11.5px] text-ink-muted">Removed — tap to add back:</span>
          {[...removed, ...hidden].map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => handleRestore(t.type)}
              className="rounded-md border border-line bg-panel px-2 py-1 text-[11.5px] text-ink transition-colors hover:border-accent hover:text-accent-text"
            >
              + {t.title}
            </button>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tiles.map((t) => t.type)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-12 gap-4">
            {tiles.map((tile) => (
              <SortableTile
                key={tile.type}
                tile={tile}
                editing={editing}
                onResize={handleResize}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
}
