import { test, describe, beforeEach, afterEach } from 'vitest'
import { buildApp } from '../server.js'

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  test('returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
