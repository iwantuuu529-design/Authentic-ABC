import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createLocalD1Database, createLocalR2Bucket } from './lib/d1Adapter'
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

// Initialize local SQLite D1 adapter and local R2 adapter for Node.js
const localDb = createLocalD1Database()
const localFiles = createLocalR2Bucket()
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-abc-authentic-2026'

const serverApp = new Hono()

// Serve static assets in Node.js
serverApp.use('/static/*', serveStatic({ root: './public' }))

// Forward all other requests to the main app with local database bindings
serverApp.all('*', async (c) => {
  try {
    return await app.fetch(
      c.req.raw,
      {
        DB: localDb,
        FILES: localFiles,
        JWT_SECRET: jwtSecret,
        ...c.env,
      }
    )
  } catch (err: any) {
    console.error('Server forwarding error:', err)
    return c.text('Server forwarding error: ' + (err?.stack || err?.message || String(err)), 500)
  }
})

console.log(`Starting server on http://${hostname}:${port}...`)

serve(
  {
    fetch: serverApp.fetch,
    port,
    hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`)
  }
)
