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

export function ActivityHeatmap({ days }: { days: Day[] }) {
  const { weeks, months, totals } = useMemo(() => buildCalendar(days), [days])

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">近一年</span>
        <span className="text-[12px] text-faint">共 {totals} 条</span>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
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
                      background:
                        cell.n < 0
                          ? 'transparent'
                          : cell.n === 0
                            ? 'var(--edge-surface-3, #eeeeea)'
                            : 'var(--edge-accent, #4f7a5b)',
                      opacity: cell.n < 0 ? 0 : cell.n === 0 ? 1 : 0.2 + (levelFor(cell.n) / LEVELS) * 0.8,
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
                  background:
                    level === 0 ? 'var(--edge-surface-3, #eeeeea)' : 'var(--edge-accent, #4f7a5b)',
                  opacity: level === 0 ? 1 : 0.2 + (level / LEVELS) * 0.8,
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
