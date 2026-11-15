import type { HistoryEntry } from './store'

/**
 * The history list exports to documents. Everything is built in the browser:
 * no PDF or Office library is bundled, so Word gets a Word-compatible HTML file
 * (`.doc`) and PDF goes through the browser's own print dialog.
 */

const MODE_LABEL: Record<string, string> = {
  polish: '润色',
  generate: '写邮件',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stamp(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function anchor(entry: HistoryEntry, index: number): string {
  return `mail-${index + 1}-${entry.id.slice(0, 8)}`
}

function article(entry: HistoryEntry, index: number): string {
  const mode = MODE_LABEL[entry.mode] ?? entry.mode
  const body = escapeHtml(entry.text).replace(/\n/g, '<br />')
  return `<article class="entry" id="${anchor(entry, index)}">
  <p class="meta">${escapeHtml(stamp(entry.createdAt))} · ${mode} · ${escapeHtml(entry.meta)}</p>
  <h2>${escapeHtml(entry.title)}</h2>
  <div class="body">${body}</div>
</article>`
}

function bookmarks(entries: HistoryEntry[]): string {
  return entries
    .map((entry, index) => {
      const mode = MODE_LABEL[entry.mode] ?? entry.mode
      return `<li><a href="#${anchor(entry, index)}"><span class="b-title">${escapeHtml(
        entry.title,
      )}</span><span class="b-meta">${escapeHtml(stamp(entry.createdAt))} · ${mode}</span></a></li>`
    })
    .join('\n')
}

const SCREEN_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3f3f1;
    color: #191917;
    font: 15px/1.7 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  aside {
    position: fixed; inset: 0 auto 0 0; width: 280px; overflow-y: auto;
    border-right: 1px solid #e6e4dc; background: #faf9f6; padding: 28px 20px;
  }
  aside h1 { margin: 0; font-size: 19px; letter-spacing: -0.01em; }
  aside .count { margin: 4px 0 18px; font-size: 12px; color: #9b9b93; }
  aside ol { list-style: none; margin: 0; padding: 0; }
  aside li + li { margin-top: 2px; }
  aside a {
    display: block; padding: 8px 10px; border-radius: 8px;
    color: #4a4a45; text-decoration: none; font-size: 13px;
  }
  aside a:hover { background: #efefe9; color: #191917; }
  .b-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .b-meta { display: block; margin-top: 2px; font-size: 11px; color: #9b9b93; }
  main { margin-left: 280px; padding: 40px 44px 80px; max-width: 820px; }
  .entry { padding: 28px 0 32px; border-top: 1px solid #e6e4dc; }
  .entry:first-of-type { border-top: 0; padding-top: 0; }
  .entry .meta { margin: 0; font-size: 12px; color: #9b9b93; }
  .entry h2 { margin: 6px 0 14px; font-size: 17px; font-weight: 600; line-height: 1.4; }
  .entry .body { white-space: normal; font-size: 15px; line-height: 1.75; }
  @media (max-width: 720px) {
    aside { position: static; width: auto; border-right: 0; border-bottom: 1px solid #e6e4dc; }
    main { margin-left: 0; padding: 24px 20px 60px; }
  }
`

const PRINT_STYLE = `
  @page { size: A4; margin: 18mm 16mm; }
  body {
    margin: 0; color: #111; background: #fff;
    font: 11.5pt/1.65 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .entry { break-before: page; page-break-before: always; }
  .entry:first-of-type { break-before: auto; page-break-before: auto; }
  .meta { margin: 0; font-size: 9pt; color: #777; }
  h2 { margin: 4pt 0 10pt; font-size: 13pt; font-weight: 600; }
  .body { font-size: 11.5pt; line-height: 1.7; }
`

function document_(
  entries: HistoryEntry[],
  options: { title: string; withBookmarks: boolean; style: string },
): string {
  const sections = entries.map(article).join('\n')
  const side = options.withBookmarks
    ? `<aside>
  <h1>RoboEmail</h1>
  <p class="count">${entries.length} 封</p>
  <ol>
${bookmarks(entries)}
  </ol>
</aside>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
<style>${options.style}</style>
</head>
<body>
${side}
<main>
${sections}
</main>
</body>
</html>`
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function day(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Standalone page with a bookmark list on the left. */
export function exportHtml(entries: HistoryEntry[]): void {
  const html = document_(entries, {
    title: 'RoboEmail 历史记录',
    withBookmarks: true,
    style: SCREEN_STYLE,
  })
  save(new Blob([html], { type: 'text/html;charset=utf-8' }), `roboemail-${day()}.html`)
}

/**
 * Word opens Word-compatible HTML saved with a .doc extension. A real .docx
 * would need a zip writer and the OOXML schema in the bundle.
 */
export function exportWord(entries: HistoryEntry[]): void {
  const html = document_(entries, {
    title: 'RoboEmail 历史记录',
    withBookmarks: false,
    style: PRINT_STYLE,
  }).replace(
    '<html lang="zh-CN">',
    `<html lang="zh-CN" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">`,
  )
  const header = `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`
  const withHeader = html.replace('<head>', `<head>\n${header}`)
  save(
    new Blob([withHeader], { type: 'application/msword;charset=utf-8' }),
    `roboemail-${day()}.doc`,
  )
}

/** Opens the print dialog; choosing "save as PDF" produces one letter per page. */
export function exportPdf(entries: HistoryEntry[]): boolean {
  const html = document_(entries, {
    title: 'RoboEmail 历史记录',
    withBookmarks: false,
    style: PRINT_STYLE,
  })
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  win.setTimeout(() => win.print(), 300)
  return true
}

export function exportJson(entries: HistoryEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  save(blob, `roboemail-${day()}.json`)
}
