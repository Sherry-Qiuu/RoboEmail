import { groupThreads, similarity } from '../apps/web/src/threads.ts'

type Row = {
  id: string
  text: string
  createdAt: number
  mode?: 'generate' | 'polish'
  parentId?: string
}

function entry(row: Row) {
  return {
    id: row.id,
    mode: row.mode ?? 'polish',
    title: '',
    text: row.text,
    meta: '',
    createdAt: row.createdAt,
    payload: {},
    parentId: row.parentId,
  }
}

const oxford = `Dear Mia,

Thank you for your reply and for directing me to Yiwen ZHANG at the Oxford International Office. I will scan the WeChat QR code and contact her with my questions about the exchange programme.

I also understand that no recording or follow-up materials were mentioned for the information session.

Best regards,
Shihan`

const oxfordEdited = `Dear Mia,

Thank you for your reply and for pointing me to Yiwen ZHANG at the Oxford International Office. I will scan the WeChat QR code and contact her with my questions about the exchange programme.

I also understand that no recording or follow-up materials were mentioned for the information session.

Best regards,
Shihan`

const timetable = `Dear Mia,

I am writing about the timetable clash next term, where two of my modules are scheduled in the same slot on Tuesday mornings.

Could you tell me which one I should move?

Best regards,
Shihan`

const cases: { name: string; rows: Row[]; expect: number[] }[] = [
  {
    name: 'legacy file: same greeting and body group together',
    rows: [
      { id: 'a1', text: oxford, createdAt: 1, mode: 'generate' },
      { id: 'a2', text: oxfordEdited, createdAt: 2 },
      { id: 'a3', text: oxfordEdited, createdAt: 3 },
    ],
    expect: [3],
  },
  {
    name: 'different letters to the same person stay apart',
    rows: [
      { id: 'b1', text: oxford, createdAt: 1, mode: 'generate' },
      { id: 'b2', text: timetable, createdAt: 2, mode: 'generate' },
    ],
    expect: [1, 1],
  },
  {
    name: 'explicit lineage is untouched',
    rows: [
      { id: 'c1', text: oxford, createdAt: 1, mode: 'generate' },
      // Deliberately unlike the parent: lineage still wins.
      { id: 'c2', text: timetable, createdAt: 2, parentId: 'c1' },
    ],
    expect: [2],
  },
  {
    name: 'an entry with a real parent never joins a guess',
    rows: [
      { id: 'd1', text: oxford, createdAt: 1, mode: 'generate' },
      { id: 'd2', text: oxfordEdited, createdAt: 2 },
      { id: 'd3', text: oxfordEdited, createdAt: 3, parentId: 'd2' },
    ],
    expect: [3],
  },
]

let failed = 0
for (const item of cases) {
  const threads = groupThreads(item.rows.map(entry))
  const sizes = threads.map((thread) => thread.versions.length).sort()
  const ok = JSON.stringify(sizes) === JSON.stringify(item.expect)
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${item.name}  →  ${JSON.stringify(sizes)}`)
}

const near = similarity(oxford, oxfordEdited) >= 0.65
const far = similarity(oxford, timetable) < 0.3
for (const [label, ok] of [
  ['similarity groups near-identical bodies', near],
  ['similarity keeps different bodies apart', far],
] as [string, boolean][]) {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
}

console.log(failed === 0 ? '\nall thread checks passed' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
