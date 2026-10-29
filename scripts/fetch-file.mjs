import { createWriteStream } from 'node:fs'
import { get } from 'node:https'

const target = process.argv[2]
const url = process.argv[3]

function download(address, redirects = 0) {
  if (redirects > 5) throw new Error('too many redirects')
  get(address, { headers: { 'user-agent': 'roboemail-setup' } }, (response) => {
    const status = response.statusCode ?? 0
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume()
      return download(new URL(response.headers.location, address).toString(), redirects + 1)
    }
    if (status !== 200) {
      console.error('http', status)
      process.exit(1)
    }
    const file = createWriteStream(target)
    response.pipe(file)
    file.on('finish', () => {
      file.close()
      console.log('saved', target)
    })
  }).on('error', (error) => {
    console.error('failed:', error.message)
    process.exit(1)
  })
}

download(url)
