export function extractJson(raw: string): unknown {
  const text = raw.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model did not return a JSON object')
  return JSON.parse(text.slice(start, end + 1))
}
