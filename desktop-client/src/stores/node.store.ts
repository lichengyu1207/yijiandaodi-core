import { create } from 'zustand'

interface NodeState {
  nodeId: string | null
  status: 'offline' | 'connecting' | 'online' | 'busy' | 'error'
  capabilities: string[]
  resources: {
    cpuUsage: number
    memoryUsage: number
    gpuUsage: number | null
  }
  location: string
  reputationScore: number
  todayComputeHours: number
  totalComputeHours: number
  points: number
  uptimeStart: number | null

  setNodeId: (id: string) => void
  setStatus: (status: NodeState['status']) => void
  updateMetrics: (metrics: Partial<NodeState['resources']>) => void
  updateStats: (stats: { computeHours: number; points: number }) => void
  reset: () => void
}

const useNodeStore = create<NodeState>((set) => ({
  nodeId: null,
  status: 'offline',
  capabilities: ['cpu-compute', 'memory-intensive', 'file-processing'],
  resources: {
    cpuUsage: 0,
    memoryUsage: 0,
    gpuUsage: null
  },
  location: '中国 · 上海',
  reputationScore: 4.8,
  todayComputeHours: 0,
  totalComputeHours: 0,
  points: 0,
  uptimeStart: null,

  setNodeId: (id) => set({ nodeId: id }),
  
  setStatus: (status) => 
    set((state) => ({
      status,
      uptimeStart: status === 'online' || status === 'busy' ? Date.now() : state.uptimeStart
    })),
  
  updateMetrics: (metrics) =>
    set((state) => ({
      resources: { ...state.resources, ...metrics }
    })),
  
  updateStats: (stats) =>
    set((state) => ({
      todayComputeHours: stats.computeHours,
      totalComputeHours: state.totalComputeHours + stats.computeHours,
      points: stats.points
    })),
  
  reset: () =>
    set({
      nodeId: null,
      status: 'offline',
      resources: {
        cpuUsage: 0,
        memoryUsage: 0,
        gpuUsage: null
      },
      todayComputeHours: 0,
      uptimeStart: null
    })
}))

export default useNodeStore
export type { NodeState }
