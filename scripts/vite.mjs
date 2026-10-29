/**
 * Runs the project's own Vite with the web app as the working directory.
 *
 * Vite resolves index.html and vite.config.ts from the process cwd, so calling
 * its bin from the repository root looks in the wrong place.
 *
 *   node scripts/vite.mjs build
 *   node scripts/vite.mjs dev
 */

import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const webDir = join(root, 'apps/web')
const bin = join(webDir, 'node_modules/vite/bin/vite.js')

const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd: webDir,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
