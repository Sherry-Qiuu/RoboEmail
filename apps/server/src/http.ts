import type { Context } from 'hono'
import type { z } from 'zod'

type Status = Parameters<Context['json']>[1]

export function fail(c: Context, status: Status, error: string, detail?: string) {
  return c.json({ error, detail }, status)
}

/** Parse a JSON body against a zod schema, or produce the 400 response. */
export async function readBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<z.infer<S> | Response> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 400, 'invalid_input', parsed.error.issues[0]?.message)
  return parsed.data
}
