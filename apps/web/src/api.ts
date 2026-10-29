export type User = {
  id: string
  username: string
  email: string
  isUnnc: boolean
  verified: boolean
}

export type Change = {
  before: string
  after: string
  reason_zh: string
  category: string
}

export type Mistake = {
  before: string
  after: string
  explanation_zh: string
  category: string
}

export type PolishResult = {
  revised: string
  subject: string
  changes: Change[]
  errors: Mistake[]
  slots: { key: string; hint: string }[]
}

export type PolishResponse = {
  result: PolishResult
  addedFacts: string[]
  meta: { model: string; ms: number }
  trial?: boolean
}

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

export type GenerateResult = {
  subject_options: string[]
  greeting: string
  paragraphs: { en: string; zh: string; note_zh: string }[]
  closing: string
  slots: { key: string; hint: string }[]
}

export type GenerateResponse = {
  result: GenerateResult
  meta: { model: string; ms: number }
  trial?: boolean
}

export type LearnItem = {
  id: string
  category: string
  before: string
  after: string
  explanation_zh: string
  source_label: string | null
  mastered: number
  created_at: string
}

export type Professor = {
  id: string
  nameEn: string
  surname: string
  title: string
  role: string
  school: string
  department: string
  email: string
  profileUrl: string
  salutation: string
  updatedAt: string
}

export type ReportItem = {
  category: string
  before: string
  after: string
  explanation_zh: string
  source_label?: string
}

export type Insights = {
  total: number
  mastered: number
  byCategory: { category: string; n: number }[]
  daily: { day: string; n: number }[]
  items: LearnItem[]
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error((data.detail as string) || (data.error as string) || '请求失败')
  }
  return data as T
}

export const api = {
  me: () => request<{ user: User; quota: { used: number; limit: number } }>('/api/auth/me'),

  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, email: string, password: string, isUnnc: boolean) =>
    request<{ ok: boolean; delivered: boolean; devCode?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, isUnnc }),
    }),

  verify: (email: string, code: string) =>
    request<{ ok: boolean }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  forgot: (email: string) =>
    request<{ ok: boolean }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  reset: (token: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  changePassword: (current: string, next: string) =>
    request<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    }),

  polish: (
    text: string,
    context?: { recipient?: string; formality?: number; instruction?: string },
  ) =>
    request<PolishResponse>('/api/polish', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    }),

  generate: (purpose: string, fields: GenerateFields) =>
    request<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ purpose, fields }),
    }),

  reportErrors: (items: ReportItem[]) =>
    request<{ added: number }>('/api/errors/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  insights: () => request<Insights>('/api/insights'),

  setMastered: (id: string) =>
    request<{ mastered: boolean }>(`/api/errors/${id}/mastered`, { method: 'POST' }),

  professors: (q: string) =>
    request<{ items: Professor[]; total: number }>(
      `/api/professors?q=${encodeURIComponent(q)}`,
    ),

  setUnnc: (isUnnc: boolean) =>
    request<{ isUnnc: boolean }>('/api/auth/unnc', {
      method: 'POST',
      body: JSON.stringify({ isUnnc }),
    }),
}

const CATEGORY_LABELS: Record<string, string> = {
  'grammar.tense': '时态',
  'grammar.agreement': '主谓一致',
  'grammar.article': '冠词',
  'grammar.preposition': '介词',
  'grammar.plural': '单复数',
  'grammar.structure': '句法',
  'lexis.collocation': '搭配',
  'lexis.word_form': '词性',
  'lexis.chinese_english': '中式表达',
  'lexis.register': '语域',
  'pragmatics.directness': '语气·直接',
  'pragmatics.humility': '语气·卑微',
  'pragmatics.formality': '语气·正式度',
  'mechanics.punctuation': '标点',
  'mechanics.capitalization': '大小写',
  'mechanics.spacing': '空格',
  'structure.subject_line': '主题行',
  'structure.greeting': '称呼',
  'structure.closing': '落款',
  'structure.paragraphing': '分段',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
