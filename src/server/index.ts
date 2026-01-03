import { readFile, stat } from "fs/promises"
import { join, extname } from "path"
import type { Server, ServerWebSocket } from "bun"
import { log } from "../logger"

interface WebSocketData {
  id: string
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
}

export class CartographServer {
  private server: Server | null = null
  private clients = new Set<ServerWebSocket<WebSocketData>>()
  private webDistDir: string

  constructor(
    private port: number,
    private architectureDir: string
  ) {
    const dir = import.meta.dir
    this.webDistDir = dir.includes("/dist") 
      ? join(dir, "web")
      : join(dir, "../../dist/web")
  }

  async start(): Promise<void> {
    const self = this

    this.server = Bun.serve<WebSocketData>({
      port: this.port,

      async fetch(req, server) {
        const url = new URL(req.url)
        const path = url.pathname

        if (path === "/ws") {
          const upgraded = server.upgrade(req, { data: { id: crypto.randomUUID() } })
          return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 })
        }

        if (path === "/api/diagrams") {
          try {
            const data = await readFile(join(self.architectureDir, "diagrams.json"), "utf-8")
            return new Response(data, {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          } catch {
            return new Response(JSON.stringify({ generated: "", hash: "", diagrams: [], summary: "" }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          }
        }

        if (path === "/api/graph") {
          try {
            const raw = await readFile(join(self.architectureDir, "analysis.json"), "utf-8")
            const analysis = JSON.parse(raw)
            const graphData = self.transformToGraph(analysis)
            return new Response(JSON.stringify(graphData), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          } catch {
            return new Response(JSON.stringify({ nodes: [], edges: [], timestamp: new Date().toISOString() }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          }
        }

        if (path === "/api/story") {
          try {
            const raw = await readFile(join(self.architectureDir, "analysis.json"), "utf-8")
            const analysis = JSON.parse(raw)
            const story = self.transformToStory(analysis)
            return new Response(JSON.stringify(story), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          } catch {
            return new Response(JSON.stringify({ title: "Codebase", summary: "Analysis pending...", generated: new Date().toISOString(), stats: { totalFiles: 0, domains: 0, entryPoints: 0, flows: 0 }, domains: [], flows: [], layers: [], systemDiagram: "", layerDiagram: "" }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            })
          }
        }

        const staticResponse = await self.serveStatic(path)
        if (staticResponse) return staticResponse

        if (path === "/" || !path.includes(".")) {
          const indexResponse = await self.serveStatic("/index.html")
          if (indexResponse) return indexResponse
        }

        return new Response(self.getFallbackHtml(), {
          headers: { "Content-Type": "text/html" },
        })
      },

      websocket: {
        open(ws) {
          self.clients.add(ws)
        },
        close(ws) {
          self.clients.delete(ws)
        },
        message() {},
      },
    })
  }

  private async serveStatic(path: string): Promise<Response | null> {
    try {
      const filePath = join(this.webDistDir, path === "/" ? "index.html" : path)
      await stat(filePath)
      const content = await readFile(filePath)
      const ext = extname(filePath)
      return new Response(content, {
        headers: { 
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
        },
      })
    } catch {
      return null
    }
  }

  stop(): void {
    this.server?.stop(true)
    this.server = null
  }

  broadcast(message: string): void {
    for (const client of this.clients) {
      client.send(message)
    }
  }

  private transformToGraph(analysis: any): { nodes: any[], edges: any[], timestamp: string } {
    const files = analysis.files || []
    const MAX_NODES = 200
    
    if (files.length > MAX_NODES) {
      return this.aggregateByDirectory(files, analysis.timestamp)
    }

    const nodes = files.map((f: any) => ({
      id: f.path,
      label: f.path.split("/").pop() || f.path,
      path: f.path,
      layer: f.layer || "other",
      functions: f.functions?.length || 0,
      classes: f.classes?.length || 0,
      exports: f.exports?.length || 0,
    }))

    const edges: any[] = []
    const fileSet = new Set(nodes.map((n: any) => n.id))
    
    for (const file of files) {
      for (const imp of file.imports || []) {
        if (fileSet.has(imp)) {
          edges.push({ source: file.path, target: imp, type: "imports" })
        }
      }
    }

    return { nodes, edges, timestamp: analysis.timestamp || new Date().toISOString() }
  }

  private aggregateByDirectory(files: any[], timestamp: string): { nodes: any[], edges: any[], timestamp: string } {
    const dirMap = new Map<string, { files: number, functions: number, classes: number, layers: Record<string, number> }>()
    
    for (const f of files) {
      const parts = f.path.split("/")
      const depth = parts.length > 2 ? 2 : 1
      const dirKey = parts.slice(0, depth).join("/")
      
      const existing = dirMap.get(dirKey) || { files: 0, functions: 0, classes: 0, layers: {} }
      existing.files++
      existing.functions += f.functions?.length || 0
      existing.classes += f.classes?.length || 0
      const layer = f.layer || "other"
      existing.layers[layer] = (existing.layers[layer] || 0) + 1
      dirMap.set(dirKey, existing)
    }

    const nodes = Array.from(dirMap.entries()).map(([dir, data]) => {
      const dominantLayer = Object.entries(data.layers).sort((a, b) => b[1] - a[1])[0]?.[0] || "other"
      return {
        id: dir,
        label: `${dir} (${data.files})`,
        path: dir,
        layer: dominantLayer,
        functions: data.functions,
        classes: data.classes,
        exports: data.files,
      }
    })

    return { nodes, edges: [], timestamp: timestamp || new Date().toISOString() }
  }

  private transformToStory(analysis: any): any {
    const layers = Object.entries(analysis.layers || {}).map(([name, count]) => ({
      name,
      description: `${count} files`,
      fileCount: count as number,
      keyComponents: [],
      mermaid: "",
    }))

    const domains = (analysis.domains || []).map((d: any) => ({
      name: d.name,
      description: `${d.fileCount} files in ${d.layer} layer`,
      layer: d.layer,
      keyClasses: [],
      keyFunctions: [],
      files: [],
    }))

    return {
      title: "Codebase Architecture",
      summary: `${analysis.files?.length || 0} files analyzed across ${Object.keys(analysis.layers || {}).length} layers`,
      generated: analysis.timestamp || new Date().toISOString(),
      stats: {
        totalFiles: analysis.files?.length || 0,
        domains: domains.length,
        entryPoints: 0,
        flows: 0,
      },
      domains,
      flows: [],
      layers,
      systemDiagram: "",
      layerDiagram: "",
    }
  }

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cartograph</title>
  <style>
    body { font-family: system-ui; background: #0f0f1a; color: #e0e0e0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .container { text-align: center; }
    h1 { margin-bottom: 16px; }
    p { color: #888; }
    code { background: #1a1a2e; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cartograph</h1>
    <p>Web UI not built. Run:</p>
    <code>cd web && npm run build</code>
  </div>
</body>
</html>`
  }
}
