import { readFile, stat } from "fs/promises"
import { join, extname } from "path"
import type { CodebaseAnalysis } from "../analyzer/treesitter"
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
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
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
    let retries = 5
    const delay = 500

    while (retries > 0) {
      try {
        this.server = Bun.serve<WebSocketData>({
          port: this.port,

          async fetch(req, server) {
            const url = new URL(req.url)
            const path = url.pathname

            if (path === "/ws") {
              const upgraded = server.upgrade(req, {
                data: { id: crypto.randomUUID() },
              })
              return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 })
            }

            if (path === "/api/graph") {
              try {
                const data = await readFile(join(self.architectureDir, "graph.json"), "utf-8")
                return new Response(data, {
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                })
              } catch {
                return new Response(JSON.stringify({ nodes: [], edges: [] }), {
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                })
              }
            }

            if (path === "/api/manifest") {
              try {
                const data = await readFile(join(self.architectureDir, "manifest.json"), "utf-8")
                return new Response(data, {
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                })
              } catch {
                return new Response("{}", {
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                })
              }
            }

            if (path.startsWith("/api/maps/")) {
              const file = path.replace("/api/maps/", "")
              try {
                const data = await readFile(join(self.architectureDir, "maps", file), "utf-8")
                return new Response(data, {
                  headers: { "Content-Type": "text/markdown", "Access-Control-Allow-Origin": "*" },
                })
              } catch {
                return new Response("Not found", { status: 404 })
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
              log(`Client connected (${self.clients.size} total)`)
            },
            close(ws) {
              self.clients.delete(ws)
              log(`Client disconnected (${self.clients.size} total)`)
            },
            message() {},
          },
        })
        
        return
      } catch (err: any) {
        if (err.message?.includes("Address in use") || err.code === "EADDRINUSE") {
          log(`Port ${this.port} busy, retrying in ${delay}ms... (${retries} left)`)
          retries--
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          throw err
        }
      }
    }

    throw new Error(`[cartograph] Failed to start server on port ${this.port} after multiple retries`)
  }

  private async serveStatic(path: string): Promise<Response | null> {
    try {
      const filePath = join(this.webDistDir, path === "/" ? "index.html" : path)
      await stat(filePath)
      
      const content = await readFile(filePath)
      const ext = extname(filePath)
      const contentType = MIME_TYPES[ext] || "application/octet-stream"
      
      return new Response(content, {
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
        },
      })
    } catch {
      return null
    }
  }

  stop(): void {
    if (this.server) {
      this.server.stop(true)
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

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cartograph</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f1a; color: #e0e0e0; height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .container { text-align: center; max-width: 400px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #888; margin-bottom: 24px; line-height: 1.6; }
    code { background: #1a1a2e; padding: 12px 16px; border-radius: 8px; display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cartograph</h1>
    <p>Web UI not built yet. Run the following to build:</p>
    <code>cd web && npm install && npm run build</code>
  </div>
</body>
</html>`
  }
}
