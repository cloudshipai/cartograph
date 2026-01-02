import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { GraphData, GraphNode, ViewMode } from '../lib/types'
import { LAYER_COLORS, type LayerType } from '../lib/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  data: GraphData | null
  onSelectNode: (nodeId: string) => void
  onChangeView: (mode: ViewMode) => void
  onExport: (format: 'mermaid' | 'json') => void
}

interface Command {
  id: string
  type: 'node' | 'action' | 'view'
  label: string
  description?: string
  icon: string
  layer?: LayerType
  action: () => void
}

export function CommandPalette({ 
  isOpen, 
  onClose, 
  data, 
  onSelectNode, 
  onChangeView,
  onExport 
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      { id: 'view-system', type: 'view', label: 'System View', icon: '📦', action: () => onChangeView('system') },
      { id: 'view-layers', type: 'view', label: 'Layers View', icon: '📊', action: () => onChangeView('layers') },
      { id: 'view-files', type: 'view', label: 'Files View', icon: '📄', action: () => onChangeView('files') },
      { id: 'export-mermaid', type: 'action', label: 'Export as Mermaid', icon: '📋', action: () => onExport('mermaid') },
      { id: 'export-json', type: 'action', label: 'Export as JSON', icon: '💾', action: () => onExport('json') },
    ]

    if (data) {
      data.nodes.forEach((node: GraphNode) => {
        cmds.push({
          id: node.id,
          type: 'node',
          label: node.label,
          description: node.id,
          icon: getLayerIcon(node.layer as LayerType),
          layer: node.layer as LayerType,
          action: () => onSelectNode(node.id),
        })
      })
    }

    return cmds
  }, [data, onSelectNode, onChangeView, onExport])

  const filteredCommands = useMemo(() => {
    if (!search) return commands.slice(0, 20)
    
    const lower = search.toLowerCase()
    const searchTerms = lower.split(/\s+/)
    
    return commands
      .filter(cmd => {
        const text = `${cmd.label} ${cmd.description || ''} ${cmd.layer || ''}`.toLowerCase()
        return searchTerms.every(term => text.includes(term))
      })
      .slice(0, 20)
  }, [commands, search])

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [filteredCommands, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, commands..."
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
          />
          <kbd className="px-2 py-0.5 text-xs bg-bg-tertiary rounded text-gray-500">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No results found</div>
          ) : (
            filteredCommands.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action()
                  onClose()
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  ${i === selectedIndex ? 'bg-blue-600/20' : 'hover:bg-bg-tertiary'}
                `}
              >
                <span className="text-lg">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs text-gray-500 truncate">{cmd.description}</div>
                  )}
                </div>
                {cmd.layer && (
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: LAYER_COLORS[cmd.layer] }}
                  />
                )}
                {cmd.type === 'view' && (
                  <kbd className="px-1.5 py-0.5 text-xs bg-bg-tertiary rounded text-gray-500">
                    ⌘{cmd.id.split('-')[1]?.[0]?.toUpperCase()}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-bg-tertiary rounded">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-bg-tertiary rounded">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-bg-tertiary rounded">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}

function getLayerIcon(layer: LayerType): string {
  const icons: Record<LayerType, string> = {
    api: '🌐',
    service: '⚙️',
    model: '📊',
    ui: '🎨',
    util: '🔧',
    test: '🧪',
    config: '⚙️',
    other: '📄',
  }
  return icons[layer] || '📄'
}
