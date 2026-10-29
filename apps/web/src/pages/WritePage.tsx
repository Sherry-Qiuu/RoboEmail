import { useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  type GenerateFields,
  type GenerateResponse,
  type GenerateResult,
  type Professor,
} from '../api'
import { SlotText, fillSlots } from '../components/SlotText'
import { TrialNote } from '../components/TrialNote'
import { VoiceButton } from '../components/VoiceButton'
import { readDraft, writeDraft } from '../draft'
import { firstLine, remember } from '../store'

const PURPOSES = [
  { id: 'inquiry', label: '询问信息' },
  { id: 'request', label: '请求帮忙' },
  { id: 'extension', label: '请假与延期' },
  { id: 'meeting', label: '约时间' },
  { id: 'apology', label: '道歉' },
  { id: 'thanks', label: '感谢' },
  { id: 'complaint', label: '投诉反馈' },
  { id: 'application', label: '申请与套磁' },
  { id: 'other', label: '其他' },
]

const ROLES = ['教授', '导师', '教务行政', '同学', '其他']

const EMPTY: GenerateFields = {
  recipientRole: '教授',
  recipientName: '',
  firstContact: true,
  background: '',
  ask: '',
  reason: '',
  checked: '',
  deadline: '',
  signature: '',
  formality: 3,
}

type Props = {
  onNeedAccount: () => void
  onPolish: (text: string) => void
  seed?: Professor | null
}

function composeBody(result: GenerateResult): string {
  return [result.greeting, ...result.paragraphs.map((paragraph) => paragraph.en), result.closing]
    .filter((line) => line.trim().length > 0)
    .join('\n\n')
}

type Draft = {
  purpose: string
  fields: GenerateFields
  salutation: string
}

