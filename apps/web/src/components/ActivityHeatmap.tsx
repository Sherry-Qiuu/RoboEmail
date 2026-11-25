import { useMemo } from 'react'
import { buildCalendar, type Day } from '../calendar'

const CELL = 11
const GAP = 3
const LEVELS = 4

/** 0 = nothing that day, 4 = four or more. */
function levelFor(n: number): number {
  if (n <= 0) return 0
  return Math.min(n, LEVELS)
}

/**
 * Empty days use a translucent ink rather than a surface token: with an image
 * theme the surfaces turn to glass and the grid all but disappears. The ink
 * still reads over artwork in both light and dark.
 */
const EMPTY = 'var(--heat-empty, rgba(25, 25, 23, 0.1))'
const FILLED = 'var(--edge-accent, #4f7a5b)'

/** Level 1 still has to be visible on artwork, so the range starts at 0.35. */
function strength(level: number): number {
  return 0.35 + (level / LEVELS) * 0.65
}

export function ActivityHeatmap({ days }: { days: Day[] }) {
  const { weeks, months, totals } = useMemo(() => buildCalendar(days), [days])

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">近一年</span>
        <span className="text-[12px] text-faint">共 {totals} 条</span>
      </div>

      <div className="heatmap-scroll mt-3 overflow-x-auto pb-1">
        <div className="inline-block min-w-max">
          <div className="relative h-4" style={{ width: weeks.length * (CELL + GAP) }}>
            {months.map((month) => (
              <span
                key={`${month.index}-${month.label}`}
                className="absolute top-0 text-[10px] text-faint"
                style={{ left: month.index * (CELL + GAP) }}
              >
                {month.label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            <div className="mr-1 flex flex-col text-[10px] text-faint">
              {['一', '', '三', '', '五', '', ''].map((label, index) => (
                <span
                  key={index}
                  style={{ height: CELL, lineHeight: `${CELL}px`, marginBottom: index === 6 ? 0 : GAP }}
                >
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((column) => (
              <div key={column[0]!.key} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <span
                    key={cell.key}
                    title={cell.n < 0 ? '' : `${cell.key} · ${cell.n} 条`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: cell.n < 0 ? 'transparent' : cell.n === 0 ? EMPTY : FILLED,
                      opacity: cell.n < 0 ? 0 : cell.n === 0 ? 1 : strength(levelFor(cell.n)),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-faint">
            <span>少</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  background: level === 0 ? EMPTY : FILLED,
                  opacity: level === 0 ? 1 : strength(level),
                }}
              />
            ))}
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  )
}
