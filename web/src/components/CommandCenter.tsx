import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { DiagramSet, Diagram, DiagramCategory } from '../lib/types'

interface CommandCenterProps {
  diagrams: DiagramSet | null
  loading: boolean
  connected: boolean
  lastUpdate: Date | null
  recentChanges: string[]
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fafafa',
    primaryBorderColor: '#3f3f46',
    lineColor: '#52525b',
    secondaryColor: '#27272a',
    tertiaryColor: '#18181b',
    background: '#09090b',
  },
  flowchart: { curve: 'basis' },
  sequence: { mirrorActors: false },
})

const CATEGORY_CONFIG: Record<DiagramCategory, { icon: string; label: string; color: string }> = {
  architecture: { icon: '🏗️', label: 'Architecture', color: 'layer-api' },
  layers: { icon: '📊', label: 'Layers', color: 'layer-service' },
  flows: { icon: '🔄', label: 'Flows', color: 'layer-util' },
  dependencies: { icon: '🔗', label: 'Dependencies', color: 'layer-model' },
  patterns: { icon: '🧩', label: 'Patterns', color: 'layer-ui' },
  domains: { icon: '📦', label: 'Domains', color: 'layer-config' },
  insights: { icon: '💡', label: 'Insights', color: 'status-warning' },
}