export function WritePage({ onNeedAccount, onPolish, seed }: Props) {
  const [restored] = useState(() => (seed ? null : readDraft<Draft>('write')))
  const [purpose, setPurpose] = useState(restored?.purpose ?? 'inquiry')
  const [fields, setFields] = useState<GenerateFields>({
    ...EMPTY,
    recipientName: seed?.nameEn ?? '',
    ...(restored?.fields ?? {}),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<GenerateResponse | null>(null)
  const [subjectIndex, setSubjectIndex] = useState(0)
  const [slotValues, setSlotValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState('')
  const [matches, setMatches] = useState<Professor[]>([])
  const [picking, setPicking] = useState(false)
  const [salutation, setSalutation] = useState(seed?.salutation ?? restored?.salutation ?? '')
  const typing = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timer = window.setTimeout(
      () => writeDraft('write', { purpose, fields, salutation }),
      400,
    )
    return () => window.clearTimeout(timer)
  }, [purpose, fields, salutation])

  function onNameInput(value: string) {
    set('recipientName')(value)
    setSalutation('')
    window.clearTimeout(typing.current)

    if (value.trim().length === 0 || fields.recipientRole === '教务行政') {
      setMatches([])
      setPicking(false)
      return
    }

    typing.current = window.setTimeout(async () => {
      const result = await api.professors(value.trim()).catch(() => null)
      setMatches(result?.items ?? [])
      setPicking(Boolean(result?.items.length))
    }, 180)
  }

  function pick(item: Professor) {
    set('recipientName')(item.nameEn)
    setSalutation(item.salutation)
    setMatches([])
    setPicking(false)
  }

  const set = (key: keyof GenerateFields) => (value: GenerateFields[keyof GenerateFields]) =>
    setFields((current) => ({ ...current, [key]: value }))

  async function run() {
    setLoading(true)
    setError('')
    setCopied('')
    try {
      const response = await api.generate(purpose, { ...fields, salutation })
      setData(response)
      setSubjectIndex(0)
      setSlotValues({})
      remember(response.trial, {
        mode: 'generate',
        title: firstLine(response.result.subject_options[0] ?? '', '写邮件'),
        text: fillSlots(composeBody(response.result), {}),
        meta: `${response.result.paragraphs.length} 段`,
        payload: response,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setLoading(false)
    }
  }

  const bodyText = useMemo(() => (data ? composeBody(data.result) : ''), [data])

  const subjectText = data ? (data.result.subject_options[subjectIndex] ?? '') : ''

  async function copy(which: 'body' | 'subject') {
    const text =
      which === 'subject'
        ? fillSlots(subjectText, slotValues)
        : `Subject: ${fillSlots(subjectText, slotValues)}\n\n${fillSlots(bodyText, slotValues)}`
    await navigator.clipboard.writeText(text)
    setCopied(which)
    window.setTimeout(() => setCopied(''), 1600)
  }

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">写邮件</h1>

      <div className="mt-8 flex flex-wrap gap-2">
        {PURPOSES.map((item) => (
          <button
            key={item.id}
            onClick={() => setPurpose(item.id)}
            className={`border px-3 py-1.5 text-[13px] transition-colors ${
              purpose === item.id
                ? 'border-ink bg-ink text-paper'
                : 'border-rule text-muted hover:border-ink hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-9 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">收件人</span>
            <select
              value={fields.recipientRole}
              onChange={(event) => {
                set('recipientRole')(event.target.value)
                if (event.target.value === '教务行政') setSalutation('')
              }}
              className="field mt-1"
            >
              {ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>

          <div className="relative">
            <span className="label">
              {fields.recipientRole === '教务行政' ? '部门' : '姓名'}
            </span>
            <input
              value={fields.recipientName}
              onChange={(event) => onNameInput(event.target.value)}
              onFocus={() => matches.length > 0 && setPicking(true)}
              onBlur={() => window.setTimeout(() => setPicking(false), 120)}
              className="field mt-1"
              autoComplete="off"
            />

            {picking && matches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-rule bg-surface">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        pick(item)
                      }}
                      className="block w-full px-3 py-2 text-left transition-colors hover:bg-paper"
                    >
                      <span className="text-[13px]">{item.nameEn}</span>
                      <span className="ml-2 text-[12px] text-faint">
                        {item.title} · {item.department}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {salutation && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                <span className="text-accent">{salutation}</span>
                <button
                  type="button"
                  onClick={() => setSalutation('')}
                  className="text-faint transition-colors hover:text-ink"
                >
                  ×
                </button>
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">背景</span>
            <VoiceButton
              onText={(said) => set('background')(`${fields.background ?? ''}${said}`)}
            />
          </div>
          <textarea
            value={fields.background}
            onChange={(event) => set('background')(event.target.value)}
            className="field mt-1 min-h-[84px] resize-y"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">你希望对方做什么</span>
            <VoiceButton onText={(said) => set('ask')(`${fields.ask ?? ''}${said}`)} />
          </div>
          <textarea
            value={fields.ask}
            onChange={(event) => set('ask')(event.target.value)}
            className="field mt-1 min-h-[84px] resize-y"
          />
        </div>

        <details className="border border-rule px-5 py-4">
          <summary className="cursor-pointer text-[13px] text-muted">补充</summary>

          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={fields.firstContact}
                  onChange={(event) => set('firstContact')(event.target.checked)}
                  className="accent-accent"
                />
                初次联系
              </label>

              <label className="flex items-center gap-2">
                <span className="label">正式度</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={fields.formality}
                  onChange={(event) => set('formality')(Number(event.target.value))}
                  className="w-[88px] accent-accent"
                />
                <span className="w-3 text-[12px] text-muted">{fields.formality}</span>
              </label>
            </div>

            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="label">原因</span>
                <VoiceButton
                  onText={(said) => set('reason')(`${fields.reason ?? ''}${said}`)}
                />
              </div>
              <textarea
                value={fields.reason}
                onChange={(event) => set('reason')(event.target.value)}
                className="field mt-1 min-h-[64px] resize-y"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">已经查过</span>
                <input
                  value={fields.checked}
                  onChange={(event) => set('checked')(event.target.value)}
                  className="field mt-1"
                />
              </label>

              <label className="block">
                <span className="label">期望时间</span>
                <input
                  value={fields.deadline}
                  onChange={(event) => set('deadline')(event.target.value)}
                  className="field mt-1"
                />
              </label>
            </div>

            <label className="block">
              <span className="label">署名</span>
              <input
                value={fields.signature}
                onChange={(event) => set('signature')(event.target.value)}
                className="field mt-1"
              />
            </label>
          </div>
        </details>

        <div className="flex items-center justify-end gap-4">
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? '正在写…' : '生成'}
          </button>
        </div>

        {error && <p className="text-[13px] text-warn">{error}</p>}
      </div>

      {data && (
        <div className="mt-14">
          <div className="flex items-baseline justify-between border-b border-rule pb-3">
            <span className="label">结果</span>
            <span className="text-[12px] text-faint">
              {data.result.paragraphs.length} 段 · {data.meta.model} ·{' '}
              {(data.meta.ms / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="mt-8">
            <span className="label">主题行</span>
            <div className="mt-3 space-y-2">
              {data.result.subject_options.map((subject, index) => (
                <button
                  key={index}
                  onClick={() => setSubjectIndex(index)}
                  className={`block w-full border px-4 py-3 text-left text-[14px] transition-colors ${
                    index === subjectIndex
                      ? 'border-ink bg-surface'
                      : 'border-rule text-muted hover:border-ink'
                  }`}
                >
                  <SlotText text={subject} values={slotValues} />
                </button>
              ))}
            </div>
          </div>

          {data.result.slots.length > 0 && (
            <div className="mt-8 border border-rule px-5 py-4">
              <span className="label">待填 {data.result.slots.length} 项</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.result.slots.map((slot) => (
                  <label key={slot.key} className="block">
                    <span className="text-[12px] text-faint">{slot.hint || slot.key}</span>
                    <input
                      value={slotValues[slot.key] ?? ''}
                      onChange={(event) =>
                        setSlotValues((current) => ({ ...current, [slot.key]: event.target.value }))
                      }
                      className="field mt-1 py-1 text-[13px]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 border border-rule bg-surface px-7 py-6">
            <p className="text-[15px] leading-[1.9]">
              <SlotText text={data.result.greeting} values={slotValues} />
            </p>

            {data.result.paragraphs.map((paragraph, index) => (
              <div key={index} className="mt-5">
                <p className="text-[15px] leading-[1.9]">
                  <SlotText text={paragraph.en} values={slotValues} />
                </p>
                {paragraph.zh && (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{paragraph.zh}</p>
                )}
                {paragraph.note_zh && (
                  <p className="mt-1 text-[12px] text-faint">{paragraph.note_zh}</p>
                )}
              </div>
            ))}

            <p className="mt-5 text-[15px] leading-[1.9] whitespace-pre-wrap">
              <SlotText text={data.result.closing} values={slotValues} />
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={() => copy('body')}>
              {copied === 'body' ? '已复制' : '复制整封'}
            </button>
            <button className="btn btn-ghost" onClick={() => copy('subject')}>
              {copied === 'subject' ? '已复制' : '复制主题'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onPolish(fillSlots(bodyText, slotValues))}
            >
              继续润色
            </button>
            <button className="btn btn-ghost" onClick={run} disabled={loading}>
              重新生成
            </button>
          </div>

          {data.trial && <TrialNote onRegister={onNeedAccount} />}
        </div>
      )}
    </section>
  )
}
