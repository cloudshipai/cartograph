import { LAYER_COLORS, LAYER_LABELS, type LayerType } from '../lib/types'

interface FilterPanelProps {
  activeLayers: LayerType[]
  onToggleLayer: (layer: LayerType) => void
  onExport: (format: 'mermaid' | 'json') => void
}

const ALL_LAYERS: LayerType[] = ['api', 'service', 'model', 'ui', 'util', 'test', 'config', 'other']

export function FilterPanel({ activeLayers, onToggleLayer, onExport }: FilterPanelProps) {
  return (
    <div className="absolute bottom-6 left-6 bg-bg-secondary border border-border rounded-lg overflow-hidden text-xs w-48">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="font-medium text-gray-300">Filters</h3>
      </div>

      <div className="p-3 space-y-4">
        <section>
          <h4 className="text-gray-500 uppercase text-[10px] font-medium mb-2">Layers</h4>
          <div className="space-y-1.5">
            {ALL_LAYERS.map(layer => (
              <label key={layer} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={activeLayers.includes(layer)}
                  onChange={() => onToggleLayer(layer)}
                  className="sr-only"
                />
                <span className={`
                  w-4 h-4 rounded border flex items-center justify-center transition-colors
                  ${activeLayers.includes(layer) 
                    ? 'border-blue-500 bg-blue-500' 
                    : 'border-gray-600 group-hover:border-gray-500'
                  }
                `}>
                  {activeLayers.includes(layer) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: LAYER_COLORS[layer] }}
                />
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  {LAYER_LABELS[layer]}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-gray-500 uppercase text-[10px] font-medium mb-2">Export</h4>
          <div className="flex gap-2">
            <button
              onClick={() => onExport('mermaid')}
              className="flex-1 px-2 py-1.5 bg-bg-tertiary hover:bg-gray-700 rounded transition-colors text-gray-300"
            >
              Mermaid
            </button>
            <button
              onClick={() => onExport('json')}
              className="flex-1 px-2 py-1.5 bg-bg-tertiary hover:bg-gray-700 rounded transition-colors text-gray-300"
            >
              JSON
            </button>
          </div>
        </section>
      </div>

      <div className="px-3 py-2 border-t border-border text-gray-600">
        <kbd className="px-1 bg-bg-tertiary rounded">⌘K</kbd> Quick search
      </div>
    </div>
  )
}