export function CommandCenter({ diagrams, loading, connected, lastUpdate, recentChanges }: CommandCenterProps) {
  const [activeCategory, setActiveCategory] = useState<DiagramCategory | 'all'>('all')
  const [expandedDiagram, setExpandedDiagram] = useState<string | null>(null)

  if (loading && !diagrams) {
    return <LoadingState />
  }

  if (!diagrams) {
    return <EmptyState />
  }

  const filteredDiagrams = activeCategory === 'all' 
    ? diagrams.diagrams 
    : diagrams.diagrams.filter(d => d.category === activeCategory)

  const categories = [...new Set(diagrams.diagrams.map(d => d.category))]

  return (
    <div className="h-full flex flex-col bg-surface-0 overflow-hidden">
      <CommandHeader 
        connected={connected} 
        lastUpdate={lastUpdate} 
        summary={diagrams.summary}
        diagramCount={diagrams.diagrams.length}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          recentChanges={recentChanges}
        />
        
        <main className="flex-1 overflow-auto p-4">
          {expandedDiagram ? (
            <ExpandedDiagramView 
              diagram={diagrams.diagrams.find(d => d.id === expandedDiagram)!}
              onClose={() => setExpandedDiagram(null)}
            />
          ) : (
            <DiagramGrid 
              diagrams={filteredDiagrams}
              onExpand={setExpandedDiagram}
              recentChanges={recentChanges}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function CommandHeader({ connected, lastUpdate, summary, diagramCount }: {
  connected: boolean
  lastUpdate: Date | null
  summary: string
  diagramCount: number
}) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (lastUpdate) {
      setPulse(true)
      const timer = setTimeout(() => setPulse(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [lastUpdate])

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-layer-util flex items-center justify-center">
            <span className="text-xl">🛰️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-content-primary tracking-tight">COMMAND CENTER</h1>
            <p className="text-xs text-content-muted">{diagramCount} diagrams</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${connected ? 'bg-status-success/20' : 'bg-surface-3'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-status-success' : 'bg-content-muted'} ${connected && pulse ? 'animate-ping' : ''}`} />
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-status-success' : 'bg-content-muted'} absolute`} />
          <span className="text-xs font-medium text-content-secondary">
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-8">
        <p className="text-sm text-content-secondary truncate">{summary}</p>
      </div>

      <div className="text-right text-xs text-content-muted">
        {lastUpdate && (
          <span className={pulse ? 'text-status-success' : ''}>
            Updated {formatRelativeTime(lastUpdate)}
          </span>
        )}
      </div>
    </header>
  )
}

function Sidebar({ categories, activeCategory, onCategoryChange, recentChanges }: {
  categories: DiagramCategory[]
  activeCategory: DiagramCategory | 'all'
  onCategoryChange: (cat: DiagramCategory | 'all') => void
  recentChanges: string[]
}) {
  return (
    <aside className="w-64 border-r border-border bg-surface-1 flex flex-col">
      <div className="p-4">
        <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">Views</h3>
        <nav className="space-y-1">
          <CategoryButton 
            icon="🎯" 
            label="All Diagrams" 
            active={activeCategory === 'all'}
            onClick={() => onCategoryChange('all')}
          />
          {categories.map(cat => (
            <CategoryButton
              key={cat}
              icon={CATEGORY_CONFIG[cat].icon}
              label={CATEGORY_CONFIG[cat].label}
              active={activeCategory === cat}
              onClick={() => onCategoryChange(cat)}
            />
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-4 border-t border-border">
        <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
          Recent Changes
        </h3>
        {recentChanges.length > 0 ? (
          <ul className="space-y-2">
            {recentChanges.slice(0, 10).map((file, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-status-warning">⚡</span>
                <span className="text-content-secondary truncate">{file}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-content-muted">No recent changes</p>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-content-muted">
          <p>Press <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-content-secondary">Esc</kbd> to close expanded view</p>
        </div>
      </div>
    </aside>
  )
}

function CategoryButton({ icon, label, active, onClick }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-accent/20 text-accent-hover border border-accent/30' 
          : 'text-content-secondary hover:bg-surface-3 hover:text-content-primary'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function DiagramGrid({ diagrams, onExpand, recentChanges }: {
  diagrams: Diagram[]
  onExpand: (id: string) => void
  recentChanges: string[]
}) {
  const featured = diagrams.filter(d => d.priority >= 85).slice(0, 2)
  const regular = diagrams.filter(d => !featured.includes(d))

  return (
    <div className="space-y-4">
      {featured.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {featured.map(d => (
            <DiagramCard 
              key={d.id} 
              diagram={d} 
              featured 
              onExpand={() => onExpand(d.id)}
              isUpdating={recentChanges.some(f => d.labels.some(l => f.includes(l)))}
            />
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-4">
        {regular.map(d => (
          <DiagramCard 
            key={d.id} 
            diagram={d} 
            onExpand={() => onExpand(d.id)}
            isUpdating={false}
          />
        ))}
      </div>
    </div>
  )
}

function DiagramCard({ diagram, featured, onExpand, isUpdating }: {
  diagram: Diagram
  featured?: boolean
  onExpand: () => void
  isUpdating: boolean
}) {
  const config = CATEGORY_CONFIG[diagram.category]
  
  return (
    <div 
      onClick={onExpand}
      className={`
        group relative rounded-xl border bg-surface-2 cursor-pointer transition-all duration-300
        hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10
        ${featured ? 'min-h-[320px]' : 'min-h-[240px]'}
        ${isUpdating ? 'border-status-warning/50 ring-2 ring-status-warning/20' : 'border-border'}
      `}
    >
      {isUpdating && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-status-warning/20 rounded-full">
          <span className="w-1.5 h-1.5 bg-status-warning rounded-full animate-pulse" />
          <span className="text-[10px] text-status-warning font-medium">UPDATING</span>
        </div>
      )}

      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <h3 className="font-semibold text-content-primary group-hover:text-accent-hover transition-colors">
              {diagram.title}
            </h3>
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded bg-${config.color}/20 text-${config.color}`}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-content-muted line-clamp-2">{diagram.description}</p>
      </div>

      <div className={`p-4 ${featured ? 'h-[220px]' : 'h-[160px]'} overflow-hidden`}>
        <MermaidRenderer code={diagram.mermaid} small={!featured} />
      </div>

      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-content-muted">Click to expand →</span>
      </div>
    </div>
  )
}

function ExpandedDiagramView({ diagram, onClose }: {
  diagram: Diagram
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<'diagram' | 'source'>('diagram')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const config = CATEGORY_CONFIG[diagram.category]

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors"
          >
            <svg className="w-5 h-5 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-content-primary">{diagram.title}</h2>
              <p className="text-sm text-content-muted">{diagram.description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-surface-3 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'diagram' 
                  ? 'bg-accent text-content-primary' 
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Diagram
            </button>
            <button
              onClick={() => setActiveTab('source')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'source' 
                  ? 'bg-accent text-content-primary' 
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Source
            </button>
          </div>

          {activeTab === 'diagram' && (
            <div className="text-xs text-content-muted">
              Scroll to zoom • Drag to pan • Double-click to reset
            </div>
          )}

          <div className="flex gap-2">
            {diagram.labels.map(label => (
              <span key={label} className="px-2 py-1 text-xs bg-surface-3 rounded text-content-secondary">
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-surface-2">
        {activeTab === 'diagram' ? (
          <TransformWrapper
            initialScale={1.5}
            minScale={0.3}
            maxScale={5}
            centerOnInit
            limitToBounds={false}
            wheel={{ step: 0.1, smoothStep: 0.01 }}
            doubleClick={{ mode: 'reset' }}
            panning={{ velocityDisabled: true }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="flex items-center justify-center min-h-full"
            >
              <MermaidRenderer code={diagram.mermaid} />
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="h-full p-6 overflow-auto">
            <pre className="text-sm text-content-secondary font-mono whitespace-pre-wrap">
              {diagram.mermaid}
            </pre>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-border bg-surface-1">
        <div className="flex items-center justify-between text-xs text-content-muted">
          <span>Press <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">Esc</kbd> to close</span>
          <span className="text-content-muted">Made by CloudShip AI Team</span>
          {activeTab === 'diagram' && (
            <span>Scroll to zoom • Drag to pan • Double-click to reset</span>
          )}
        </div>
      </footer>
    </div>
  )
}

function MermaidRenderer({ code, small }: { code: string; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return

    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
    
    mermaid.render(id, code)
      .then(result => {
        setSvg(result.svg)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
      })
  }, [code])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-status-error">Failed to render: {error}</p>
      </div>
    )
  }

  return (
    <div 
      ref={ref}
      className={small ? '[&_svg]:max-h-[160px] [&_svg]:w-auto' : ''}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function LoadingState() {
  return (
    <div className="h-full flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-accent/30 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-accent rounded-full animate-spin" />
        </div>
        <p className="text-content-secondary">Analyzing codebase architecture...</p>
        <p className="text-xs text-content-muted mt-2">Generating diagrams</p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <span className="text-4xl mb-4 block">🛰️</span>
        <h2 className="text-xl font-semibold text-content-primary mb-2">No Diagrams Yet</h2>
        <p className="text-content-muted">Waiting for codebase analysis...</p>
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return date.toLocaleTimeString()
}
