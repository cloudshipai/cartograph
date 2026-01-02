import { LAYER_COLORS, LAYER_LABELS, type LayerType } from '../lib/types'

export function Legend() {
  const layers = Object.entries(LAYER_COLORS) as [LayerType, string][]

  return (
    <div className="absolute bottom-6 left-6 bg-bg-secondary border border-border rounded-lg p-4 text-xs">
      <h3 className="font-medium mb-3 text-gray-300">Layers</h3>
      <div className="space-y-2">
        {layers.map(([layer, color]) => (
          <div key={layer} className="flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-400">{LAYER_LABELS[layer]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
