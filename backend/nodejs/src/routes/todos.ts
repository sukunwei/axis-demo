import { prisma } from '../db.js'
import {
  createTodoSchema,
  updateTodoSchema,
  todoQuerySchema,
  todoParamsSchema,
  createTodoJsonSchema,
  updateTodoJsonSchema,
  todoQueryJsonSchema,
  todoParamsJsonSchema,
  type CreateTodoInput,
  type UpdateTodoInput,
} from '../schemas/todo.js'
import type Fastify from 'fastify'

// GET /api/todos
export async function getTodosHandler(
  request: Fastify.FastifyRequest<{ Querystring: Record<string, string> }>,
  reply: Fastify.FastifyReply
) {
  const query = todoQuerySchema.parse(request.query)
  const { filter, sort, search } = query

  const where: Record<string, any> = {}
  if (filter === 'active') where.completed = false
  else if (filter === 'completed') where.completed = true

  if (search) {
    where.OR = [
      { text: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Record<string, any>[] = []
  if (sort === 'created') {
    orderBy.push({ createdAt: 'desc' })
  } else if (sort === 'dueDate') {
    orderBy.push({ dueDate: 'asc' })
    orderBy.push({ createdAt: 'desc' })
  } else if (sort === 'priority') {
    orderBy.push({ priority: 'asc' })
    orderBy.push({ createdAt: 'desc' })
  }

  const todos = await prisma.todo.findMany({ where, orderBy })
  return reply.send(JSON.parse(JSON.stringify(todos)))
}

// GET /api/todos/:id
export async function getTodoHandler(
  request: Fastify.FastifyRequest<{ Params: { id: string } }>,
  reply: Fastify.FastifyReply
) {
  const { id } = todoParamsSchema.parse(request.params)
  const todo = await prisma.todo.findUnique({ where: { id } })
  if (!todo) return reply.status(404).send({ error: 'Todo not found' })
  return reply.send(JSON.parse(JSON.stringify(todo)))
}

// POST /api/todos
export async function createTodoHandler(
  request: Fastify.FastifyRequest<{ Body: CreateTodoInput }>,
  reply: Fastify.FastifyReply
) {
  const data = createTodoSchema.parse(request.body)
  const todo = await prisma.todo.create({
    data: {
      text: data.text,
      description: data.description,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  })
  // Manually build a plain object to avoid any serialization issues
  const result = {
    id: Number(todo.id),
    text: String(todo.text),
    description: todo.description ?? null,
    completed: Boolean(todo.completed),
    priority: String(todo.priority),
    dueDate: todo.dueDate ? String(todo.dueDate) : null,
    createdAt: todo.createdAt instanceof Date ? todo.createdAt.toISOString() : String(todo.createdAt),
    updatedAt: todo.updatedAt instanceof Date ? todo.updatedAt.toISOString() : String(todo.updatedAt),
  }
  return reply.code(201).header('content-type', 'application/json').send(JSON.stringify(result))
}

// PATCH /api/todos/:id
export async function updateTodoHandler(
  request: Fastify.FastifyRequest<{ Params: { id: string }; Body: UpdateTodoInput }>,
  reply: Fastify.FastifyReply
) {
  const { id } = todoParamsSchema.parse(request.params)
  const data = updateTodoSchema.parse(request.body)

  const updateData: Record<string, any> = {}
  if (data.text !== undefined) updateData.text = data.text
  if (data.description !== undefined) updateData.description = data.description
  if (data.completed !== undefined) updateData.completed = data.completed
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate === null ? null : new Date(data.dueDate as string)
  }

  const todo = await prisma.todo
    .update({ where: { id }, data: updateData })
    .catch(() => null)

  if (!todo) return reply.status(404).send({ error: 'Todo not found' })
  return reply.send(todo)
}

// DELETE /api/todos/:id
export async function deleteTodoHandler(
  request: Fastify.FastifyRequest<{ Params: { id: string } }>,
  reply: Fastify.FastifyReply
) {
  try {
    const { id } = todoParamsSchema.parse(request.params)
    request.log.info(`DELETE id=${id} (type=${typeof id})`)
    await prisma.todo.delete({ where: { id } })
    return reply.status(204).send()
  } catch (error: any) {
    request.log.error(`DELETE error: ${error.message}, meta: ${JSON.stringify(error?.meta)}`)
    if (error?.code === 'P2025') {
      return reply.status(404).send({ error: 'Todo not found' })
    }
    if (error.name === 'ZodError') throw error // Let global handler deal with validation errors
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

// Routes plugin
export async function todosRoutes(app: Fastify.FastifyInstance) {
  app.get('/', {
    schema: {
      querystring: todoQueryJsonSchema,
      response: { 200: { type: 'array' } },
    },
  }, getTodosHandler)

  app.get('/:id', {
    schema: {
      params: todoParamsJsonSchema,
    },
  }, getTodoHandler)

  app.post('/', {
    schema: {
      body: createTodoJsonSchema,
      response: { 201: { type: 'object' } },
    },
  }, createTodoHandler)

  app.patch('/:id', {
    schema: {
      params: todoParamsJsonSchema,
      body: updateTodoJsonSchema,
    },
  }, updateTodoHandler)

  app.delete('/:id', {
    schema: {
      params: todoParamsJsonSchema,
    },
  }, deleteTodoHandler)
}
