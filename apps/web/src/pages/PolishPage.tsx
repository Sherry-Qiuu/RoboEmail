import { useEffect, useState } from 'react'
import { api, categoryLabel, type PolishResponse } from '../api'
import { DiffText } from '../components/DiffText'
import { TrialNote } from '../components/TrialNote'
import { VoiceButton } from '../components/VoiceButton'
import { readDraft, writeDraft } from '../draft'
import { firstLine, remember } from '../store'

const RECIPIENTS = ['教授', '导师', '教务行政', '同学', '其他']

const QUICK = [
  { label: '更正式', instruction: 'Make it more formal and more polite for an academic recipient.' },
  { label: '更简洁', instruction: 'Make it shorter. Cut every sentence that carries no information.' },
  { label: '更礼貌', instruction: 'Soften the tone and give the recipient an easier way to decline.' },
  { label: '更具体', instruction: 'Make the request more concrete and specific.' },
]

type Props = {
  onNeedAccount: () => void
  preset?: string
}

export function PolishPage({ onNeedAccount, preset = '' }: Props) {
  const [text, setText] = useState(
    () => preset || readDraft<{ text: string }>('polish')?.text || '',
  )
  const [recipient, setRecipient] = useState('教授')
  const [formality, setFormality] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<PolishResponse | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [round, setRound] = useState(0)
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => writeDraft('polish', { text }), 400)
    return () => window.clearTimeout(timer)
  }, [text])

  async function run() {
    setLoading(true)
    setError('')
    setCopied(false)
    setRound(0)
    try {
      const response = await api.polish(text, { recipient, formality })
      setData(response)
      remember(response.trial, {
        mode: 'polish',
        title: firstLine(response.result.revised, '润色'),
        text: response.result.revised,
        meta: `${response.result.changes.length} 处改动`,
        payload: response,
      })

      if (!response.trial && response.result.errors.length > 0) {
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
      setError(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setLoading(false)
    }
  }

  async function iterate(note: string) {
    if (!data) return
    setLoading(true)
    setError('')
    try {
      const response = await api.polish(data.result.revised, {
        recipient,
        formality,
        instruction: note,
      })
      setData(response)
      setRound((current) => current + 1)
      setInstruction('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setLoading(false)
    }
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

          <div className="mt-10 border-t border-rule pt-6">
            <div className="flex items-baseline justify-between">
              <span className="label">继续改</span>
              {round > 0 && <span className="text-[12px] text-faint">第 {round + 1} 版</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((item) => (
                <button
                  key={item.label}
                  onClick={() => iterate(item.instruction)}
                  disabled={loading}
                  className="border border-rule px-3 py-1 text-[12px] text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && instruction.trim() && !loading) {
                    void iterate(instruction.trim())
                  }
                }}
                className="field"
              />
              <button
                className="btn btn-ghost shrink-0"
                onClick={() => void iterate(instruction.trim())}
                disabled={loading || !instruction.trim()}
              >
                改
              </button>
            </div>
          </div>

          {data.trial && <TrialNote onRegister={onNeedAccount} />}
        </div>
      )}
    </section>
  )
}
