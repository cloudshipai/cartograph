import { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/Header'
import { MapCanvas } from './components/MapCanvas'
import { Legend } from './components/Legend'
import { Sidebar } from './components/Sidebar'
import { useWebSocket } from './hooks/useWebSocket'
import { useGraphData } from './hooks/useGraphData'
import type { Manifest } from './lib/types'

export default function App() {
  const [_manifest, setManifest] = useState<Manifest | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  
  const { data: graphData, loading, error, refetch } = useGraphData()
  const { connected, lastUpdate } = useWebSocket(refetch)

  useEffect(() => {
    fetch('/api/manifest')
      .then(res => res.json())
      .then(setManifest)
      .catch(console.error)
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(prev => prev === nodeId ? null : nodeId)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-400 mb-2">Failed to load graph</h1>
          <p className="text-gray-500">{error}</p>
          <button 
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg-primary">
        <Header 
          connected={connected} 
          fileCount={graphData?.nodes.length ?? 0}
          lastUpdate={lastUpdate}
        />
        
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative">
            <MapCanvas 
              data={graphData}
              loading={loading}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
            />
            <Legend />
          </main>
          
          {selectedNode && graphData && (
            <Sidebar 
              nodeId={selectedNode}
              data={graphData}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
