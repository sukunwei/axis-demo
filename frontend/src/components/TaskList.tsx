import { observer } from 'mobx-react-lite'
import { useTodoStore } from '../stores/TodoStoreContext'
import { TaskItem } from './TaskItem'
import type { Todo } from '../lib/api'

interface TaskListProps {
  onEdit: (todo: Todo) => void
}

export const TaskList = observer(({ onEdit }: TaskListProps) => {
  const store = useTodoStore()

  if (store.todos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {store.filter === 'all' && store.search && 'No tasks found'}
        {store.filter === 'all' && !store.search && 'No tasks yet, add one to get started!'}
        {store.filter === 'active' && 'No active tasks'}
        {store.filter === 'completed' && 'No completed tasks'}
      </div>
    )
  }

  const handleToggle = async (id: number, completed: boolean) => {
    await store.updateTodo(id, { completed })
  }

  const handleDelete = async (id: number) => {
    await store.deleteTodo(id)
  }

  return (
    <div className="space-y-3">
      {store.todos.map((todo) => (
        <TaskItem
          key={todo.id}
          todo={todo}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
})
