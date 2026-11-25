import { buildCalendar } from '../apps/web/src/calendar.ts'

const days: { day: string; n: number }[] = []
const today = new Date('2026-11-25T12:00:00Z')
for (let i = 370; i >= 0; i -= 1) {
  const date = new Date(today.getTime() - i * 86_400_000)
  const key = date.toISOString().slice(0, 10)
  days.push({ day: key, n: key === '2026-11-25' ? 3 : key === '2026-11-24' ? 1 : 0 })
}

const calendar = buildCalendar(days, today)

const checks: [string, boolean][] = [
  ['columns are whole weeks', calendar.weeks.every((week) => week.length === 7)],
  ['about 53 weeks', calendar.weeks.length >= 53 && calendar.weeks.length <= 54],
  ['last column holds today', calendar.weeks.at(-1)!.some((cell) => cell.key === '2026-11-25')],
  ['days after today are blank', calendar.weeks.at(-1)!.some((cell) => cell.n === -1)],
  ['counted the sample days', calendar.totals === 4],
  ['month labels ascend', calendar.months.every((m, i) => i === 0 || m.index > calendar.months[i - 1]!.index)],
]

for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`)
const failed = checks.filter(([, ok]) => !ok).length
console.log(failed === 0 ? '\nall calendar checks passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
