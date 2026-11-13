/**
 * Checks the deployed site from the outside: TLS, API, footer and the port
 * that should no longer be reachable.
 *
 * Connections go to the IP with the domain as SNI, so the result does not
 * depend on the local resolver and the certificate is still validated.
 *
 *   node scripts/verify-live.mjs
 */

import https from 'node:https'
import net from 'node:net'

const HOST = process.env.SITE_HOST ?? 'rbem.online'
const IP = process.env.SITE_IP ?? '43.142.163.248'

function tcp(port, timeout = 6000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: IP, port, timeout })
    socket.on('connect', () => {
      socket.destroy()
      resolve('open')
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve('timeout')
    })
    socket.on('error', (error) => resolve(error.code === 'ECONNREFUSED' ? 'refused' : 'blocked'))
  })
}

function get(path, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      { host: IP, servername: HOST, path, port: 443, method: 'GET', timeout, headers: { host: HOST } },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
      },
    )
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', reject)
    request.end()
  })
}

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const port80 = await tcp(80)
check('port 80 reachable', port80 === 'open', port80)

const port443 = await tcp(443)
check('port 443 reachable', port443 === 'open', port443)

const port8787 = await tcp(8787)
check('port 8787 closed', port8787 !== 'open', port8787)

try {
  const health = await get('/api/health')
  const body = JSON.parse(health.body)
  check('api health', health.status === 200 && body.ok === true, `provider=${body.provider}`)
  check('production mode', body.env === 'production', body.env)
} catch (error) {
  check('api health', false, error.message)
}

try {
  const page = await get('/')
  check('page served', page.status === 200, `${page.body.length} bytes`)

  const script = page.body.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
  if (!script) {
    check('bundle found', false, 'no script tag')
  } else {
    const js = await get(script, 30000)
    check('footer icp number', js.body.includes('浙ICP备2026097271号'), `${(js.body.length / 1024).toFixed(0)} KB`)
    check('footer miit link', js.body.includes('beian.miit.gov.cn'))
  }
} catch (error) {
  check('page served', false, error.message)
}

const failed = results.filter((ok) => !ok).length
console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
