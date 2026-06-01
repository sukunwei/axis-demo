const API_BASE = '/api'

export interface Todo {
  id: number
  text: string
  description: string | null
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput {
  text: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
}

export interface UpdateTodoInput {
  text?: string
  description?: string | null
  completed?: boolean
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string | null
}

export type Filter = 'all' | 'active' | 'completed'
export type SortBy = 'created' | 'dueDate' | 'priority'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as T
}

export const api = {
  getTodos: (params?: { filter?: Filter; sort?: SortBy; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.filter && params.filter !== 'all') q.set('filter', params.filter)
    if (params?.sort && params.sort !== 'created') q.set('sort', params.sort)
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return request<Todo[]>(`/todos${qs ? `?${qs}` : ''}`)
  },
  getTodo: (id: number) => request<Todo>(`/todos/${id}`),
  createTodo: (data: CreateTodoInput) =>
    request<Todo>('/todos', { method: 'POST', body: JSON.stringify(data) }),
  updateTodo: (id: number, data: UpdateTodoInput) =>
    request<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTodo: (id: number) => request<void>(`/todos/${id}`, { method: 'DELETE' }),
}
