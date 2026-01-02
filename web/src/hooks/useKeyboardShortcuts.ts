import { useEffect, useCallback } from 'react'
import type { ViewMode } from '../lib/types'

interface KeyboardShortcutsConfig {
  onOpenCommandPalette: () => void
  onChangeView: (mode: ViewMode) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onEscape: () => void
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onChangeView,
  onZoomIn,
  onZoomOut,
  onFitView,
  onEscape,
}: KeyboardShortcutsConfig) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey
    const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

    if (isTyping) {
      if (e.key === 'Escape') onEscape()
      return
    }

    const shortcuts: Record<string, () => void> = {
      'mod+k': onOpenCommandPalette,
      'mod+1': () => onChangeView('system'),
      'mod+2': () => onChangeView('layers'),
      'mod+3': () => onChangeView('files'),
      '=': onZoomIn,
      '+': onZoomIn,
      '-': onZoomOut,
      '0': onFitView,
      'Escape': onEscape,
    }

    const key = isMod ? `mod+${e.key}` : e.key
    const action = shortcuts[key]
    
    if (action) {
      e.preventDefault()
      action()
    }
  }, [onOpenCommandPalette, onChangeView, onZoomIn, onZoomOut, onFitView, onEscape])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
