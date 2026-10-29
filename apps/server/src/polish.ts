import { z } from 'zod'
import { env } from './env.ts'
import { extractJson } from './json.ts'
import { completeJson } from './llm.ts'
import { buildPolishMessages, type PolishContext } from './prompt.ts'

const MAX_SPAN = 200

const ChangeSchema = z.object({
  before: z.string().default(''),
  after: z.string().default(''),
  reason_zh: z.string().default(''),
  category: z.string().default('lexis.register'),
})

const MistakeSchema = z.object({
  before: z.string().default(''),
  after: z.string().default(''),
  explanation_zh: z.string().default(''),
  category: z.string().default('grammar.structure'),
})

const ResultSchema = z.object({
  revised: z.string(),
  subject: z.string().default(''),
  changes: z.array(ChangeSchema).default([]),
  errors: z.array(MistakeSchema).default([]),
  slots: z.array(z.object({ key: z.string(), hint: z.string().default('') })).default([]),
})

export type PolishResult = z.infer<typeof ResultSchema>

function clampSpan(span: string): string {
  const flat = span.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_SPAN ? `${flat.slice(0, MAX_SPAN - 1)}…` : flat
}

const NUMERAL = /\b\d[\d:./-]*\b/g
const CALENDAR =
  /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/g

/**
 * Facts the edit invented rather than reused. Deterministic on purpose: asking
 * the model to police its own hallucinations is not a check.
 */
export function findAddedFacts(before: string, after: string): string[] {
  const out = new Set<string>()
  const lower = (list: string[]) => new Set(list.map((item) => item.toLowerCase()))

  const beforeNumbers = lower(before.match(NUMERAL) ?? [])
  for (const token of after.match(NUMERAL) ?? []) {
    if (!beforeNumbers.has(token.toLowerCase())) out.add(token)
  }

  const beforeCalendar = lower(before.match(CALENDAR) ?? [])
  for (const token of after.match(CALENDAR) ?? []) {
    if (!beforeCalendar.has(token.toLowerCase())) out.add(token)
  }

  return [...out]
}

const MOCK_RULES: { pattern: RegExp; replace: string; reason: string; category: string }[] = [
  {
    pattern: /\bI want to\b/g,
    replace: 'I would like to',
    reason: 'want to 在正式邮件里显得直白，would like to 更符合学术场合的礼貌程度。',
    category: 'pragmatics.directness',
  },
  {
    pattern: /\bCan you\b/g,
    replace: 'Could you',
    reason: 'Can you 偏口语，Could you 更客气一些。',
    category: 'pragmatics.formality',
  },
  {
    pattern: /\bThanks\b/g,
    replace: 'Thank you',
    reason: 'Thanks 略随意，正式邮件里用 Thank you。',
    category: 'lexis.register',
  },
  {
    pattern: /\bASAP\b/g,
    replace: 'as soon as possible',
    reason: 'ASAP 在学术邮件里读起来像催促。',
    category: 'mechanics.capitalization',
  },
]

function mockPolish(text: string): PolishResult {
  let revised = text
  const changes: PolishResult['changes'] = []

  for (const rule of MOCK_RULES) {
    const matches = revised.match(rule.pattern)
    if (!matches) continue
    revised = revised.replace(rule.pattern, rule.replace)
    changes.push({
      before: matches[0],
      after: rule.replace,
      reason_zh: rule.reason,
      category: rule.category,
    })
  }

  if (!/^\s*dear\b/i.test(revised)) {
    revised = `Dear [Name],\n\n${revised.trim()}`
    changes.unshift({
      before: '(no greeting)',
      after: 'Dear [Name],',
      reason_zh: '英文邮件开头需要称呼，方括号里的内容按收件人替换。',
      category: 'structure.greeting',
    })
  }

  if (!/\b(best regards|kind regards|regards|sincerely|best wishes)\b/i.test(revised)) {
    revised = `${revised.trimEnd()}\n\nBest regards,\n[Your name]`
    changes.push({
      before: '(no sign-off)',
      after: 'Best regards, [Your name]',
      reason_zh: '缺落款时对方不知道写信人是谁。',
      category: 'structure.closing',
    })
  }

  return {
    revised,
    subject: '',
    changes,
    errors: [],
    slots: [{ key: 'recipient_name', hint: '收件人的姓，例如 Chen' }],
  }
}

export async function runPolish(text: string, context: PolishContext) {
  const started = Date.now()
  const raw = env.llm.apiKey
    ? await completeJson(buildPolishMessages(text, context))
    : JSON.stringify(mockPolish(text))

  const parsed = ResultSchema.parse(extractJson(raw))

  const result: PolishResult = {
    ...parsed,
    changes: parsed.changes
      .filter((change) => change.before !== change.after)
      .map((change) => ({
        ...change,
        before: clampSpan(change.before),
        after: clampSpan(change.after),
      })),
    errors: parsed.errors
      .filter((error) => error.before !== error.after)
      .map((error) => ({
        ...error,
        before: clampSpan(error.before),
        after: clampSpan(error.after),
      })),
  }

  return {
    result,
    addedFacts: findAddedFacts(text, result.revised),
    meta: { model: env.llm.apiKey ? env.llm.model : 'mock', ms: Date.now() - started },
  }
}
