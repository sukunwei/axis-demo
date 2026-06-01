import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export const createTodoSchema = z.object({
  text: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(), // ISO date string YYYY-MM-DD
})

export const updateTodoSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
})

export const todoQuerySchema = z.object({
  filter: z.enum(['all', 'active', 'completed']).default('all'),
  sort: z.enum(['created', 'dueDate', 'priority']).default('created'),
  search: z.string().default(''),
})

export const todoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const createTodoJsonSchema = zodToJsonSchema(createTodoSchema, 'createTodoSchema')
export const updateTodoJsonSchema = zodToJsonSchema(updateTodoSchema, 'updateTodoSchema')
export const todoQueryJsonSchema = zodToJsonSchema(todoQuerySchema, 'todoQuerySchema')
export const todoParamsJsonSchema = zodToJsonSchema(todoParamsSchema, 'todoParamsSchema')

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type TodoQueryInput = z.infer<typeof todoQuerySchema>
