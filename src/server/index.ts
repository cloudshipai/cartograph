/**
 * Cartograph Web Server
 * Serves the visualization UI and provides WebSocket updates
 */

import { readFile } from "fs/promises"
import { join } from "path"
import type { CodebaseAnalysis } from "../analyzer/treesitter"
import type { Server, ServerWebSocket } from "bun"

interface WebSocketData {
  id: string
}

export class CartographServer {
  private server: Server | null = null
  private clients = new Set<ServerWebSocket<WebSocketData>>()

  constructor(
    private port: number,
    private architectureDir: string
  ) {}

  async start(): Promise<void> {
    const self = this

    this.server = Bun.serve<WebSocketData>({
      port: this.port,

      async fetch(req, server) {
        const url = new URL(req.url)
        const path = url.pathname

        // WebSocket upgrade
        if (path === "/ws") {
          const upgraded = server.upgrade(req, {
            data: { id: crypto.randomUUID() },
          })
          return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 })
        }

        // API routes
        if (path === "/api/graph") {
          try {
            const data = await readFile(join(self.architectureDir, "graph.json"), "utf-8")
            return new Response(data, {
              headers: { "Content-Type": "application/json" },
            })
          } catch {
            return new Response(JSON.stringify({ nodes: [], edges: [] }), {
              headers: { "Content-Type": "application/json" },
            })
          }
        }

        if (path === "/api/manifest") {
          try {
            const data = await readFile(join(self.architectureDir, "manifest.json"), "utf-8")
            return new Response(data, {
              headers: { "Content-Type": "application/json" },
            })
          } catch {
            return new Response("{}", {
              headers: { "Content-Type": "application/json" },
            })
          }
        }

        if (path.startsWith("/api/maps/")) {
          const file = path.replace("/api/maps/", "")
          try {
            const data = await readFile(join(self.architectureDir, "maps", file), "utf-8")
            return new Response(data, {
              headers: { "Content-Type": "text/markdown" },
            })
          } catch {
            return new Response("Not found", { status: 404 })
          }
        }

        // Serve UI - for now return a simple HTML page
        // TODO: Replace with actual React build
        if (path === "/" || path === "/index.html") {
          return new Response(self.getIndexHtml(), {
            headers: { "Content-Type": "text/html" },
          })
        }

        return new Response("Not found", { status: 404 })
      },

      websocket: {
        open(ws) {
          self.clients.add(ws)
          console.log(`[cartograph] Client connected (${self.clients.size} total)`)
        },
        close(ws) {
          self.clients.delete(ws)
          console.log(`[cartograph] Client disconnected (${self.clients.size} total)`)
        },
        message(ws, message) {
          // Handle incoming messages if needed
        },
      },
    })
  }

  stop(): void {
    if (this.server) {
      this.server.stop()
      this.server = null
    }
  }

  broadcastUpdate(analysis: CodebaseAnalysis): void {
    const message = JSON.stringify({
      type: "update",
      timestamp: analysis.timestamp.toISOString(),
      fileCount: analysis.files.length,
    })

    for (const client of this.clients) {
      client.send(message)
    }
  }

  private getIndexHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cartograph - Codebase Visualization</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/@xyflow/react@12/dist/umd/index.js"></script>
  <link href="https://unpkg.com/@xyflow/react@12/dist/style.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { width: 100vw; height: 100vh; }
    .header { 
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1a1a2e; color: white; padding: 12px 24px;
      display: flex; align-items: center; gap: 16px;
      border-bottom: 1px solid #333;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header .status { font-size: 12px; color: #10b981; }
    .header .stats { margin-left: auto; font-size: 12px; color: #888; }
    .flow-container { width: 100%; height: 100%; padding-top: 48px; background: #0f0f1a; }
    .react-flow__node { 
      background: #1e1e2e; border: 1px solid #333; border-radius: 8px;
      padding: 8px 12px; font-size: 11px; color: #e0e0e0;
    }
    .react-flow__node.api { border-color: #3b82f6; }
    .react-flow__node.service { border-color: #10b981; }
    .react-flow__node.model { border-color: #f59e0b; }
    .react-flow__node.ui { border-color: #ec4899; }
    .react-flow__node.util { border-color: #8b5cf6; }
    .react-flow__node.test { border-color: #6b7280; }
    .react-flow__edge-path { stroke: #444; }
    .legend {
      position: fixed; bottom: 24px; left: 24px; z-index: 100;
      background: #1a1a2e; border: 1px solid #333; border-radius: 8px;
      padding: 12px 16px; font-size: 11px; color: #888;
    }
    .legend-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useCallback } = React;
    const { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } = window.ReactFlowNS || {};

    // Fallback if ReactFlow didn't load
    if (!ReactFlow) {
      document.getElementById('root').innerHTML = '<div style="padding: 40px; color: white; background: #0f0f1a; height: 100vh;"><h1>Loading Cartograph...</h1><p style="color: #888; margin-top: 16px;">If this persists, check console for errors.</p></div>';
    }

    const layerColors = {
      api: '#3b82f6',
      service: '#10b981',
      model: '#f59e0b',
      ui: '#ec4899',
      util: '#8b5cf6',
      test: '#6b7280',
      config: '#06b6d4',
      other: '#4b5563',
    };

    function App() {
      const [nodes, setNodes, onNodesChange] = useNodesState([]);
      const [edges, setEdges, onEdgesChange] = useEdgesState([]);
      const [stats, setStats] = useState({ files: 0, timestamp: null });
      const [connected, setConnected] = useState(false);

      const loadGraph = useCallback(async () => {
        try {
          const res = await fetch('/api/graph');
          const data = await res.json();
          
          // Layout nodes in a grid by layer
          const layerGroups = {};
          data.nodes.forEach(n => {
            if (!layerGroups[n.layer]) layerGroups[n.layer] = [];
            layerGroups[n.layer].push(n);
          });

          let yOffset = 0;
          const layoutNodes = [];
          Object.entries(layerGroups).forEach(([layer, layerNodes]) => {
            layerNodes.forEach((n, i) => {
              layoutNodes.push({
                id: n.id,
                position: { x: (i % 6) * 200, y: yOffset + Math.floor(i / 6) * 60 },
                data: { label: n.label },
                className: layer,
              });
            });
            yOffset += Math.ceil(layerNodes.length / 6) * 60 + 80;
          });

          const flowEdges = data.edges.map((e, i) => ({
            id: \`e\${i}\`,
            source: e.source,
            target: e.target,
            animated: true,
          }));

          setNodes(layoutNodes);
          setEdges(flowEdges);
          setStats({ files: data.nodes.length, timestamp: data.timestamp });
        } catch (err) {
          console.error('Failed to load graph:', err);
        }
      }, []);

      useEffect(() => {
        loadGraph();

        // WebSocket for live updates
        const ws = new WebSocket(\`ws://\${window.location.host}/ws\`);
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'update') {
            loadGraph();
          }
        };

        return () => ws.close();
      }, [loadGraph]);

      if (!ReactFlow) return null;

      return (
        <>
          <div className="header">
            <h1>Cartograph</h1>
            <span className="status">{connected ? '● Live' : '○ Disconnected'}</span>
            <span className="stats">
              {stats.files} files • Updated {stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'never'}
            </span>
          </div>
          <div className="flow-container">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              minZoom={0.1}
              maxZoom={2}
            >
              <Background color="#333" gap={20} />
              <Controls />
              <MiniMap 
                nodeColor={(n) => layerColors[n.className] || '#4b5563'}
                style={{ background: '#1a1a2e' }}
              />
            </ReactFlow>
          </div>
          <div className="legend">
            {Object.entries(layerColors).map(([layer, color]) => (
              <div key={layer} className="legend-item">
                <div className="legend-dot" style={{ background: color }} />
                <span>{layer}</span>
              </div>
            ))}
          </div>
        </>
      );
    }

    // Load ReactFlow then render
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@xyflow/react@12/dist/umd/index.js';
    script.onload = () => {
      window.ReactFlowNS = window['@xyflow/react'];
      ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    };
    document.body.appendChild(script);
  </script>
</body>
</html>`
  }
}
