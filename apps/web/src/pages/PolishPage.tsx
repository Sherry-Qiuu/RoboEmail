import { useEffect, useState } from 'react'
import { api, categoryLabel, isUnauthorized, type PolishResponse } from '../api'
import { DiffText } from '../components/DiffText'
import { ResultRating } from '../components/ResultRating'
import { VoiceButton } from '../components/VoiceButton'
import { readDraft, writeDraft } from '../draft'
import { summaryLine, remember } from '../store'

const RECIPIENTS = ['教授', '导师', '教务行政', '同学', '其他']

const QUICK = [
  {
    id: 'formal',
    label: '更正式',
    instruction: 'Make it more formal and more polite for an academic recipient.',
  },
  {
    id: 'short',
    label: '更简洁',
    instruction: 'Make it shorter. Cut every sentence that carries no information.',
  },
  {
    id: 'polite',
    label: '更礼貌',
    instruction: 'Soften the tone and give the recipient an easier way to decline.',
  },
  {
    id: 'concrete',
    label: '更具体',
    instruction: 'Make the request more concrete and specific.',
  },
]

type Props = {
  onNeedAccount: () => void
  preset?: string
  /** Entry this run came from, so the history can group the chain. */
  sourceId?: string
}

type PickerProps = {
  tags: string[]
  onToggle: (id: string) => void
  direction: string
  setDirection: (value: string) => void
  disabled?: boolean
}

