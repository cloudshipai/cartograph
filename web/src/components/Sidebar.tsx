import { useMemo } from 'react'
import { LAYER_COLORS, LAYER_LABELS, type GraphData, type LayerType } from '../lib/types'

interface SidebarProps {
  nodeId: string
  data: GraphData
  onClose: () => void
}

export function Sidebar({ nodeId, data, onClose }: SidebarProps) {
  const node = useMemo(
    () => data.nodes.find(n => n.id === nodeId),
    [data.nodes, nodeId]
  )

  const connections = useMemo(() => {
    const incoming = data.edges.filter(e => e.target === nodeId).map(e => e.source)
    const outgoing = data.edges.filter(e => e.source === nodeId).map(e => e.target)
    return { incoming, outgoing }
  }, [data.edges, nodeId])

  if (!node) return null

  const layer = node.layer as LayerType
  const layerColor = LAYER_COLORS[layer] || LAYER_COLORS.other

  return (
    <aside className="w-80 bg-bg-secondary border-l border-border overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-medium truncate">{node.label}</h2>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-bg-tertiary rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Path</h3>
          <code className="text-xs text-gray-300 break-all">{nodeId}</code>
        </section>

        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Layer</h3>
          <div className="flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: layerColor }}
            />
            <span className="text-sm">{LAYER_LABELS[layer] || layer}</span>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Stats</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-bg-tertiary rounded p-2">
              <div className="text-lg font-semibold">{node.functions}</div>
              <div className="text-xs text-gray-500">Functions</div>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <div className="text-lg font-semibold">{node.classes}</div>
              <div className="text-xs text-gray-500">Classes</div>
            </div>
            <div className="bg-bg-tertiary rounded p-2">
              <div className="text-lg font-semibold">{node.exports}</div>
              <div className="text-xs text-gray-500">Exports</div>
            </div>
          </div>
        </section>

        {connections.incoming.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Imported by ({connections.incoming.length})
            </h3>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {connections.incoming.map(path => (
                <li key={path} className="text-xs text-gray-400 truncate">
                  {path}
                </li>
              ))}
            </ul>
          </section>
        )}

        {connections.outgoing.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Imports ({connections.outgoing.length})
            </h3>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {connections.outgoing.map(path => (
                <li key={path} className="text-xs text-gray-400 truncate">
                  {path}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}
