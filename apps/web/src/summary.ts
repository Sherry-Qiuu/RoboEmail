/**
 * A preview for the history list. The first line of a polished email is almost
 * always "Dear Professor X," which tells the reader nothing, so greeting and
 * sign-off lines are skipped and generic openers are trimmed off the front.
 *
 * Kept free of browser APIs so it can be exercised from Node.
 */

const GREETING = /^(dear|hi|hello|to whom it may concern)\b/i
const SIGN_OFF =
  /^(?:(?:best|kind|warm|many)\s+)?(?:regards|wishes|sincerely|yours|respectfully|thanks|thank you|cheers)\b/i
const OPENER = /^i (?:hope|trust)\b/i
// Chinese punctuation is not followed by a space, so it needs its own branch.
const FIRST_SENTENCE = /^.*?(?:[.!?](?=\s|$)|[。！？])/

function withoutOpener(line: string): string {
  let rest = line
  while (OPENER.test(rest)) {
    const sentence = rest.match(FIRST_SENTENCE)
    if (!sentence) return ''
    rest = rest.slice(sentence[0].length).trim()
  }
  return rest
}

export function summaryLine(text: string, fallback: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const body = lines.filter((line) => !GREETING.test(line) && !SIGN_OFF.test(line))
  const candidate = body.map(withoutOpener).find(Boolean) ?? lines[0] ?? fallback

  const sentence = candidate.match(FIRST_SENTENCE)?.[0] ?? candidate
  const clean = sentence.replace(/\s+/g, ' ').trim()
  return clean.length > 72 ? `${clean.slice(0, 72).trimEnd()}…` : clean
}
