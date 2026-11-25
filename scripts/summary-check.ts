import { summaryLine } from '../apps/web/src/summary.ts'

type Case = { name: string; text: string; ok: (line: string) => boolean }

const cases: Case[] = [
  {
    name: 'signature never becomes the subject',
    text: 'Dear Mia,\n\nThank you for your reply, and for pointing me to Yiwen ZHANG at the Oxford International Office.\n\nBest regards,\nShihan',
    ok: (line) => line.startsWith('Thank you for your reply') && !line.includes('Shihan'),
  },
  {
    name: 'body with only a signature falls back to the greeting',
    text: 'Dear Mia,\n\nBest regards,\nShihan',
    ok: (line) => line === 'Dear Mia,',
  },
  {
    name: 'generic opener is trimmed',
    text: 'Dear Professor Smith,\n\nI hope this email finds you well. I am writing to ask about the deadline.\n\nBest regards,\nShihan',
    ok: (line) => line.startsWith('I am writing to ask about the deadline.'),
  },
  {
    name: 'chinese text keeps the first sentence',
    text: '张老师您好：\n\n我想问一下选课的事情。\n\n谢谢',
    ok: (line) => line === '张老师您好：',
  },
  {
    name: 'preview is capped',
    text: 'A very long opening sentence that keeps going well past the seventy two character limit and then some.',
    ok: (line) => line.length <= 73 && line.endsWith('…'),
  },
]

let failed = 0
for (const item of cases) {
  const got = summaryLine(item.text, '润色')
  const ok = item.ok(got)
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${item.name}`)
  if (!ok) console.log(`      got: ${got}`)
}

console.log(failed === 0 ? '\nall summary checks passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
