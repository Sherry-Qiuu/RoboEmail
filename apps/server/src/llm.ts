import { env } from './env.ts'

export type ChatMessage = { role: 'system' | 'user'; content: string }

type ChatResponse = {
  choices?: { message?: { content?: string } }[]
}

export async function completeJson(messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env.llm.timeoutMs)
  try {
    const res = await fetch(`${env.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: env.llm.model,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`model returned ${res.status} ${detail.slice(0, 300)}`)
    }
    const data = (await res.json()) as ChatResponse
    return data.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}
