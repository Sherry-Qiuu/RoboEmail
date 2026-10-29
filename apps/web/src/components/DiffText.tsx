import { useMemo } from 'react'
import { diffWords } from 'diff'

type Props = {
  before: string
  after: string
  showRemoved?: boolean
}

/**
 * The highlight is computed from a real word diff, so it never drifts from the
 * text. The model's own description of its edits is shown separately.
 */
export function DiffText({ before, after, showRemoved = false }: Props) {
  const parts = useMemo(() => diffWords(before, after), [before, after])

  return (
    <div className="text-[15px] leading-[1.9] whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.added) {
          return (
            <ins
              key={index}
              className="rounded-[2px] bg-accent-soft px-0.5 text-ink no-underline"
            >
              {part.value}
            </ins>
          )
        }
        if (part.removed) {
          return showRemoved ? (
            <del key={index} className="text-faint">
              {part.value}
            </del>
          ) : null
        }
        return <span key={index}>{part.value}</span>
      })}
    </div>
  )
}
