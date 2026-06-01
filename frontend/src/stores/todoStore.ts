import { makeAutoObservable, runInAction } from 'mobx'
import { api, type Todo, type Filter, type SortBy, type CreateTodoInput, type UpdateTodoInput } from '../lib/api'

class TodoStore {
  todos: Todo[] = []
  filter: Filter = 'all'
  sort: SortBy = 'created'
  search = ''
  isLoading = false
  error: string | null = null

  constructor() {
    makeAutoObservable(this)
  }

  get activeTodosCount() {
    return this.todos.filter((t) => !t.completed).length
  }

  get completedTodosCount() {
    return this.todos.filter((t) => t.completed).length
  }

  get filteredTodos(): Todo[] {
    return this.todos
  }

  async fetchTodos() {
    this.isLoading = true
    this.error = null
    try {
      const todos = await api.getTodos({
        filter: this.filter,
        sort: this.sort,
        search: this.search || undefined,
      })
      runInAction(() => {
        this.todos = todos
        this.isLoading = false
      })
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Unknown error'
        this.isLoading = false
      })
    }
  }

  async createTodo(data: CreateTodoInput) {
    try {
      const todo = await api.createTodo(data)
      runInAction(() => { this.todos.unshift(todo) })
      return todo
    } catch (err) {
      runInAction(() => { this.error = err instanceof Error ? err.message : 'Unknown error' })
      throw err
    }
  }

  async updateTodo(id: number, data: UpdateTodoInput) {
    try {
      const updated = await api.updateTodo(id, data)
      runInAction(() => {
        const idx = this.todos.findIndex((t) => t.id === id)
        if (idx !== -1) this.todos[idx] = updated
      })
      return updated
    } catch (err) {
      runInAction(() => { this.error = err instanceof Error ? err.message : 'Unknown error' })
      throw err
    }
  }

  async deleteTodo(id: number) {
    try {
      await api.deleteTodo(id)
      runInAction(() => {
        this.todos = this.todos.filter((t) => t.id !== id)
      })
    } catch (err) {
      runInAction(() => { this.error = err instanceof Error ? err.message : 'Unknown error' })
      throw err
    }
  }

  setFilter(filter: Filter) {
    this.filter = filter
    this.fetchTodos()
  }

  setSort(sort: SortBy) {
    this.sort = sort
    this.fetchTodos()
  }

  setSearch(search: string) {
    this.search = search
    this.fetchTodos()
  }
}

export const todoStore = new TodoStore()
