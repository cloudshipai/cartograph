import { useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface FlowDiagramProps {
  mermaid: string
}

interface ParsedGraph {
  nodes: Node[]
  edges: Edge[]
}

function parseMermaidToFlow(mermaid: string): ParsedGraph {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const nodeMap = new Map<string, { label: string; group?: string }>()
  const lines = mermaid.split('\n')
  
  let currentSubgraph: string | null = null
  let subgraphIndex = 0
  const subgraphColors: Record<string, string> = {}
  const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    const subgraphMatch = trimmed.match(/subgraph\s+(\w+)\s*\["?([^"\]]+)"?\]?/)
    if (subgraphMatch) {
      currentSubgraph = subgraphMatch[2] || subgraphMatch[1]
      subgraphColors[currentSubgraph] = colorPalette[subgraphIndex % colorPalette.length]
      subgraphIndex++
      continue
    }
    
    if (trimmed === 'end') {
      currentSubgraph = null
      continue
    }
    
    const nodeMatch = trimmed.match(/^(\w+)\s*\["?([^"\]]+)"?\]$/)
    if (nodeMatch) {
      const [, id, label] = nodeMatch
      const cleanLabel = label.replace(/<br\/?>/g, '\n')
      nodeMap.set(id, { label: cleanLabel, group: currentSubgraph || undefined })
      continue
    }
    
    const edgeMatch = trimmed.match(/^(\w+)\s*-->\s*(\w+)$/)
    if (edgeMatch) {
      const [, source, target] = edgeMatch
      if (!nodeMap.has(source)) nodeMap.set(source, { label: source })
      if (!nodeMap.has(target)) nodeMap.set(target, { label: target })
      
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#6b7280', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      })
    }
    
    const dashedEdgeMatch = trimmed.match(/^(\w+)\s*-+>?\s*(\w+)$/)
    if (dashedEdgeMatch && !edgeMatch) {
      const [, source, target] = dashedEdgeMatch
      if (!nodeMap.has(source)) nodeMap.set(source, { label: source })
      if (!nodeMap.has(target)) nodeMap.set(target, { label: target })
      
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6b7280', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      })
    }
  }
  
  const groupedNodes = new Map<string, string[]>()
  nodeMap.forEach((data, id) => {
    const group = data.group || '__default__'
    if (!groupedNodes.has(group)) groupedNodes.set(group, [])
    groupedNodes.get(group)!.push(id)
  })
  
  let yOffset = 0
  groupedNodes.forEach((nodeIds, group) => {
    const isDefault = group === '__default__'
    const groupColor = subgraphColors[group] || '#4b5563'
    
    if (!isDefault) {
      nodes.push({
        id: `group-${group}`,
        type: 'group',
        position: { x: 0, y: yOffset },
        style: {
          width: Math.max(300, nodeIds.length * 180),
          height: 150,
          backgroundColor: `${groupColor}15`,
          borderColor: groupColor,
          borderWidth: 2,
          borderRadius: 12,
        },
        data: { label: group },
      })
    }
    
    nodeIds.forEach((id, index) => {
      const data = nodeMap.get(id)!
      nodes.push({
        id,
        position: { x: 20 + index * 160, y: isDefault ? yOffset + 20 : 40 },
        parentId: isDefault ? undefined : `group-${group}`,
        extent: isDefault ? undefined : 'parent',
        data: { label: data.label },
        style: {
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          color: '#e5e7eb',
          border: `2px solid ${groupColor}`,
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 13,
          fontWeight: 500,
          minWidth: 120,
          textAlign: 'center' as const,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
        },
      })
    })
    
    yOffset += isDefault ? 80 : 200
  })
  
  return { nodes, edges }
}

export function FlowDiagram({ mermaid }: FlowDiagramProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => parseMermaidToFlow(mermaid),
    [mermaid]
  )
  
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="w-full h-full" style={{ minHeight: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls 
          className="!bg-gray-800 !border-gray-700 !rounded-lg !shadow-lg"
          showInteractive={false}
        />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'group') return '#3b82f620'
            return '#3b82f6'
          }}
          maskColor="#0a0a1280"
          className="!bg-gray-900 !border-gray-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  )
}
