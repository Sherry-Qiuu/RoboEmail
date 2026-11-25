export const CHANGELOG_EVENT = 'roboemail:changelog'

/** Opens the full release history, wherever it is triggered from. */
export function openChangelog(): void {
  window.dispatchEvent(new CustomEvent(CHANGELOG_EVENT))
}
