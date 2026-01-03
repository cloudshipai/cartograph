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
    <header className="flex items-center gap-4 px-6 py-3 bg-surface-1 border-b border-border">
      <div className="flex items-center gap-3">
        <svg className="w-7 h-7" viewBox="0 0 100 100">
          <rect width="100" height="100" rx="16" fill="url(#mapGradient)"/>
          <defs>
            <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6"/>
              <stop offset="100%" stopColor="#a78bfa"/>
            </linearGradient>
          </defs>
          <path d="M25 30 L40 20 L60 30 L75 20 L75 70 L60 80 L40 70 L25 80 Z" fill="none" stroke="#fafafa" strokeWidth="4" strokeLinejoin="round"/>
          <line x1="40" y1="20" x2="40" y2="70" stroke="#fafafa" strokeWidth="3" opacity="0.7"/>
          <line x1="60" y1="30" x2="60" y2="80" stroke="#fafafa" strokeWidth="3" opacity="0.7"/>
          <circle cx="50" cy="45" r="8" fill="#fbbf24"/>
          <circle cx="50" cy="45" r="4" fill="#fafafa"/>
        </svg>
        <h1 className="text-lg font-semibold">Cartograph</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-status-success animate-pulse' : 'bg-content-muted'}`} />
        <span className="text-xs text-content-secondary">
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      <ViewTabs current={viewMode} onChange={onViewChange} />

      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-surface-4 rounded-lg transition-colors text-sm text-content-secondary"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search...</span>
        <kbd className="px-1.5 py-0.5 text-xs bg-surface-1 rounded">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-6 text-xs text-content-muted">
        <span>{fileCount} files</span>
        <span>Updated {formatTime(lastUpdate)}</span>
      </div>
    </header>
  )
}
