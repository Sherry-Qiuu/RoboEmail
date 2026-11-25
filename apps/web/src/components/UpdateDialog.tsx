import { useEffect, useRef } from 'react'
import { latestRelease, RELEASES } from '../changelog'

type Props = {
  onClose: () => void
  /** Show every release, not just the newest one. */
  all?: boolean
}

/** Shown once per version: what changed since the visitor last opened the site. */
export function UpdateDialog({ onClose, all = false }: Props) {
  const releases = all ? RELEASES : [latestRelease()]
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
          <p className="label">{all ? '更新记录' : '更新日志'}</p>
          <h2 id="update-title" className="mt-1 font-display text-[24px] leading-tight tracking-tight">
            {all ? '全部版本' : `v${releases[0]!.version}`}
          </h2>
          {!all && releases[0]!.date && (
            <p className="mt-1 text-[12px] text-faint">{releases[0]!.date}</p>
          )}
        </div>

        <div className="max-h-[62vh] overflow-y-auto">
          {releases.map((release) => (
            <section
              key={release.version}
              className="border-b border-rule px-8 py-5 last:border-b-0"
            >
              {all && (
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[16px] leading-none tracking-tight">
                    v{release.version}
                  </span>
                  {release.date && <span className="text-[12px] text-faint">{release.date}</span>}
                </div>
              )}
              <ul className={all ? 'mt-3 space-y-2' : 'space-y-2'}>
                {release.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[14px] leading-relaxed">
                    <span className="text-faint">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex justify-end border-t border-rule px-8 py-4">
          <button className="btn btn-primary" onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
