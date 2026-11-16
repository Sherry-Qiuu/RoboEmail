import { useEffect, useRef } from 'react'
import { latestRelease } from '../changelog'

type Props = {
  onClose: () => void
}

/** Shown once per version: what changed since the visitor last opened the site. */
export function UpdateDialog({ onClose }: Props) {
  const release = latestRelease()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
        aria-labelledby="update-title"
        onClick={(event) => event.stopPropagation()}
        className="panel-float w-full max-w-[520px] outline-none"
      >
        <div className="border-b border-rule px-8 py-5">
          <p className="label">更新日志</p>
          <h2 id="update-title" className="mt-1 font-display text-[24px] leading-tight tracking-tight">
            v{release.version}
          </h2>
          {release.date && <p className="mt-1 text-[12px] text-faint">{release.date}</p>}
        </div>

        <ul className="space-y-2 px-8 py-6">
          {release.items.map((item) => (
            <li key={item} className="flex gap-2 text-[14px] leading-relaxed">
              <span className="text-faint">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end border-t border-rule px-8 py-4">
          <button className="btn btn-primary" onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
