import { describe, it, expect } from 'vitest'
import {
  createTodoSchema,
  updateTodoSchema,
  todoQuerySchema,
  todoParamsSchema,
} from '../schemas/todo.js'

describe('createTodoSchema', () => {
  it('passes with valid required fields', () => {
    const result = createTodoSchema.safeParse({ text: 'Buy groceries' })
    expect(result.success).toBe(true)
  })

  it('passes with all fields', () => {
    const result = createTodoSchema.safeParse({
      text: 'Buy groceries',
      description: 'Milk, eggs, bread',
      priority: 'high',
      dueDate: '2026-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('fails if text is empty', () => {
    const result = createTodoSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })

  it('fails if text exceeds 500 chars', () => {
    const result = createTodoSchema.safeParse({ text: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('fails if description exceeds 2000 chars', () => {
    const result = createTodoSchema.safeParse({ text: 'test', description: 'b'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('fails if priority is invalid', () => {
    const result = createTodoSchema.safeParse({ text: 'test', priority: 'urgent' })
    expect(result.success).toBe(false)
  })

  it('accepts any string for dueDate (validation at Prisma layer)', () => {
    // Zod validates the type, not the date format; Prisma rejects invalid dates
    const result = createTodoSchema.safeParse({ text: 'test', dueDate: 'not-a-date' })
    expect(result.success).toBe(true)
  })

  it('defaults priority to medium', () => {
    const result = createTodoSchema.safeParse({ text: 'test' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.priority).toBe('medium')
  })
})

describe('updateTodoSchema', () => {
  it('passes with partial fields', () => {
    const result = updateTodoSchema.safeParse({ completed: true })
    expect(result.success).toBe(true)
  })

  it('passes with all optional fields', () => {
    const result = updateTodoSchema.safeParse({
      text: 'Updated',
      description: null,
      completed: true,
      priority: 'high',
      dueDate: null,
    })
    expect(result.success).toBe(true)
  })

  it('passes with empty object', () => {
    const result = updateTodoSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('fails if text is empty string', () => {
    const result = updateTodoSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })
})

describe('todoQuerySchema', () => {
  it('passes with all valid params', () => {
    const result = todoQuerySchema.safeParse({ filter: 'active', sort: 'priority', search: 'buy' })
    expect(result.success).toBe(true)
  })

  it('passes with no params (defaults)', () => {
    const result = todoQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.filter).toBe('all')
      expect(result.data.sort).toBe('created')
      expect(result.data.search).toBe('')
    }
  })

  it('fails with invalid filter', () => {
    const result = todoQuerySchema.safeParse({ filter: 'pending' })
    expect(result.success).toBe(false)
  })

  it('fails with invalid sort', () => {
    const result = todoQuerySchema.safeParse({ sort: 'alphabetical' })
    expect(result.success).toBe(false)
  })
})

describe('todoParamsSchema', () => {
  it('passes with positive integer', () => {
    const result = todoParamsSchema.safeParse({ id: '5' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe(5)
  })

  it('fails with zero', () => {
    const result = todoParamsSchema.safeParse({ id: '0' })
    expect(result.success).toBe(false)
  })

  it('fails with negative number', () => {
    const result = todoParamsSchema.safeParse({ id: '-1' })
    expect (result.success).toBe(false)
  })

  it('fails with non-numeric string', () => {
    const result = todoParamsSchema.safeParse({ id: 'abc' })
    expect(result.success).toBe(false)
  })
})
