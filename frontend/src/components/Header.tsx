import { observer } from 'mobx-react-lite'
import { useTodoStore } from '../stores/TodoStoreContext'

export const Header = observer(() => {
  const store = useTodoStore()
  return (
    <div className="bg-blue-500 p-8 text-white">
      <h1 className="text-4xl font-bold mb-2">Todo List</h1>
      <p className="text-blue-100">
        {store.activeTodosCount} {store.activeTodosCount === 1 ? 'task' : 'tasks'} remaining
      </p>
    </div>
  )
})
