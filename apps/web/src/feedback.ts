/**
 * The feedback form is mounted once, near the app root, because it is triggered
 * from the footer and from result pages alike. A custom event keeps those
 * callers from having to thread state through the tree.
 */

export const FEEDBACK_EVENT = 'roboemail:feedback'

export type FeedbackRequest = {
  page: string
  rating?: 0 | 1
  title?: string
}

export function openFeedback(request: FeedbackRequest): void {
  window.dispatchEvent(new CustomEvent<FeedbackRequest>(FEEDBACK_EVENT, { detail: request }))
}
