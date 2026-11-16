import { useEffect, useState } from 'react'
import { CURRENT_VERSION } from '../changelog'
import { UpdateDialog } from './UpdateDialog'

const SEEN_KEY = `roboemail:seen-version`

/**
 * Shows the release notes once per version. Mounted next to the app rather than
 * inside it, so it does not depend on which page the visitor lands on.
 */
export function VersionNotice() {
  const [open, setOpen] = useState(false)

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

  function close() {
    try {
      window.localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
    } catch {
      // Nothing to do: the dialog simply reappears next visit.
    }
    setOpen(false)
  }

  if (!open) return null
  return <UpdateDialog onClose={close} />
}
