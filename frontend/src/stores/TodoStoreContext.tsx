import { createContext, useContext } from 'react'
import { todoStore } from './todoStore'

export const TodoStoreContext = createContext(todoStore)

export function useTodoStore() {
  return useContext(TodoStoreContext)
}
