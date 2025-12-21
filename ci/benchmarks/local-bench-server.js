#!/usr/bin/env node
const http = require('http')
const url = require('url')
const port = process.env.BENCH_SERVER_PORT || 30999
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true)
  if (req.method === 'POST' && parsed.pathname.startsWith('/internal/api/tokens/introspect')) {
    let body = ''
    req.on('data', (chunk) => body += chunk)
    req.on('end', () => {
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({ active: true }))
    })
  } else if (req.method === 'GET' && parsed.pathname.startsWith('/internal/api/ssh-keys/')) {
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({ userId: 'u-bench-user' }))
  } else {
    res.writeHead(404)
    res.end()
  }
})
server.listen(port, () => console.log('Local bench server listening on', port))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
