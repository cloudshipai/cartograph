import { ViewTabs } from './ViewTabs'
import type { ViewMode } from '../lib/types'

interface HeaderProps {
  connected: boolean
  fileCount: number
  lastUpdate: Date | null
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
  onOpenSearch: () => void
}

export function Header({ connected, fileCount, lastUpdate, viewMode, onViewChange, onOpenSearch }: HeaderProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return 'never'
    return date.toLocaleTimeString()
  }

  return (
    <header className="flex items-center gap-4 px-6 py-3 bg-bg-secondary border-b border-border">
      <div className="flex items-center gap-3">
        <svg className="w-6 h-6" viewBox="0 0 100 100">
          <rect width="100" height="100" rx="20" fill="#1a1a2e"/>
          <path d="M25 75 L50 25 L75 75 M35 55 L65 55" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" fill="none"/>
          <circle cx="50" cy="25" r="6" fill="#10b981"/>
          <circle cx="25" cy="75" r="6" fill="#f59e0b"/>
          <circle cx="75" cy="75" r="6" fill="#ec4899"/>
        </svg>
        <h1 className="text-lg font-semibold">Cartograph</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-xs text-gray-400">
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      <ViewTabs current={viewMode} onChange={onViewChange} />

      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-gray-700 rounded-lg transition-colors text-sm text-gray-400"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search...</span>
        <kbd className="px-1.5 py-0.5 text-xs bg-bg-secondary rounded">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-6 text-xs text-gray-500">
        <span>{fileCount} files</span>
        <span>Updated {formatTime(lastUpdate)}</span>
      </div>
    </header>
  )
}
