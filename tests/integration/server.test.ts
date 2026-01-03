import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test"
import { CartographServer } from "../../src/server"
import { join } from "path"
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises"
import { tmpdir } from "os"

describe("CartographServer", () => {
  let server: CartographServer | null = null
  let tempDir: string
  let architectureDir: string
  const TEST_PORT = 13333

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cartograph-test-"))
    architectureDir = join(tempDir, ".architecture")
    await mkdir(architectureDir, { recursive: true })
  })

  afterAll(async () => {
    server?.stop()
    await rm(tempDir, { recursive: true, force: true })
  })

  afterEach(() => {
    server?.stop()
    server = null
  })

  async function startServer(port = TEST_PORT): Promise<CartographServer> {
    const s = new CartographServer(port, architectureDir)
    await s.start()
    server = s
    return s
  }

  describe("HTTP endpoints", () => {
    test("GET / returns HTML", async () => {
      await startServer()
      const response = await fetch(`http://localhost:${TEST_PORT}/`)
      expect(response.status).toBe(200)
      const contentType = response.headers.get("Content-Type")
      expect(contentType).toContain("text/html")
    })

    test("GET /api/diagrams returns empty diagrams when no file exists", async () => {
      await startServer(TEST_PORT + 1)
      const response = await fetch(`http://localhost:${TEST_PORT + 1}/api/diagrams`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty("diagrams")
      expect(data.diagrams).toEqual([])
    })

    test("GET /api/diagrams returns diagrams from file", async () => {
      const diagramData = {
        generated: "2024-01-01T00:00:00.000Z",
        hash: "test123",
        diagrams: [
          { id: "test", category: "architecture", title: "Test", description: "Test diagram", mermaid: "graph TD", labels: [], priority: 100 }
        ],
        summary: "1 diagram"
      }
      await writeFile(join(architectureDir, "diagrams.json"), JSON.stringify(diagramData))
      
      await startServer(TEST_PORT + 2)
      const response = await fetch(`http://localhost:${TEST_PORT + 2}/api/diagrams`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.diagrams).toHaveLength(1)
      expect(data.diagrams[0].id).toBe("test")
    })

    test("GET /api/graph returns empty graph when no analysis exists", async () => {
      await startServer(TEST_PORT + 3)
      const response = await fetch(`http://localhost:${TEST_PORT + 3}/api/graph`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty("nodes")
      expect(data).toHaveProperty("edges")
      expect(data.nodes).toEqual([])
    })

    test("GET /api/graph returns graph from analysis file", async () => {
      const analysisData = {
        files: [
          { path: "src/index.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: ["main"], classes: [] }
        ],
        layers: { api: 1 },
        domains: [],
        timestamp: "2024-01-01T00:00:00.000Z"
      }
      await writeFile(join(architectureDir, "analysis.json"), JSON.stringify(analysisData))
      
      await startServer(TEST_PORT + 4)
      const response = await fetch(`http://localhost:${TEST_PORT + 4}/api/graph`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].path).toBe("src/index.ts")
    })

    test("GET /api/story returns story structure", async () => {
      const analysisData = {
        files: [{ path: "a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] }],
        layers: { api: 1 },
        domains: [{ name: "core", fileCount: 1, layer: "api" }],
        timestamp: "2024-01-01T00:00:00.000Z"
      }
      await writeFile(join(architectureDir, "analysis.json"), JSON.stringify(analysisData))
      
      await startServer(TEST_PORT + 5)
      const response = await fetch(`http://localhost:${TEST_PORT + 5}/api/story`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty("title")
      expect(data).toHaveProperty("summary")
      expect(data).toHaveProperty("stats")
      expect(data).toHaveProperty("domains")
      expect(data).toHaveProperty("layers")
    })

    test("returns CORS headers", async () => {
      await startServer(TEST_PORT + 6)
      const response = await fetch(`http://localhost:${TEST_PORT + 6}/api/diagrams`)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    })
  })

  describe("WebSocket", () => {
    test("accepts WebSocket connections on /ws", async () => {
      await startServer(TEST_PORT + 7)
      const ws = new WebSocket(`ws://localhost:${TEST_PORT + 7}/ws`)
      
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          expect(ws.readyState).toBe(WebSocket.OPEN)
          ws.close()
          resolve()
        }
        ws.onerror = reject
        setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000)
      })
    })

    test("broadcast sends message to all connected clients", async () => {
      const s = await startServer(TEST_PORT + 8)
      const ws1 = new WebSocket(`ws://localhost:${TEST_PORT + 8}/ws`)
      const ws2 = new WebSocket(`ws://localhost:${TEST_PORT + 8}/ws`)
      
      const messages1: string[] = []
      const messages2: string[] = []
      
      await Promise.all([
        new Promise<void>((resolve) => { ws1.onopen = () => resolve() }),
        new Promise<void>((resolve) => { ws2.onopen = () => resolve() }),
      ])
      
      ws1.onmessage = (e) => messages1.push(e.data)
      ws2.onmessage = (e) => messages2.push(e.data)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      s.broadcast(JSON.stringify({ type: "test", data: "hello" }))
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(messages1).toHaveLength(1)
      expect(messages2).toHaveLength(1)
      expect(JSON.parse(messages1[0]).type).toBe("test")
      
      ws1.close()
      ws2.close()
    })
  })

  describe("stop", () => {
    test("stops server cleanly", async () => {
      const testPort = TEST_PORT + 9
      const testServer = new CartographServer(testPort, architectureDir)
      await testServer.start()
      
      const response1 = await fetch(`http://localhost:${testPort}/`)
      expect(response1.status).toBe(200)
      
      testServer.stop()
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        await fetch(`http://localhost:${testPort}/`)
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })
})

describe("CartographServer graph aggregation", () => {
  let server: CartographServer | null = null
  let tempDir: string
  let architectureDir: string
  const TEST_PORT = 13350

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cartograph-test-agg-"))
    architectureDir = join(tempDir, ".architecture")
    await mkdir(architectureDir, { recursive: true })
    
    server = new CartographServer(TEST_PORT, architectureDir)
    await server.start()
  })

  afterAll(async () => {
    server?.stop()
    await rm(tempDir, { recursive: true, force: true })
  })

  test("aggregates large file sets by directory", async () => {
    const files = Array.from({ length: 250 }, (_, i) => ({
      path: `src/module${Math.floor(i / 10)}/file${i}.ts`,
      language: "typescript",
      layer: "service",
      imports: [],
      exports: [],
      functions: [`func${i}`],
      classes: [],
    }))
    
    const analysisData = {
      files,
      layers: { service: 250 },
      domains: [],
      timestamp: "2024-01-01T00:00:00.000Z"
    }
    await writeFile(join(architectureDir, "analysis.json"), JSON.stringify(analysisData))
    
    const response = await fetch(`http://localhost:${TEST_PORT}/api/graph`)
    const data = await response.json()
    
    expect(data.nodes.length).toBeLessThan(250)
    expect(data.nodes.some((n: any) => n.label.includes("("))).toBe(true)
  })
})
