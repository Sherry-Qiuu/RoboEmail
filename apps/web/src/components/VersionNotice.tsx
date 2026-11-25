import { useEffect, useState } from 'react'
import { CURRENT_VERSION } from '../changelog'
import { CHANGELOG_EVENT } from '../releaseNotes'
import { UpdateDialog } from './UpdateDialog'

const SEEN_KEY = `roboemail:seen-version`

/**
 * Shows the release notes once per version. Mounted next to the app rather than
 * inside it, so it does not depend on which page the visitor lands on.
 *
 * It also listens for an explicit request to open the full history, which is how
 * the settings page offers it.
 */
export function VersionNotice() {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let seen = ''
    try {
      seen = window.localStorage.getItem(SEEN_KEY) ?? ''
    } catch {
      // Private mode blocks storage; showing the notes every time is worse than
      // showing them never.
      return
    }
    if (seen !== CURRENT_VERSION) setOpen(true)
  }, [])

  useEffect(() => {
    function onRequest() {
      setAll(true)
      setOpen(true)
    }
    window.addEventListener(CHANGELOG_EVENT, onRequest)
    return () => window.removeEventListener(CHANGELOG_EVENT, onRequest)
  }, [])

  function close() {
    // Opening the history by hand is not the same as being told what changed, so
    // it must not swallow the one-time notice.
    if (!all) {
      try {
        window.localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
      } catch {
        // Nothing to do: the dialog simply reappears next visit.
      }
    }
    setOpen(false)
    setAll(false)
  }

  if (!open) return null
  return <UpdateDialog all={all} onClose={close} />
}
