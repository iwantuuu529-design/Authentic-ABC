import { serve } from '@hono/node-server'
import app from './index'

function parseArgs() {
  const args = process.argv.slice(2)
  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
  let hostname = '0.0.0.0'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        port = parseInt(next, 10)
        i++
      }
    } else if (args[i] === '--host' || args[i] === '-H') {
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        hostname = next
        i++
      }
    }
  }

  return { port, hostname }
}

const { port, hostname } = parseArgs()

console.log(`Starting server on http://${hostname}:${port}...`)

serve(
  {
    fetch: app.fetch,
    port,
    hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`)
  }
)
