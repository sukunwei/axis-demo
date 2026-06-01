import { useState, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { Header } from './components/Header'
import { Toolbar } from './components/Toolbar'
import { FilterBar } from './components/FilterBar'
import { TaskList } from './components/TaskList'
import { AddTaskDialog } from './components/AddTaskDialog'
import { useTodoStore } from './stores/TodoStoreContext'
import type { Todo } from './lib/api'

const App = observer(() => {
  const store = useTodoStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editTodo, setEditTodo] = useState<Todo | null>(null)

  useEffect(() => {
    store.fetchTodos()
  }, [store])

  const handleAddClick = () => {
    setEditTodo(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (todo: Todo) => {
    setEditTodo(todo)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (data: Parameters<typeof store.createTodo>[0]) => {
    if (editTodo) {
      await store.updateTodo(editTodo.id, data as any)
    } else {
      await store.createTodo(data)
    }
  }

  return (
    <div className="size-full flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-4">
        <Header />

        <div className="p-6">
          <Toolbar onAddClick={handleAddClick} />
          <FilterBar />
          <TaskList onEdit={handleEdit} />
        </div>
      </div>

      <AddTaskDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditTodo(null)
        }}
        onSubmit={handleSubmit}
        editTodo={editTodo}
      />
    </div>
  )
})

export default App
