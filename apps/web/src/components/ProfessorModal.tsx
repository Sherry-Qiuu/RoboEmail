import { useEffect, useRef, useState } from 'react'
import { api, type Professor, type ProfessorProfile } from '../api'

type Props = {
  professor: Professor
  onClose: () => void
  onWriteTo: (professor: Professor) => void
}

function facultyName(faculty: string): string {
  if (faculty === 'se') return '理工学院'
  if (faculty === 'fhss') return '人文社科学院'
  if (faculty === 'nubs') return '商学院'
  return ''
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function ProfessorModal({ professor, onClose, onWriteTo }: Props) {
  const [profile, setProfile] = useState<ProfessorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api
      .professorProfile(professor.id)
      .then((result) => {
        if (alive) setProfile(result.profile)
      })
      .catch(() => {
        if (alive) setError('档案暂时读不出来，稍后再试。')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [professor.id])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const email = profile?.email || professor.email
  const titleEn = profile?.titleEn || professor.title
  const titleCn = profile?.titleCn ?? ''
  const dept = profile?.dept || professor.department
  const deptCn = profile?.deptCn ?? ''
  const research = profile?.research ?? ''
  const papers = profile?.papers ?? []
  const profileUrl = profile?.profileUrl || professor.profileUrl
  const pureUrl = profile?.pureUrl ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      style={{ background: 'var(--edge-backdrop, rgba(20, 20, 18, 0.35))' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="professor-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="panel-float w-full max-w-[720px] outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-8 py-5">
          <div>
            <p className="label">教授档案</p>
            <h2
              id="professor-modal-title"
              className="mt-1 font-display text-[24px] leading-tight tracking-tight"
            >
              {profile?.name || professor.nameEn}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[12px] text-muted transition-colors hover:text-ink"
          >
            关闭 Esc
          </button>
        </div>

        <div className="px-8 py-6">
          <div className="flex gap-6">
            <div className="w-[132px] shrink-0">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={`${profile.name} 的照片`}
                  className="aspect-[3/4] w-full border border-rule object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center border border-rule bg-surface text-[20px] text-faint">
                  {initials(profile?.name || professor.nameEn)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted">
                {titleEn}
                {titleCn && <span className="text-faint"> · {titleCn}</span>}
              </p>
              <p className="mt-1 text-[12px] text-faint">
                {facultyName(profile?.faculty ?? '') || professor.school}
                {dept && ` · ${dept}`}
                {deptCn && `（${deptCn}）`}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {email ? (
                  <a href={`mailto:${email}`} className="text-[13px] text-accent hover:underline">
                    {email}
                  </a>
                ) : (
                  <span className="text-[12px] text-faint">未公开邮箱</span>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => onWriteTo({ ...professor, email: email || professor.email })}
                >
                  写邮件
                </button>
              </div>
            </div>
          </div>

          {loading && <p className="mt-8 text-[13px] text-faint">读取档案…</p>}

          {error && <p className="mt-8 text-[13px] text-warn">{error}</p>}

          {!loading && !error && !profile && (
            <p className="mt-8 border-t border-rule pt-6 text-[13px] text-faint">
              这位老师还没有收录详细档案，可以先按上面的邮箱联系。
            </p>
          )}

          {!loading && profile && (
            <>
              {research && (
                <section className="mt-8 border-t border-rule pt-6">
                  <p className="label">研究方向</p>
                  <p
                    className={`mt-2 whitespace-pre-line text-[13px] leading-relaxed ${
                      expanded ? '' : 'line-clamp-6'
                    }`}
                  >
                    {research}
                  </p>
                  {research.length > 320 && (
                    <button
                      onClick={() => setExpanded((value) => !value)}
                      className="mt-2 text-[12px] text-muted transition-colors hover:text-ink"
                    >
                      {expanded ? '收起' : '展开全部'}
                    </button>
                  )}
                </section>
              )}

              {papers.length > 0 && (
                <section className="mt-8 border-t border-rule pt-6">
                  <p className="label">近期论文</p>
                  <ul className="mt-2">
                    {papers.map((paper) => {
                      const href = paper.doi
                        ? `https://doi.org/${paper.doi}`
                        : paper.pure || ''
                      const meta = [paper.type, paper.year, paper.venue].filter(Boolean).join(' · ')
                      return (
                        <li key={paper.title} className="border-t border-rule py-3 first:border-t-0 first:pt-0">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[13px] hover:underline"
                            >
                              {paper.title}
                            </a>
                          ) : (
                            <span className="text-[13px]">{paper.title}</span>
                          )}
                          {meta && <p className="mt-0.5 text-[12px] text-faint">{meta}</p>}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {(profileUrl || pureUrl) && (
                <div className="mt-8 flex flex-wrap gap-4 border-t border-rule pt-5 text-[12px]">
                  {profileUrl && (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-ink"
                    >
                      学校档案页 ↗
                    </a>
                  )}
                  {pureUrl && (
                    <a
                      href={pureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-ink"
                    >
                      Pure 科研主页 ↗
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
