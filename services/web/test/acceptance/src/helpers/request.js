const { execSync } = require('child_process')

function detectHost() {
  if (process.env.HTTP_TEST_HOST) return process.env.HTTP_TEST_HOST
  try {
    const out = execSync('docker ps --format "{{.Names}} {{.Image}}"', { encoding: 'utf8' })
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
    const candidates = []
    for (const line of lines) {
      const parts = line.split(/\s+/, 2)
      const name = parts[0]
      const image = parts[1] || ''
      if (!name) continue
      if (/webpack/i.test(name) || /\brun\b/i.test(name)) continue
      if (/^develop-web(-\d+)?$/i.test(name) || /(^|\/)develop-web$/i.test(image)) {
        candidates.push(name)
        continue
      }
      if (/(^|-)web(-|$|\d)/i.test(name)) {
        candidates.push(name)
      }
    }
    if (candidates.length > 0) return candidates[0]
  } catch (e) {
    // ignore
  }
  throw new Error('HTTP_TEST_HOST not set and no suitable web container detected via docker ps')
}

const host = detectHost()
const BASE_URL = `http://${host}:${process.env.HTTP_TEST_PORT || 3000}`
const request = require('request').defaults({
  baseUrl: BASE_URL,
  followRedirect: false,
})

module.exports = request
module.exports.BASE_URL = BASE_URL

module.exports.promises = {
  request: function (options) {
    return new Promise((resolve, reject) => {
      request(options, (err, response) => {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      })
    })
  },
  BASE_URL,
}
