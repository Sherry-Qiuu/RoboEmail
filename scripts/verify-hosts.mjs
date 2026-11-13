/**
 * Checks one or more hosts behind the shared Caddy, by IP with SNI so the
 * local resolver is not involved and the certificate is still validated.
 *
 *   node scripts/verify-hosts.mjs rbem.online calhub.asia
 */

import https from 'node:https'
import tls from 'node:tls'

const IP = process.env.SITE_IP ?? '43.142.163.248'
const hosts = process.argv.slice(2)
if (hosts.length === 0) hosts.push('rbem.online', 'calhub.asia')

function get(host, path) {
  return new Promise((resolve) => {
    const request = https.request(
      {
        host: IP,
        servername: host,
        path,
        port: 443,
        method: 'GET',
        timeout: 20000,
        headers: { host },
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode, body }))
      },
    )
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', (error) => resolve({ status: 0, body: error.code ?? error.message }))
    request.end()
  })
}

function cert(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: IP, servername: host, port: 443, timeout: 10000 }, () => {
      const c = socket.getPeerCertificate()
      resolve({
        subject: c?.subject?.CN,
        san: (c?.subjectaltname ?? '').replace(/DNS:/g, ''),
        issuer: c?.issuer?.O ?? c?.issuer?.CN,
        valid: `${c?.valid_from} -> ${c?.valid_to}`,
      })
      socket.end()
    })
    socket.on('error', (error) => resolve({ error: error.code ?? error.message }))
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ error: 'timeout' })
    })
  })
}

for (const host of hosts) {
  console.log(`\n=== ${host} ===`)
  const health = await get(host, '/api/health')
  console.log(`health  : ${health.status}  ${health.body.slice(0, 120)}`)
  const page = await get(host, '/')
  console.log(`page    : ${page.status}  ${page.body.length} bytes`)
  const info = await cert(host)
  console.log(`cert    : ${info.error ?? `${info.subject} | ${info.issuer} | ${info.valid}`}`)
  if (info.san) console.log(`san     : ${info.san}`)
}
