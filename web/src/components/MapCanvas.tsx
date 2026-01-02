import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LAYER_COLORS, type GraphData, type LayerType, type ViewMode } from '../lib/types'
import { FileNode } from './FileNode'
import { PackageNode } from './PackageNode'

interface MapCanvasProps {
  data: GraphData | null
  loading: boolean
  onNodeClick: (nodeId: string) => void
  selectedNode: string | null
  viewMode: ViewMode
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  file: FileNode,
  package: PackageNode,
}

import type { GraphNode } from '../lib/types'

interface PackageGroup {
  id: string
  name: string
  layer: string
  files: GraphNode[]
}

function groupByPackage(data: GraphData): PackageGroup[] {
  const packages: Record<string, PackageGroup> = {}
  
  data.nodes.forEach(n => {
    const parts = n.id.split('/')
    const pkgName = parts.slice(0, 2).join('/') || 'root'
    
    if (!packages[pkgName]) {
      packages[pkgName] = {
        id: pkgName,
        name: pkgName,
        layer: n.layer,
        files: [],
      }
    }
    packages[pkgName].files.push(n)
  })
  
  return Object.values(packages)
}

function layoutSystemView(data: GraphData): Node[] {
  const packages = groupByPackage(data)
  const nodes: Node[] = []
  
  const layerGroups: Record<string, PackageGroup[]> = {}
  packages.forEach(pkg => {
    const layer = pkg.files[0]?.layer || 'other'
    if (!layerGroups[layer]) layerGroups[layer] = []
    layerGroups[layer].push({ ...pkg, layer })
  })

  const layerOrder = ['api', 'service', 'model', 'ui', 'util', 'config', 'test', 'other']
  const sortedLayers = Object.keys(layerGroups).sort(
    (a, b) => layerOrder.indexOf(a) - layerOrder.indexOf(b)
  )

  let yOffset = 0
  const nodeWidth = 200
  const nodeHeight = 80
  const nodesPerRow = 4
  const xGap = 30
  const yGap = 30
  const layerGap = 80

  sortedLayers.forEach(layer => {
    const layerPackages = layerGroups[layer]
    
    layerPackages.forEach((pkg, i) => {
      const row = Math.floor(i / nodesPerRow)
      const col = i % nodesPerRow
      
      nodes.push({
        id: pkg.id,
        type: 'package',
        position: {
          x: col * (nodeWidth + xGap),
          y: yOffset + row * (nodeHeight + yGap),
        },
        data: {
          label: pkg.name,
          layer: pkg.layer,
          fileCount: pkg.files.length,
          functions: pkg.files.reduce((sum: number, f: GraphNode) => sum + f.functions, 0),
          classes: pkg.files.reduce((sum: number, f: GraphNode) => sum + f.classes, 0),
        },
      })
    })
    
    const rows = Math.ceil(layerPackages.length / nodesPerRow)
    yOffset += rows * (nodeHeight + yGap) + layerGap
  })

  return nodes
}

function layoutFilesView(data: GraphData): Node[] {
  const layerGroups: Record<string, typeof data.nodes> = {}
  
  data.nodes.forEach(n => {
    if (!layerGroups[n.layer]) layerGroups[n.layer] = []
    layerGroups[n.layer].push(n)
  })

  const layerOrder = ['api', 'service', 'model', 'ui', 'util', 'config', 'test', 'other']
  const sortedLayers = Object.keys(layerGroups).sort(
    (a, b) => layerOrder.indexOf(a) - layerOrder.indexOf(b)
  )

  const nodes: Node[] = []
  let yOffset = 0
  const nodeWidth = 180
  const nodeHeight = 50
  const nodesPerRow = 6
  const xGap = 20
  const yGap = 20
  const layerGap = 60

  sortedLayers.forEach(layer => {
    const layerNodes = layerGroups[layer]
    
    layerNodes.forEach((n, i) => {
      const row = Math.floor(i / nodesPerRow)
      const col = i % nodesPerRow
      
      nodes.push({
        id: n.id,
        type: 'file',
        position: {
          x: col * (nodeWidth + xGap),
          y: yOffset + row * (nodeHeight + yGap),
        },
        data: {
          label: n.label,
          layer: n.layer,
          functions: n.functions,
          classes: n.classes,
          exports: n.exports,
        },
      })
    })
    
    const rows = Math.ceil(layerNodes.length / nodesPerRow)
    yOffset += rows * (nodeHeight + yGap) + layerGap
  })

  return nodes
}

function layoutNodes(data: GraphData, viewMode: ViewMode): Node[] {
  if (viewMode === 'system') {
    return layoutSystemView(data)
  }
  return layoutFilesView(data)
}

function createEdges(data: GraphData, viewMode: ViewMode): Edge[] {
  if (viewMode === 'system') {
    const pkgEdges: Map<string, Edge> = new Map()
    
    data.edges.forEach((e) => {
      const sourceParts = e.source.split('/')
      const targetParts = e.target.split('/')
      const sourcePkg = sourceParts.slice(0, 2).join('/') || 'root'
      const targetPkg = targetParts.slice(0, 2).join('/') || 'root'
      
      if (sourcePkg !== targetPkg) {
        const key = `${sourcePkg}-${targetPkg}`
        if (!pkgEdges.has(key)) {
          pkgEdges.set(key, {
            id: `e-pkg-${key}`,
            source: sourcePkg,
            target: targetPkg,
            animated: true,
            style: { stroke: '#555', strokeWidth: 2 },
          })
        }
      }
    })
    
    return Array.from(pkgEdges.values())
  }
  
  return data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#444' },
  }))
}

export function MapCanvas({ data, loading, onNodeClick, selectedNode: _selectedNode, viewMode }: MapCanvasProps) {
  const initialNodes = useMemo(() => (data ? layoutNodes(data, viewMode) : []), [data, viewMode])
  const initialEdges = useMemo(() => (data ? createEdges(data, viewMode) : []), [data, viewMode])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useMemo(() => {
    if (data) {
      setNodes(layoutNodes(data, viewMode))
      setEdges(createEdges(data, viewMode))
    }
  }, [data, viewMode, setNodes, setEdges])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => onNodeClick(node.id),
    [onNodeClick]
  )

  const nodeColor = useCallback((node: Node) => {
    const layer = node.data?.layer as LayerType
    return LAYER_COLORS[layer] || LAYER_COLORS.other
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Analyzing codebase...</p>
        </div>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 mb-2">No files found</p>
          <p className="text-xs text-gray-600">Start coding and the map will appear</p>
        </div>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#333" gap={20} />
      <Controls position="top-right" />
      <MiniMap
        nodeColor={nodeColor}
        style={{ background: '#1a1a2e' }}
        maskColor="rgba(0, 0, 0, 0.6)"
      />
    </ReactFlow>
  )
}
