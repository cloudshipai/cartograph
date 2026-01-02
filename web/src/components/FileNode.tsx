import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { LAYER_COLORS, type LayerType } from '../lib/types'

interface FileNodeData {
  label: string
  layer: string
  functions: number
  classes: number
  exports: number
}

export const FileNode = memo(function FileNode({ data }: NodeProps<FileNodeData>) {
  const layer = data.layer as LayerType
  const borderColor = LAYER_COLORS[layer] || LAYER_COLORS.other

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      
      <div 
        className="bg-bg-secondary rounded-lg px-3 py-2 min-w-[140px] border"
        style={{ borderColor }}
      >
        <div className="font-medium text-xs truncate max-w-[160px]">
          {data.label}
        </div>
        <div className="flex gap-2 mt-1 text-[10px] text-gray-500">
          {data.functions > 0 && <span>fn:{data.functions}</span>}
          {data.classes > 0 && <span>cls:{data.classes}</span>}
          {data.exports > 0 && <span>exp:{data.exports}</span>}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </>
  )
})
