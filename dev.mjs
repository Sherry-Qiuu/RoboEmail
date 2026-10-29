import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

const viteBin = join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('\n前端依赖还没装。先在项目根目录运行：pnpm install\n')
  process.exit(1)
}

function start(name, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' })
  child.on('error', (error) => console.error(`[${name}] ${error.message}`))
  child.on('exit', (code) => {
    if (code) console.error(`[${name}] 退出，退出码 ${code}`)
  })
  return child
}

const api = start('api', ['--watch', 'src/index.ts'], join(root, 'apps', 'server'))
const web = start('web', [viteBin], join(root, 'apps', 'web'))

console.log('')
console.log('  接口  http://127.0.0.1:8787')
console.log('  网页  http://localhost:5173')
console.log('  按 Ctrl+C 停止')
console.log('')

const stop = () => {
  api.kill()
  web.kill()
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