/** Chips plus free text. The same picker drives the first run and every rerun. */
function DirectionPicker({ tags, onToggle, direction, setDirection, disabled }: PickerProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">想改的方向（可多选）</span>
        <VoiceButton onText={(said) => setDirection(`${direction}${said}`)} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK.map((item) => {
          const active = tags.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              aria-pressed={active}
              disabled={disabled}
              className={`border px-3 py-1 text-[12px] transition-colors disabled:opacity-40 ${
                active
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-rule text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <input
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
        maxLength={200}
        disabled={disabled}
        className="field mt-2"
      />
    </div>
  )
}

export function PolishPage({ onNeedAccount, preset = '', sourceId }: Props) {
  /**
   * What the next save points at. It starts at whatever opened this page, then
   * follows each result, so 润色 → 继续改 → 润色 forms one chain instead of two
   * siblings hanging off the original letter.
   */
  const [chainSource, setChainSource] = useState(sourceId ?? '')
  const [text, setText] = useState(
    () => preset || readDraft<{ text: string }>('polish')?.text || '',
  )
  const [direction, setDirection] = useState(
    () => readDraft<{ text: string; direction?: string }>('polish')?.direction ?? '',
  )
  const [recipient, setRecipient] = useState('教授')
  const [formality, setFormality] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<PolishResponse | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tags, setTags] = useState<string[]>(
    () => readDraft<{ text: string; tags?: string[] }>('polish')?.tags ?? [],
  )

  /** Chips and free text are combined into the one instruction the model sees,
   *  and the same selection applies to the first run and to every rerun. */
  function buildInstruction(): string | undefined {
    const parts = QUICK.filter((item) => tags.includes(item.id)).map((item) => item.instruction)
    const free = direction.trim()
    if (free) parts.push(free)
    return parts.length > 0 ? parts.join(' ') : undefined
  }

  function toggleTag(id: string) {
    setTags((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  /** A dropped session sends the user back to sign-in instead of an error. */
  function fail(cause: unknown): void {
    if (isUnauthorized(cause)) {
      setError('')
      onNeedAccount()
      return
    }
    setError(cause instanceof Error ? cause.message : '出错了')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => writeDraft('polish', { text, direction, tags }), 400)
    return () => window.clearTimeout(timer)
  }, [text, direction, tags])

  async function run() {
    setLoading(true)
    setError('')
    setCopied(false)
    try {
      const response = await api.polish(text, {
        recipient,
        formality,
        instruction: buildInstruction(),
      })
      setData(response)
      const entryId = await remember({
        mode: 'polish',
        title: summaryLine(response.result.revised, '润色'),
        text: response.result.revised,
        meta: `${response.result.changes.length} 处改动`,
        payload: response,
        parentId: chainSource || undefined,
      })
      if (entryId) setChainSource(entryId)

      if (response.result.errors.length > 0) {
        void api
          .reportErrors(
            response.result.errors.map((error) => ({
              category: error.category,
              before: error.before,
              after: error.after,
              explanation_zh: error.explanation_zh,
              source_label: '润色',
            })),
          )
          .catch(() => undefined)
      }
    } catch (cause) {
      fail(cause)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Carry the result back into the input so the next round starts from it.
   * The direction and chips stay as they are: only the letter is replaced.
   */
  function continueEdit() {
    if (!data) return
    setText(data.result.revised)
    setData(null)
    setCopied(false)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function copy() {
    if (!data) return
    await navigator.clipboard.writeText(data.result.revised)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">润色</h1>
      <p className="mt-3 text-[14px] text-muted">贴一段英文草稿，拿到改过的版本和逐条理由。</p>

      <div className="mt-9">
        <div className="flex items-baseline justify-between">
          <span className="label">原文</span>
          <VoiceButton lang="en-US" onText={(said) => setText((current) => `${current}${said}`)} />
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="field mt-1 min-h-[220px] resize-y text-[15px] leading-[1.8]"
          spellCheck={false}
        />

        <div className="mt-6">
          <DirectionPicker
            tags={tags}
            onToggle={toggleTag}
            direction={direction}
            setDirection={setDirection}
            disabled={loading}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2">
              <span className="label">收件人</span>
              <select
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                className="field w-auto px-2 py-1 text-[13px]"
              >
                {RECIPIENTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="label">正式度</span>
              <input
                type="range"
                min={1}
                max={5}
                value={formality}
                onChange={(event) => setFormality(Number(event.target.value))}
                className="w-[88px] accent-accent"
              />
              <span className="w-3 text-[12px] text-muted">{formality}</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[12px] text-faint">{text.length}</span>
            <button className="btn btn-primary" onClick={run} disabled={loading || !text.trim()}>
              {loading ? '正在改…' : '开始润色'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-5 text-[13px] text-warn">{error}</p>}

      {data && (
        <div>
          <div className="mt-12 flex items-baseline justify-between border-b border-rule pb-3">
            <div className="flex items-baseline gap-3">
              <span className="label">结果</span>
              <span className="text-[12px] text-faint">
                {data.result.changes.length} 处改动 · {data.meta.model} ·{' '}
                {(data.meta.ms / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                className="text-[12px] text-muted transition-colors hover:text-ink"
                onClick={() => setShowRemoved((value) => !value)}
              >
                {showRemoved ? '只看改后' : '对照原文'}
              </button>
              <button className="btn btn-ghost" onClick={copy}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>

          {data.addedFacts.length > 0 && (
            <p className="mt-5 border-l-2 border-warn bg-warn-soft px-4 py-3 text-[13px] text-warn">
              改后出现了原文没有的内容：{data.addedFacts.join('、')}。发出去之前确认一下。
            </p>
          )}

          <div className="mt-6 border border-rule bg-surface px-7 py-6">
            <DiffText before={text} after={data.result.revised} showRemoved={showRemoved} />
          </div>

          {data.result.changes.length > 0 && (
            <ul className="mt-8">
              {data.result.changes.map((change, index) => (
                <li key={index} className="border-t border-rule py-4 first:border-t-0">
                  <span className="label">{categoryLabel(change.category)}</span>
                  <p className="mt-1 text-[14px]">
                    <span className="text-faint line-through">{change.before}</span>
                    <span className="mx-2 text-faint">→</span>
                    <span className="text-accent">{change.after}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{change.reason_zh}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex justify-end border-t border-rule pt-6">
            <button className="btn btn-ghost" onClick={continueEdit}>
              继续改
            </button>
          </div>

          <ResultRating page="polish" />
        </div>
      )}
    </section>
  )
}
