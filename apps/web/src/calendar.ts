/**
 * Calendar geometry for the activity heatmap: one column per week, Monday at
 * the top, ending with the current week. Kept free of React so it can be
 * checked from Node.
 */

export type Day = { day: string; n: number }

export type Cell = { key: string; n: number }

export type Calendar = {
  weeks: Cell[][]
  months: { index: number; label: string }[]
  totals: number
}

export function buildCalendar(days: Day[], now = new Date()): Calendar {
  const counts = new Map(days.map((entry) => [entry.day, entry.n]))

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const start = new Date(today.getTime() - (days.length - 1) * 86_400_000)
  // Back up to the Monday on or before the first day of the window.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

  const weeks: Cell[][] = []
  const months: { index: number; label: string }[] = []
  let lastMonth = -1

  const cursor = new Date(start)
  while (cursor <= today) {
    const column: Cell[] = []
    for (let row = 0; row < 7; row += 1) {
      const key = cursor.toISOString().slice(0, 10)
      column.push({ key, n: cursor > today ? -1 : (counts.get(key) ?? 0) })
      cursor.setDate(cursor.getDate() + 1)
    }
    const month = new Date(column[0]!.key).getUTCMonth()
    if (month !== lastMonth && cursor.getTime() > start.getTime()) {
      lastMonth = month
      months.push({ index: weeks.length, label: `${month + 1} 月` })
    }
    weeks.push(column)
  }

  return {
    weeks,
    months,
    totals: days.reduce((sum, entry) => sum + entry.n, 0),
  }
}
