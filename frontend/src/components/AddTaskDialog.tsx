import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Todo, CreateTodoInput } from '../lib/api'

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateTodoInput) => Promise<void>
  editTodo?: Todo | null
}

export function AddTaskDialog({ open, onOpenChange, onSubmit, editTodo }: AddTaskDialogProps) {
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (editTodo) {
      setText(editTodo.text ?? '')
      setDescription(editTodo.description ?? '')
      setPriority(editTodo.priority ?? 'medium')
      setDueDate(editTodo.dueDate ? editTodo.dueDate.split('T')[0] : '')
    } else {
      setText('')
      setDescription('')
      setPriority('medium')
      setDueDate('')
    }
  }, [editTodo, open])

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        text: text.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-gray-800 mb-4">
            {editTodo ? 'Edit Task' : 'Add New Task'}
          </Dialog.Title>
          <Dialog.Description className="text-gray-600 mb-6">
            {editTodo ? 'Update your task details.' : 'Create a new task with details, priority, and due date.'}
          </Dialog.Description>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Enter task title..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="relative">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <div className="relative">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {editTodo ? 'Save Changes' : 'Add Task'}
              </button>
              <Dialog.Close asChild>
                <button className="px-6 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
