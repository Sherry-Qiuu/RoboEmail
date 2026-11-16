import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { CURRENT_VERSION } from '../changelog'
import type { FeedbackRequest } from '../feedback'

type Props = {
  request: FeedbackRequest
  onClose: () => void
}

export function FeedbackDialog({ request, onClose }: Props) {
  const [title, setTitle] = useState(request.title ?? '')
  const [body, setBody] = useState('')
  const [contactOk, setContactOk] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)

  // A rating is already stored when the dialog opens from a "not useful" click,
  // so an empty form there is not an error: there is simply nothing to add.
  const canSubmit = body.trim().length > 0 || request.rating === undefined

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (!canSubmit) {
      onClose()
      return
    }
    setSending(true)
    setError('')
    try {
      await api.feedback({
        page: request.page,
        version: CURRENT_VERSION,
        rating: request.rating,
        title: title.trim(),
        body: body.trim(),
        contactOk,
      })
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，稍后再试')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-16"
      style={{ background: 'var(--edge-backdrop, rgba(20, 20, 18, 0.35))' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(event) => event.stopPropagation()}
        className="panel-float w-full max-w-[560px] outline-none"
      >
        <div className="border-b border-rule px-8 py-5">
          <p className="label">反馈</p>
          <h2 id="feedback-title" className="mt-1 font-display text-[22px] leading-tight tracking-tight">
            说说哪里不对
          </h2>
        </div>

        {sent ? (
          <>
            <p className="px-8 py-8 text-[14px]">收到了，谢谢。我会看的。</p>
            <div className="flex justify-end border-t border-rule px-8 py-4">
              <button className="btn btn-primary" onClick={onClose}>
                好
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 px-8 py-6">
              <p className="text-[12px] text-faint">
                描述问题就好，不要把邮件正文贴进来。
              </p>

              <label className="block">
                <span className="label">标题（选填）</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  className="field mt-1"
                />
              </label>

              <label className="block">
                <span className="label">详细说明</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={1000}
                  className="field mt-1 min-h-[120px] resize-y"
                />
                <span className="mt-1 block text-right text-[11px] text-faint">
                  {body.length}/1000
                </span>
              </label>

              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={contactOk}
                  onChange={(event) => setContactOk(event.target.checked)}
                  className="accent-accent"
                />
                希望你在邮件里回复我
              </label>

              {error && <p className="text-[12px] text-warn">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-rule px-8 py-4">
              <button className="btn btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={sending}>
                {sending ? '提交中…' : '提交'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
