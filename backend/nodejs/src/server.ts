import Fastify from 'fastify'
import cors from '@fastify/cors'
import { errorHandler } from './plugins/error.js'
import { todosRoutes } from './routes/todos.js'

const PORT = Number(process.env.PORT ?? 5555)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

export async function buildApp() {
  const app = Fastify({ logger: false })

  await app.register(cors, { origin: CORS_ORIGIN })
  app.setErrorHandler(errorHandler)

  app.get('/health', async () => ({ status: 'ok' }))
  await app.register(todosRoutes, { prefix: '/api/todos' })

  return app
}

export async function startServer() {
  const app = await buildApp()
  app.log.info(`Listening on port ${PORT}`)

  const shutdown = async () => {
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await app.listen({ port: PORT })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}
