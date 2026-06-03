import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { RedditDataApiConnector } from './src/lib/redditConnector'
import { redditSourceConfigSchema } from './src/lib/schemas'

interface RedditImportBody {
  credentials?: {
    clientId?: string
    clientSecret?: string
    userAgent?: string
  }
  config?: unknown
}

interface MiddlewareHost {
  middlewares: {
    use: (
      route: string,
      handler: (req: IncomingMessage, res: ServerResponse) => void,
    ) => void
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req: IncomingMessage): Promise<RedditImportBody> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 32_000) {
        reject(new Error('请求体过大。'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}') as RedditImportBody)
      } catch {
        reject(new Error('请求 JSON 无法解析。'))
      }
    })
    req.on('error', reject)
  })
}

function installRedditApi(host: MiddlewareHost): void {
  host.middlewares.use('/api/reddit/import', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { message: '只支持 POST。' })
      return
    }

    try {
      const body = await readJsonBody(req)
      const clientId = body.credentials?.clientId?.trim()
      const clientSecret = body.credentials?.clientSecret?.trim()
      const userAgent = body.credentials?.userAgent?.trim()

      if (!clientId || !clientSecret || !userAgent) {
        sendJson(res, 400, { message: '请填写 Reddit client id、client secret 和 user agent。' })
        return
      }

      const config = redditSourceConfigSchema.parse(body.config)
      const connector = new RedditDataApiConnector({
        credentials: { clientId, clientSecret, userAgent },
        config,
      })
      const records = await connector.load()

      sendJson(res, 200, {
        records,
        summary: {
          recordCount: records.length,
          subreddits: config.subreddits,
          includeComments: config.includeComments,
        },
      })
    } catch (error) {
      sendJson(res, 500, {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-reddit-api',
      configureServer(server) {
        installRedditApi(server)
      },
      configurePreviewServer(server) {
        installRedditApi(server)
      },
    },
  ],
})
