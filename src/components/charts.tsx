'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS = 'var(--viz-axis)'
const GRID = 'var(--viz-grid)'

function shortDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const axisTick = { fontSize: 10.5, fill: AXIS }

function TooltipCard({
  label,
  rows,
}: {
  label: string
  rows: { name: string; value: string; color: string }[]
}) {
  return (
    <div className="rounded-lg border border-line bg-panel px-2.5 py-2 text-[11.5px] shadow-lg">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 text-ink-muted">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: r.color }}
            aria-hidden
          />
          <span className="flex-1">{r.name}</span>
          <span className="tnum font-medium text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Progress monitoring: measured values against a goal line. The defining
 * artifact of MTSS practice — the question is always "is the gap closing",
 * which is a slope read, not a value read.
 *
 * One series, so no legend box: the tile title names it. The goal and baseline
 * are reference lines, not series.
 */
export function ProgressMonitorChart({
  points,
  baseline,
  target,
  height = 150,
}: {
  points: { measuredOn: string; value: number }[]
  baseline: number
  target: number
  height?: number
}) {
  const data = points.map((p) => ({ ...p, day: shortDay(p.measuredOn) }))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 34, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            domain={[0, 100]}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <ReferenceLine
            y={target}
            stroke="var(--viz-goal)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: 'Goal',
              position: 'right',
              fontSize: 10,
              fill: 'var(--viz-goal)',
            }}
          />
          <ReferenceLine
            y={baseline}
            stroke={AXIS}
            strokeDasharray="2 4"
            strokeWidth={1}
            label={{
              value: 'Start',
              position: 'right',
              fontSize: 10,
              fill: AXIS,
            }}
          />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  label={String(label)}
                  rows={[
                    {
                      name: 'Measured',
                      value: String(Math.round(Number(payload[0].value))),
                      color: 'var(--viz-series-1)',
                    },
                  ]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--viz-series-1)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--viz-series-1)' }}
            activeDot={{ r: 5.5, strokeWidth: 2, stroke: 'var(--panel)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Weekly engagement trend. Two measures that share one 0–100 percentage scale,
 * so they belong on one axis — never a second y-scale.
 */
export function EngagementTrendChart({
  data,
  height = 160,
}: {
  data: { weekOf: string; loginRate: number; liveAttendanceRate: number }[]
  height?: number
}) {
  const shaped = data.map((d) => ({ ...d, day: shortDay(d.weekOf) }))

  return (
    <div>
      {/* Legend is always present for two or more series, so identity never
          rests on colour alone. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {[
          ['Logged in', 'var(--viz-series-1)'],
          ['Live session attendance', 'var(--viz-series-2)'],
        ].map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            {name}
          </span>
        ))}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={shaped} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="day"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={18}
            />
            <YAxis
              domain={[0, 100]}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    label={`Week of ${label}`}
                    rows={[
                      {
                        name: 'Logged in',
                        value: `${Math.round(Number(payload[0]?.value ?? 0))}%`,
                        color: 'var(--viz-series-1)',
                      },
                      {
                        name: 'Live attendance',
                        value: `${Math.round(Number(payload[1]?.value ?? 0))}%`,
                        color: 'var(--viz-series-2)',
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="loginRate"
              stroke="var(--viz-series-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--panel)' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="liveAttendanceRate"
              stroke="var(--viz-series-2)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--panel)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
