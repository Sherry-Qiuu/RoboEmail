import { z } from 'zod'
import { env } from './env.ts'
import { completeJson, type ChatMessage } from './llm.ts'
import { extractJson } from './json.ts'
import { findPurpose, type Purpose } from './scenarios.ts'

export type GenerateFields = {
  recipientRole?: string
  recipientName?: string
  salutation?: string
  firstContact?: boolean
  background?: string
  ask?: string
  reason?: string
  checked?: string
  deadline?: string
  signature?: string
  formality?: number
}

const ParagraphSchema = z.object({
  en: z.string(),
  zh: z.string().default(''),
  note_zh: z.string().default(''),
})

const ResultSchema = z.object({
  subject_options: z.array(z.string()).default([]),
  greeting: z.string().default(''),
  paragraphs: z.array(ParagraphSchema).default([]),
  closing: z.string().default(''),
  slots: z.array(z.object({ key: z.string(), hint: z.string().default('') })).default([]),
})

export type GenerateResult = z.infer<typeof ResultSchema>

const SYSTEM = `You write emails for a Chinese student at a British university (UNNC, English-medium, British conventions).

You receive a scenario and a handful of facts. Write the email.

Rules:
1. Use only the facts you are given. Never invent names, dates, numbers, module codes, deadlines or promises.
2. When the email genuinely needs a fact that was not provided, leave a named slot in the text instead of inventing it: {{module_code}}. List every slot you used under "slots".
3. British English spelling (organise, programme, colour). British academic address: Professor for a chair, Dr otherwise.
4. Four paragraphs at most. No filler opening. Never start with "I hope this email finds you well".
5. Where the email asks for something, give the recipient an easy way to say no.
6. "zh" is natural Chinese, not a word-for-word translation. "note_zh" is one sentence saying what that paragraph does.
7. "subject_options" holds two or three short subject lines, under 70 characters, no padding words.
8. Output a single JSON object, no markdown fences, no commentary.

JSON shape:
{
  "subject_options": ["...", "..."],
  "greeting": "Dear Professor Chen,",
  "paragraphs": [{"en": "...", "zh": "...", "note_zh": "..."}],
  "closing": "Best regards,\\n[Your name]",
  "slots": [{"key": "module_code", "hint": "课程代码，例如 COMP1033"}]
}`

const FACT_LABELS: [keyof GenerateFields, string][] = [
  ['recipientRole', 'recipient role'],
  ['recipientName', 'recipient name'],
  ['salutation', 'address them with exactly this greeting line'],
  ['background', 'background'],
  ['ask', 'what the sender needs'],
  ['reason', 'why they need it'],
  ['checked', 'already checked'],
  ['deadline', 'expected reply or deadline'],
  ['signature', 'signature'],
]

export function buildGenerateMessages(purpose: Purpose, fields: GenerateFields): ChatMessage[] {
  const facts = FACT_LABELS.filter(([key]) => {
    const value = fields[key]
    return typeof value === 'string' && value.trim().length > 0
  }).map(([key, label]) => `- ${label}: ${String(fields[key]).trim()}`)

  const lines = [
    `Scenario: ${purpose.label} (${purpose.id})`,
    `What this email has to do: ${purpose.brief}`,
    `First contact: ${fields.firstContact ? 'yes' : 'no'}`,
    `Formality target (1-5): ${fields.formality ?? 3}`,
    '',
    'Facts:',
    ...(facts.length > 0 ? facts : ['- (none)']),
  ]

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: lines.join('\n') },
  ]
}

/**
 * Skeleton used when no model key is configured. It is deliberately generic:
 * the point is to exercise the UI, not to pretend an email was written.
 */
function mockGenerate(fields: GenerateFields): GenerateResult {
  const closing = (fields.formality ?? 3) >= 4 ? 'Yours sincerely,' : 'Best regards,'
  return {
    subject_options: ['Question about {{topic}}', '{{topic}}: one question'],
    greeting: 'Dear {{recipient_name}},',
    paragraphs: [
      {
        en: 'I am writing to {{action}}.',
        zh: '开头说明来意。',
        note_zh: '第一句就说清楚这封信要做什么。',
      },
      {
        en: 'For context, {{background}}.',
        zh: '交代背景。',
        note_zh: '给对方足够的前因，省掉一次来回。',
      },
      {
        en: 'Would you be able to {{request}} by {{deadline}}?',
        zh: '提出请求和时间。',
        note_zh: '请求具体，并留下时间点。',
      },
      {
        en: 'Thank you for your time.',
        zh: '致谢收尾。',
        note_zh: '简短收尾，不啰嗦。',
      },
    ],
    closing: `${closing}\n${fields.signature?.trim() || '{{signature}}'}`,
    slots: [
      { key: 'recipient_name', hint: '收件人的姓，例如 Chen' },
      { key: 'topic', hint: '一句话主题，例如 COMP1033 coursework' },
      { key: 'action', hint: '你要做什么，例如 ask about the deadline' },
      { key: 'background', hint: '背景' },
      { key: 'request', hint: '你希望对方做什么' },
      { key: 'deadline', hint: '期望时间' },
      { key: 'signature', hint: '你的英文名' },
    ],
  }
}

export async function runGenerate(purposeId: string, fields: GenerateFields) {
  const purpose = findPurpose(purposeId)
  const started = Date.now()

  const raw = env.llm.apiKey
    ? await completeJson(buildGenerateMessages(purpose, fields))
    : JSON.stringify(mockGenerate(fields))

  const result = ResultSchema.parse(extractJson(raw))

  return {
    result,
    meta: { model: env.llm.apiKey ? env.llm.model : 'mock', ms: Date.now() - started },
  }
}
