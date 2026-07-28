import { create } from 'zustand'

interface TaskItem {
  taskId: string
  type: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  shardProgress: { completed: number; total: number }
  duration: number
  result?: object
  error?: string
  createdAt: string
}

interface TaskState {
  tasks: TaskItem[]
  activeCount: number

  addTask: (task: TaskItem) => void
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void
  removeTask: (taskId: string) => void
  getActiveTasks: () => TaskItem[]
  clearCompleted: () => void
}

const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  activeCount: 0,

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
      activeCount: task.status === 'executing' ? state.activeCount + 1 : state.activeCount
    })),

  updateTask: (taskId, updates) =>
    set((state) => {
      const oldTask = state.tasks.find(t => t.taskId === taskId)
      const wasActive = oldTask?.status === 'executing'
      const isActive = updates.status === 'executing'

      return {
        tasks: state.tasks.map((t) =>
          t.taskId === taskId ? { ...t, ...updates } : t
        ),
        activeCount: wasActive && !isActive
          ? Math.max(0, state.activeCount - 1)
          : !wasActive && isActive
            ? state.activeCount + 1
            : state.activeCount
      }
    }),

  removeTask: (taskId) =>
    set((state) => {
      const task = state.tasks.find(t => t.taskId === taskId)
      return {
        tasks: state.tasks.filter((t) => t.taskId !== taskId),
        activeCount: task?.status === 'executing' 
          ? Math.max(0, state.activeCount - 1) 
          : state.activeCount
      }
    }),

  getActiveTasks: () => get().tasks.filter(t => t.status === 'executing'),

  clearCompleted: () =>
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'failed'
      )
    }))
}))

export default useTaskStore
export type { TaskItem, TaskState }
