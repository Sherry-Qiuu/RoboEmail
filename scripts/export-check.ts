import { exportHtml, exportWord } from '../apps/web/src/export.ts'

const saved: { name: string; text: string }[] = []

globalThis.URL = {
  createObjectURL(blob: Blob) {
    // Capture the slot synchronously; the text resolves after the next push.
    const slot = saved[saved.length - 1]
    blob.text().then((text) => {
      if (slot) slot.text = text
    })
    return 'blob:preview'
  },
  revokeObjectURL() {},
} as unknown as typeof URL

globalThis.document = {
  createElement() {
    return {
      href: '',
      download: '',
      click() {},
    }
  },
} as unknown as typeof document

globalThis.window = { setTimeout: () => 0 } as unknown as Window & typeof globalThis

const entries = [
  {
    id: 'aaaaaaaa-1111',
    mode: 'generate' as const,
    title: 'PhD enquiry: research position <in> your group',
    text: 'Dear Professor Chen,\n\nI am writing to ask about your group.\n\nBest regards,\nQiu',
    meta: '3 段',
    createdAt: Date.UTC(2026, 10, 13, 12, 3),
    payload: {},
  },
  {
    id: 'bbbbbbbb-2222',
    mode: 'polish' as const,
    title: 'I am an undergraduate student at UNNC',
    text: 'I am an undergraduate student at the University of Nottingham Ningbo.\n\nBest regards',
    meta: '2 处改动',
    createdAt: Date.UTC(2026, 10, 15, 6, 33),
    payload: {},
  },
]

// The blob is read asynchronously, so push the record before calling.
for (const [label, run] of [
  ['html', () => exportHtml(entries)],
  ['word', () => exportWord(entries)],
] as const) {
  saved.push({ name: label, text: '' })
  run()
}

await new Promise((done) => setTimeout(done, 50))

const html = saved.find((item) => item.name === 'html')?.text ?? ''
const word = saved.find((item) => item.name === 'word')?.text ?? ''

const checks: [string, boolean][] = [
  ['html has sidebar', html.includes('<aside>')],
  ['html has one bookmark per entry', (html.match(/<li>/g) ?? []).length === 2],
  ['html escapes angle brackets', html.includes('&lt;in&gt;')],
  ['html keeps line breaks', html.includes('<br />')],
  ['word has mso header', word.includes('w:WordDocument')],
  ['word has no sidebar', !word.includes('<aside>')],
  ['word breaks pages between entries', word.includes('page-break-before: always')],
]

for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`)
const failed = checks.filter(([, ok]) => !ok).length
console.log(failed === 0 ? '\nall export checks passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
