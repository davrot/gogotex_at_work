import { createServer } from '../app/js/server.js'

export async function startNodeServer(port = 3010) {
  const { server } = await createServer()
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', (err) => {
      if (err) return reject(err)
      resolve(server)
    })
  })
}

export async function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
