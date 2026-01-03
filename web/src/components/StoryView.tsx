import { useEffect, useState, useRef } from 'react'
import mermaid from 'mermaid'
import type { ArchitectureStory, Flow, Domain, LayerSummary } from '../lib/types'

interface StoryViewProps {
  story: ArchitectureStory | null
  loading: boolean
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#e0e0e0',
    primaryBorderColor: '#4b5563',
    lineColor: '#6b7280',
    secondaryColor: '#1f2937',
    tertiaryColor: '#111827',
  },
})

export function StoryView({ story, loading }: StoryViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Generating architecture story...</p>
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No story available yet</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-primary">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <StoryHeader story={story} />
        <StorySummary story={story} />
        <LayerDiagram story={story} />
        <FlowsSection flows={story.flows} />
        <DomainsSection domains={story.domains} />
        <LayersSection layers={story.layers} />
      </div>
    </div>
  )
}

function StoryHeader({ story }: { story: ArchitectureStory }) {
  return (
    <header className="mb-12">
      <h1 className="text-4xl font-bold text-white mb-4">{story.title}</h1>
      <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
        <span>{story.stats.totalFiles} files</span>
        <span>•</span>
        <span>{story.stats.domains} domains</span>
        <span>•</span>
        <span>{story.stats.flows} flows</span>
        <span>•</span>
        <span>Generated {new Date(story.generated).toLocaleString()}</span>
      </div>
    </header>
  )
}

function StorySummary({ story }: { story: ArchitectureStory }) {
  return (
    <section className="mb-12">
      <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-blue-500 pl-4">
        {story.summary}
      </p>
    </section>
  )
}

function LayerDiagram({ story }: { story: ArchitectureStory }) {
  if (!story.layerDiagram) return null

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold text-white mb-6">System Architecture</h2>
      <MermaidDiagram code={story.layerDiagram} />
    </section>
  )
}

function FlowsSection({ flows }: { flows: Flow[] }) {
  if (flows.length === 0) return null

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold text-white mb-6">Request Flows</h2>
      <p className="text-gray-400 mb-8">How data moves through the system:</p>
      
      <div className="space-y-12">
        {flows.map((flow, i) => (
          <FlowCard key={i} flow={flow} />
        ))}
      </div>
    </section>
  )
}

function FlowCard({ flow }: { flow: Flow }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-bg-secondary hover:bg-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {flow.entryPoint.type === 'api' ? '🌐' : '💻'}
          </span>
          <div className="text-left">
            <h3 className="text-lg font-medium text-white">{flow.name}</h3>
            <p className="text-sm text-gray-400">{flow.entryPoint.path}</p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-6 border-t border-border">
          <p className="text-gray-300 mb-6">{flow.description}</p>
          
          <div className="mb-6">
            <MermaidDiagram code={flow.mermaid} />
          </div>

          <div className="space-y-3">
            {flow.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </div>
                <div>
                  <p className="text-gray-200">
                    <span className="font-medium text-blue-400">{step.actor}</span>
                    {' → '}
                    <span className="font-medium text-green-400">{step.target}</span>
                  </p>
                  <p className="text-sm text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DomainsSection({ domains }: { domains: Domain[] }) {
  if (domains.length === 0) return null

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold text-white mb-6">Domains</h2>
      <p className="text-gray-400 mb-8">Major functional areas of the codebase:</p>
      
      <div className="grid gap-4 md:grid-cols-2">
        {domains.slice(0, 8).map((domain, i) => (
          <DomainCard key={i} domain={domain} />
        ))}
      </div>
      
      {domains.length > 8 && (
        <p className="text-center text-gray-500 mt-4">
          +{domains.length - 8} more domains
        </p>
      )}
    </section>
  )
}

function DomainCard({ domain }: { domain: Domain }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-bg-secondary">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-medium text-white">{domain.name}</h3>
        <span className={`px-2 py-0.5 text-xs rounded ${getLayerColor(domain.layer)}`}>
          {domain.layer}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-3">{domain.description}</p>
      <div className="flex flex-wrap gap-1">
        {domain.keyClasses.slice(0, 3).map((cls, i) => (
          <span key={i} className="px-2 py-0.5 text-xs bg-bg-tertiary rounded text-gray-300">
            {cls}
          </span>
        ))}
        {domain.keyFunctions.slice(0, 2).map((fn, i) => (
          <span key={`fn-${i}`} className="px-2 py-0.5 text-xs bg-bg-tertiary rounded text-gray-300">
            {fn}()
          </span>
        ))}
      </div>
    </div>
  )
}

function LayersSection({ layers }: { layers: LayerSummary[] }) {
  if (layers.length === 0) return null

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold text-white mb-6">Architecture Layers</h2>
      
      <div className="space-y-4">
        {layers.map((layer, i) => (
          <div key={i} className="border border-border rounded-lg p-4 bg-bg-secondary">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-white">{layer.name}</h3>
              <span className="text-sm text-gray-400">{layer.fileCount} files</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">{layer.description}</p>
            <div className="flex flex-wrap gap-2">
              {layer.keyComponents.map((comp, j) => (
                <span key={j} className="px-2 py-1 text-xs bg-bg-tertiary rounded text-gray-300 font-mono">
                  {comp}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code || !ref.current) return

    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
    
    mermaid.render(id, code)
      .then(result => {
        setSvg(result.svg)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setSvg('')
      })
  }, [code])

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded text-sm text-red-400">
        Failed to render diagram: {error}
      </div>
    )
  }

  return (
    <div 
      ref={ref}
      className="bg-bg-tertiary rounded-lg p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function getLayerColor(layer: string): string {
  const colors: Record<string, string> = {
    api: 'bg-blue-600/20 text-blue-400',
    service: 'bg-green-600/20 text-green-400',
    model: 'bg-yellow-600/20 text-yellow-400',
    ui: 'bg-pink-600/20 text-pink-400',
    util: 'bg-purple-600/20 text-purple-400',
    test: 'bg-gray-600/20 text-gray-400',
    config: 'bg-cyan-600/20 text-cyan-400',
  }
  return colors[layer] || 'bg-gray-600/20 text-gray-400'
}
