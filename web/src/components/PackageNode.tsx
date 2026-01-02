import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { LAYER_COLORS, type LayerType } from '../lib/types'

interface PackageNodeData {
  label: string
  layer: LayerType
  fileCount: number
  functions: number
  classes: number
}

export const PackageNode = memo(function PackageNode({ data }: NodeProps) {
  const nodeData = data as unknown as PackageNodeData
  const color = LAYER_COLORS[nodeData.layer] || LAYER_COLORS.other

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 bg-bg-secondary min-w-[180px]"
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📦</span>
        <span className="font-medium text-white truncate">{nodeData.label}</span>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span style={{ color }}>●</span>
          {nodeData.fileCount} files
        </span>
        <span>{nodeData.functions} fn</span>
        <span>{nodeData.classes} cls</span>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  )
})
