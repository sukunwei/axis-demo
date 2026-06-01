import { ZodError } from 'zod'
import type Fastify from 'fastify'

export function errorHandler(error: Fastify.FastifyError | Error, request: Fastify.FastifyRequest, reply: Fastify.FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation error',
      details: error.errors,
    })
  }

  if (error.name === 'NotFoundError' || (error as any).meta?.code === 'P2025') {
    return reply.status(404).send({ error: 'Todo not found' })
  }

  request.log.error(error)
  return reply.status(500).send({ error: 'Internal server error' })
}
