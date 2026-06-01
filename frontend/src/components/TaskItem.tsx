import { observer } from 'mobx-react-lite'
import type { Todo } from '../lib/api'

interface TaskItemProps {
  todo: Todo
  onToggle: (id: number, completed: boolean) => void
  onDelete: (id: number) => void
  onEdit: (todo: Todo) => void
}

const getPriorityColor = (priority: string) => {
  if (priority === 'high') return 'border-red-500'
  if (priority === 'medium') return 'border-amber-500'
  return 'border-emerald-500'
}

const getPriorityTextColor = (priority: string) => {
  if (priority === 'high') return 'text-red-500'
  if (priority === 'medium') return 'text-yellow-500'
  return 'text-green-500'
}

const isOverdue = (dueDate: string) => {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export const TaskItem = observer(({ todo, onToggle, onDelete, onEdit }: TaskItemProps) => {
  const borderClass = getPriorityColor(todo.priority ?? 'medium')
  const textClass = getPriorityTextColor(todo.priority ?? 'medium')

  return (
    <div
      className={`p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group border-l-4 ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(todo.id, !todo.completed)}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${
            todo.completed
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-blue-500'
          }`}
        >
          {todo.completed && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8L6.5 11.5L13 4.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-medium ${
                todo.completed ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
            >
              {todo.text}
            </h3>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => onEdit(todo)}
                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                disabled={todo.completed}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(todo.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
          {todo.description && (
            <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
              {todo.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className={`flex items-center gap-1 ${textClass}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              {(todo.priority ?? 'medium').charAt(0).toUpperCase() + (todo.priority ?? 'medium').slice(1)}
            </span>
            {todo.dueDate && (
              <span
                className={`flex items-center gap-1 ${
                  isOverdue(todo.dueDate) && !todo.completed ? 'text-red-500 font-medium' : 'text-gray-500'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date(todo.dueDate).toLocaleDateString()}
                {isOverdue(todo.dueDate) && !todo.completed && ' (Overdue)'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
