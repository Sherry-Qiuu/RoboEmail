import { useEffect, useState } from 'react'
import { FEEDBACK_EVENT, type FeedbackRequest } from '../feedback'
import { FeedbackDialog } from './FeedbackDialog'

/** Mounted once next to the app; listens for open requests from anywhere. */
export function FeedbackHost() {
  const [request, setRequest] = useState<FeedbackRequest | null>(null)

  useEffect(() => {
    function onOpen(event: Event) {
      setRequest((event as CustomEvent<FeedbackRequest>).detail)
    }
    window.addEventListener(FEEDBACK_EVENT, onOpen)
    return () => window.removeEventListener(FEEDBACK_EVENT, onOpen)
  }, [])

  if (!request) return null
  return <FeedbackDialog request={request} onClose={() => setRequest(null)} />
}
