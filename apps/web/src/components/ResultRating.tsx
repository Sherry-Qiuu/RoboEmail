import { useState } from 'react'
import { api } from '../api'
import { CURRENT_VERSION } from '../changelog'
import { openFeedback } from '../feedback'

type Props = {
  page: string
}

/**
 * One click on "useful" is recorded immediately; "not useful" also opens the
 * form, because that is the moment someone has something specific to say.
 */
export function ResultRating({ page }: Props) {
  const [rated, setRated] = useState<1 | 0 | null>(null)

  async function rate(value: 1 | 0) {
    if (rated !== null) return
    setRated(value)
    await api.feedback({ rating: value, page, version: CURRENT_VERSION }).catch(() => undefined)
    if (value === 0) openFeedback({ page, rating: 0 })
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 text-[12px] text-muted">
      {rated === null ? (
        <>
          <span>这次结果有用吗？</span>
          <button className="btn btn-ghost !min-h-[28px] !px-3 !text-[12px]" onClick={() => rate(1)}>
            有用
          </button>
          <button className="btn btn-ghost !min-h-[28px] !px-3 !text-[12px]" onClick={() => rate(0)}>
            没用
          </button>
        </>
      ) : (
        <span>{rated === 1 ? '谢谢，收到你的评价了。' : '谢谢，已经记下这次不理想。'}</span>
      )}
    </div>
  )
}
