import type { ChatMessage } from './llm.ts'

export type PolishContext = {
  recipient?: string
  relationship?: string
  formality?: number
  instruction?: string
}

const SYSTEM = `You are an editor of academic emails. The author is a Chinese student at a British university (UNNC, English-medium, British conventions).

You receive one email the student wrote in English. Edit it.

Rules:
1. Never change facts. Do not add dates, numbers, names, deadlines, promises or excuses that are not in the original. If something is clearly missing, list it in "slots" instead of inventing it.
2. Keep the author's own voice. Do not rewrite it into generic corporate English.
3. Use British English spelling (organise, programme, colour, centre) and British academic address conventions.
4. "changes" lists only the spans you actually edited. Every entry must satisfy before !== after. If nothing changed, return an empty array.
5. "errors" lists only real language errors you corrected. A style preference is not an error. If there are none, return an empty array.
6. Keep every "before" and "after" under 200 characters, one sentence each.
7. "reason_zh" and "explanation_zh" must be Simplified Chinese, one or two sentences, no markdown.
8. Output a single JSON object. No markdown fences, no commentary.

Category codes, valid for both "changes" and "errors":
grammar.tense, grammar.agreement, grammar.article, grammar.preposition, grammar.plural,
grammar.structure, lexis.collocation, lexis.word_form, lexis.chinese_english, lexis.register,
pragmatics.directness, pragmatics.humility, pragmatics.formality,
mechanics.punctuation, mechanics.capitalization, mechanics.spacing,
structure.subject_line, structure.greeting, structure.closing, structure.paragraphing

JSON shape:
{
  "revised": "the full edited email, plain text, keep the line breaks",
  "subject": "a subject line only when the original has none, otherwise an empty string",
  "changes": [{"before": "...", "after": "...", "reason_zh": "...", "category": "..."}],
  "errors": [{"before": "...", "after": "...", "explanation_zh": "...", "category": "..."}],
  "slots": [{"key": "professor_name", "hint": "..."}]
}`

export function buildPolishMessages(text: string, context: PolishContext): ChatMessage[] {
  const lines = [
    `Recipient: ${context.recipient ?? 'unknown'}`,
    `Relationship: ${context.relationship ?? 'unknown'}`,
    `Formality target (1-5): ${context.formality ?? 3}`,
  ]

  if (context.instruction) {
    lines.push(
      '',
      `The author asked for this change: ${context.instruction}`,
      'Apply it, and keep every rule above.',
    )
  }

  lines.push('', 'Email:', text)

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: lines.join('\n') },
  ]
}
