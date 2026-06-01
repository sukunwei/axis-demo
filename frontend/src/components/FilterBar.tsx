import { observer } from 'mobx-react-lite'
import { useTodoStore } from '../stores/TodoStoreContext'
import type { Filter } from '../lib/api'

export const FilterBar = observer(() => {
  const store = useTodoStore()
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: store.todos.length },
    { key: 'active', label: 'Active', count: store.activeTodosCount },
    { key: 'completed', label: 'Completed', count: store.completedTodosCount },
  ]

  return (
    <div className="flex gap-2 mb-4">
      {filters.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => store.setFilter(key)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            store.filter === key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {label}{' '}
          <span
            className={`ml-1.5 px-2 py-0.5 rounded-full text-sm ${
              store.filter === key ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            {count}
          </span>
        </button>
      ))}
    </div>
  )
})
