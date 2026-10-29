import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

// pnpm keeps transitive dependencies out of the package's node_modules, so
// esbuild is loaded straight from the store.
const store = join(root, 'node_modules/.pnpm')
const esbuildDir = readdirSync(store).find((entry) => entry.startsWith('esbuild@'))
if (!esbuildDir) {
  console.error('esbuild not found in the pnpm store; run pnpm install first')
  process.exit(1)
}
const esbuild = createRequire(join(store, esbuildDir, 'package.json'))(
  join(store, esbuildDir, 'node_modules/esbuild'),
)

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(full)) out.push(full)
  }
  return out
}

let failed = 0
for (const file of walk(join(root, 'apps/web/src'))) {
  const loader = extname(file) === '.tsx' ? 'tsx' : 'ts'
  try {
    esbuild.transformSync(readFileSync(file, 'utf8'), { loader, jsx: 'automatic' })
  } catch (error) {
    failed += 1
    console.log(`FAIL ${file.replace(root, '')}\n  ${error.message}`)
  }
}

console.log(failed === 0 ? 'all frontend modules parse' : `${failed} file(s) failed`)
process.exit(failed === 0 ? 0 : 1)
