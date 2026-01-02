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
import { LAYER_COLORS, type GraphData, type LayerType } from '../lib/types'
import { FileNode } from './FileNode'

interface MapCanvasProps {
  data: GraphData | null
  loading: boolean
  onNodeClick: (nodeId: string) => void
  selectedNode: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  file: FileNode,
}

function layoutNodes(data: GraphData): Node[] {
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

function createEdges(data: GraphData): Edge[] {
  return data.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#444' },
  }))
}

export function MapCanvas({ data, loading, onNodeClick, selectedNode: _selectedNode }: MapCanvasProps) {
  const initialNodes = useMemo(() => (data ? layoutNodes(data) : []), [data])
  const initialEdges = useMemo(() => (data ? createEdges(data) : []), [data])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useMemo(() => {
    if (data) {
      setNodes(layoutNodes(data))
      setEdges(createEdges(data))
    }
  }, [data, setNodes, setEdges])

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
