export interface GraphNode {
  id: string
  label: string
  layer: string
  functions: number
  classes: number
  exports: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  timestamp: string
}

export interface Manifest {
  version: string
  generated: string
  files: {
    overview: string
    layers: string
    graph: string
  }
  stats: {
    totalFiles: number
    tsFiles: number
    pyFiles: number
    goFiles: number
    totalFunctions: number
    totalClasses: number
    totalExports: number
  }
}

export type LayerType = 'api' | 'service' | 'model' | 'ui' | 'util' | 'test' | 'config' | 'other'

export const LAYER_COLORS: Record<LayerType, string> = {
  api: '#3b82f6',
  service: '#10b981',
  model: '#f59e0b',
  ui: '#ec4899',
  util: '#8b5cf6',
  test: '#6b7280',
  config: '#06b6d4',
  other: '#4b5563',
}

export const LAYER_LABELS: Record<LayerType, string> = {
  api: 'API / Routes',
  service: 'Services',
  model: 'Models',
  ui: 'UI / Components',
  util: 'Utilities',
  test: 'Tests',
  config: 'Config',
  other: 'Other',
}
