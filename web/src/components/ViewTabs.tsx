import type { ViewMode } from '../lib/types'

interface ViewTabsProps {
  current: ViewMode
  onChange: (mode: ViewMode) => void
}

const TABS: { mode: ViewMode; label: string; icon: string }[] = [
  { mode: 'command', label: 'Command Center', icon: '🛰️' },
  { mode: 'story', label: 'Story', icon: '📖' },
  { mode: 'system', label: 'System', icon: '📦' },
  { mode: 'layers', label: 'Layers', icon: '📊' },
  { mode: 'files', label: 'Files', icon: '📄' },
]

export function ViewTabs({ current, onChange }: ViewTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
      {TABS.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${current === mode 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white hover:bg-bg-secondary'
            }
          `}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
