export interface GraphNode {
  id: string
  label: string
  path: string
  layer: string
  functions: number
  classes: number
  exports: number
  package?: string
}

export interface GraphEdge {
  source: string
  target: string
  type?: 'imports' | 'calls' | 'extends'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  timestamp: string
}

export interface PackageNode {
  id: string
  name: string
  path: string
  fileCount: number
  layer: LayerType
  children: string[]
}

export type ViewMode = 'command' | 'story' | 'system' | 'layers' | 'files'

export type DiagramCategory = 
  | "architecture" 
  | "layers" 
  | "flows" 
  | "dependencies" 
  | "patterns" 
  | "domains"
  | "insights"

export interface Diagram {
  id: string
  category: DiagramCategory
  title: string
  description: string
  mermaid: string
  labels: string[]
  priority: number
}

export interface DiagramSet {
  generated: string
  hash: string
  diagrams: Diagram[]
  summary: string
}

export interface EntryPoint {
  type: 'api' | 'cli' | 'event' | 'cron' | 'websocket'
  name: string
  path: string
  file: string
  handler?: string
}

export interface FlowStep {
  actor: string
  action: string
  target: string
  description: string
  file?: string
}

export interface Flow {
  name: string
  description: string
  entryPoint: EntryPoint
  steps: FlowStep[]
  mermaid: string
}

export interface Domain {
  name: string
  description: string
  layer: string
  keyClasses: string[]
  keyFunctions: string[]
  files: { relativePath: string }[]
}

export interface LayerSummary {
  name: string
  description: string
  fileCount: number
  keyComponents: string[]
  mermaid: string
}

export interface ArchitectureStory {
  title: string
  summary: string
  generated: string
  stats: {
    totalFiles: number
    domains: number
    entryPoints: number
    flows: number
  }
  domains: Domain[]
  flows: Flow[]
  layers: LayerSummary[]
  systemDiagram: string
  layerDiagram: string
}

export interface ViewState {
  mode: ViewMode
  focusedPackage: string | null
  breadcrumbs: string[]
  filters: {
    layers: LayerType[]
    search: string
  }
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
