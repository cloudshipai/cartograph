import { useState, useCallback } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { Header } from './components/Header'
import { MapCanvas } from './components/MapCanvas'
import { StoryView } from './components/StoryView'
import { CommandCenter } from './components/CommandCenter'
import { FilterPanel } from './components/FilterPanel'
import { Sidebar } from './components/Sidebar'
import { Breadcrumbs } from './components/Breadcrumbs'
import { CommandPalette } from './components/CommandPalette'
import { useWebSocket } from './hooks/useWebSocket'
import { useGraphData } from './hooks/useGraphData'
import { useStoryData } from './hooks/useStoryData'
import { useDiagrams } from './hooks/useDiagrams'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { generateMermaidDiagram, generateLayerMermaid } from './lib/mermaid'
import type { ViewMode, LayerType, GraphData } from './lib/types'

function AppContent() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('command')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  const [activeLayers, setActiveLayers] = useState<LayerType[]>([
    'api', 'service', 'model', 'ui', 'util', 'test', 'config', 'other'
  ])
  
  const { data: graphData, loading, error, refetch } = useGraphData()
  const { data: storyData, loading: storyLoading, refetch: refetchStory } = useStoryData()
  const { data: diagramData, loading: diagramsLoading, refetch: refetchDiagrams } = useDiagrams()
  const { connected, lastUpdate, recentChanges } = useWebSocket(() => {
    refetch()
    refetchStory()
    refetchDiagrams()
  })
  const reactFlowInstance = useReactFlow()

  const filteredData: GraphData | null = graphData ? {
    ...graphData,
    nodes: graphData.nodes.filter(n => activeLayers.includes(n.layer as LayerType)),
    edges: graphData.edges.filter(e => {
      const sourceNode = graphData.nodes.find(n => n.id === e.source)
      const targetNode = graphData.nodes.find(n => n.id === e.target)
      return sourceNode && targetNode && 
        activeLayers.includes(sourceNode.layer as LayerType) &&
        activeLayers.includes(targetNode.layer as LayerType)
    })
  } : null

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(prev => prev === nodeId ? null : nodeId)
  }, [])

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    setBreadcrumbs([])
  }, [])

  const handleToggleLayer = useCallback((layer: LayerType) => {
    setActiveLayers(prev => 
      prev.includes(layer) 
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    )
  }, [])

  const handleBreadcrumbNavigate = useCallback((index: number) => {
    if (index === -1) {
      setBreadcrumbs([])
    } else {
      setBreadcrumbs(prev => prev.slice(0, index + 1))
    }
  }, [])

  const handleExport = useCallback((format: 'mermaid' | 'json') => {
    if (!graphData) return

    let content: string
    let filename: string
    let mimeType: string

    if (format === 'mermaid') {
      content = viewMode === 'layers' 
        ? generateLayerMermaid(graphData)
        : generateMermaidDiagram(graphData)
      filename = 'architecture.mmd'
      mimeType = 'text/plain'
    } else {
      content = JSON.stringify(graphData, null, 2)
      filename = 'architecture.json'
      mimeType = 'application/json'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [graphData, viewMode])

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn()
  }, [reactFlowInstance])

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut()
  }, [reactFlowInstance])

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView()
  }, [reactFlowInstance])

  const handleEscape = useCallback(() => {
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false)
    } else if (selectedNode) {
      setSelectedNode(null)
    }
  }, [commandPaletteOpen, selectedNode])

  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onChangeView: handleViewChange,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitView: handleFitView,
    onEscape: handleEscape,
  })

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-status-error mb-2">Failed to load graph</h1>
          <p className="text-content-muted">{error}</p>
          <button 
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-accent rounded hover:bg-accent-hover"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <Header 
        connected={connected} 
        fileCount={filteredData?.nodes.length ?? 0}
        lastUpdate={lastUpdate}
        viewMode={viewMode}
        onViewChange={handleViewChange}
        onOpenSearch={() => setCommandPaletteOpen(true)}
      />

      {breadcrumbs.length > 0 && (
        <div className="px-6 py-2 bg-surface-1 border-b border-border">
          <Breadcrumbs items={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative">
          {viewMode === 'command' ? (
            <CommandCenter 
              diagrams={diagramData}
              loading={diagramsLoading}
              connected={connected}
              lastUpdate={lastUpdate}
              recentChanges={recentChanges}
            />
          ) : viewMode === 'story' ? (
            <StoryView story={storyData} loading={storyLoading} />
          ) : (
            <>
              <MapCanvas 
                data={filteredData}
                loading={loading}
                onNodeClick={handleNodeClick}
                selectedNode={selectedNode}
                viewMode={viewMode}
              />
              <FilterPanel 
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                onExport={handleExport}
              />
            </>
          )}
        </main>
        
        {viewMode !== 'story' && viewMode !== 'command' && selectedNode && filteredData && (
          <Sidebar 
            nodeId={selectedNode}
            data={filteredData}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        data={graphData}
        onSelectNode={(nodeId) => {
          setSelectedNode(nodeId)
          setCommandPaletteOpen(false)
        }}
        onChangeView={handleViewChange}
        onExport={handleExport}
      />

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-content-muted pointer-events-none">
        Made by CloudShip AI Team
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  )
}
