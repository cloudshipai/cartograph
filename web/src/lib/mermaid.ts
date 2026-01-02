import type { GraphData, LayerType } from './types'
import { LAYER_LABELS } from './types'

export function generateMermaidDiagram(data: GraphData): string {
  const layers = groupByLayer(data)
  
  let mermaid = 'graph TD\n'
  
  Object.entries(layers).forEach(([layer, nodes]) => {
    const label = LAYER_LABELS[layer as LayerType] || layer
    mermaid += `    subgraph ${layer}["${label}"]\n`
    nodes.forEach(node => {
      const shortName = node.label.replace(/[^a-zA-Z0-9]/g, '_')
      mermaid += `        ${shortName}["${node.label}"]\n`
    })
    mermaid += '    end\n'
  })

  mermaid += '\n'
  
  data.edges.forEach(edge => {
    const sourceNode = data.nodes.find(n => n.id === edge.source)
    const targetNode = data.nodes.find(n => n.id === edge.target)
    if (sourceNode && targetNode) {
      const sourceName = sourceNode.label.replace(/[^a-zA-Z0-9]/g, '_')
      const targetName = targetNode.label.replace(/[^a-zA-Z0-9]/g, '_')
      mermaid += `    ${sourceName} --> ${targetName}\n`
    }
  })

  return mermaid
}

export function generateLayerMermaid(data: GraphData): string {
  const layers = groupByLayer(data)
  const layerOrder: LayerType[] = ['api', 'service', 'model', 'util', 'config']
  
  let mermaid = 'graph TD\n'
  
  layerOrder.forEach(layer => {
    if (layers[layer]) {
      const count = layers[layer].length
      const label = LAYER_LABELS[layer]
      mermaid += `    ${layer}["${label}<br/>${count} files"]\n`
    }
  })

  mermaid += '\n'
  
  const connections: Set<string> = new Set()
  data.edges.forEach(edge => {
    const sourceNode = data.nodes.find(n => n.id === edge.source)
    const targetNode = data.nodes.find(n => n.id === edge.target)
    if (sourceNode && targetNode && sourceNode.layer !== targetNode.layer) {
      const key = `${sourceNode.layer}-${targetNode.layer}`
      connections.add(key)
    }
  })

  connections.forEach(conn => {
    const [source, target] = conn.split('-')
    mermaid += `    ${source} --> ${target}\n`
  })

  return mermaid
}

function groupByLayer(data: GraphData): Record<string, typeof data.nodes> {
  const groups: Record<string, typeof data.nodes> = {}
  data.nodes.forEach(node => {
    if (!groups[node.layer]) groups[node.layer] = []
    groups[node.layer].push(node)
  })
  return groups
}
