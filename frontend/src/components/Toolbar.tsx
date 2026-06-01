import { observer } from 'mobx-react-lite'
import { useTodoStore } from '../stores/TodoStoreContext'
import type { SortBy } from '../lib/api'

interface ToolbarProps {
  onAddClick: () => void
}

export const Toolbar = observer(({ onAddClick }: ToolbarProps) => {
  const store = useTodoStore()
  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      <button
        onClick={onAddClick}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Task
      </button>
      <div className="relative flex-1 min-w-[200px]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={store.search}
          onChange={(e) => store.setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <select
          value={store.sort}
          onChange={(e) => store.setSort(e.target.value as SortBy)}
          className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="created">Created</option>
          <option value="dueDate">Due Date</option>
          <option value="priority">Priority</option>
        </select>
      </div>
    </div>
  )
})
