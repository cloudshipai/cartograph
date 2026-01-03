import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { join } from "path"
import { mkdtemp, rm, writeFile, mkdir, readFile } from "fs/promises"
import { tmpdir } from "os"
import {
  DIAGRAM_TYPES,
  generateDiagramsFromAnalysis,
  createDiagramRecord,
  mergeDiagrams,
  type DiagramRecord,
  type DiagramSet,
  type AnalysisResult,
} from "../../src/diagrams"

describe("Plugin Tools Integration", () => {
  let tempDir: string
  let architectureDir: string
  let currentDiagrams: DiagramSet | null = null
  let lastAnalysis: AnalysisResult | null = null

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cartograph-tools-test-"))
    architectureDir = join(tempDir, ".architecture")
    await mkdir(architectureDir, { recursive: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    currentDiagrams = null
    lastAnalysis = null
  })

  async function saveDiagrams(diagrams: DiagramRecord[], reason: string): Promise<void> {
    const diagramSet: DiagramSet = {
      generated: new Date().toISOString(),
      hash: Date.now().toString(36),
      diagrams: diagrams.sort((a, b) => b.priority - a.priority),
      summary: `${diagrams.length} diagrams`,
      ...(reason === "compaction" ? { lastCompactionUpdate: new Date().toISOString() } : {}),
    }
    
    currentDiagrams = diagramSet
    const diagramsPath = join(architectureDir, "diagrams.json")
    await writeFile(diagramsPath, JSON.stringify(diagramSet, null, 2))
  }

  async function loadDiagrams(): Promise<DiagramSet | null> {
    try {
      const diagramsPath = join(architectureDir, "diagrams.json")
      const content = await readFile(diagramsPath, "utf-8")
      return JSON.parse(content) as DiagramSet
    } catch {
      return null
    }
  }

  describe("diagram_types tool", () => {
    async function executeDiagramTypes() {
      const types = Object.entries(DIAGRAM_TYPES).map(([key, cfg]) => ({
        type: key,
        label: cfg.label,
      }))
      return JSON.stringify({ 
        types,
        currentDiagrams: currentDiagrams?.diagrams.map(d => ({
          id: d.id,
          title: d.title,
          isAuto: d.labels.includes("auto"),
        })) || [],
        viewUrl: `http://localhost:3333`,
        analysisReady: !!lastAnalysis,
      })
    }

    test("returns all diagram types", async () => {
      const result = JSON.parse(await executeDiagramTypes())
      
      expect(result.types).toHaveLength(7)
      expect(result.types.map((t: any) => t.type)).toContain("architecture")
      expect(result.types.map((t: any) => t.type)).toContain("sequence")
    })

    test("returns current diagrams when available", async () => {
      currentDiagrams = {
        generated: new Date().toISOString(),
        hash: "abc",
        diagrams: [
          { id: "test", category: "architecture", title: "Test", description: "", mermaid: "", labels: ["auto"], priority: 100 }
        ],
        summary: "1 diagram"
      }
      
      const result = JSON.parse(await executeDiagramTypes())
      
      expect(result.currentDiagrams).toHaveLength(1)
      expect(result.currentDiagrams[0].id).toBe("test")
      expect(result.currentDiagrams[0].isAuto).toBe(true)
    })

    test("returns analysisReady status", async () => {
      let result = JSON.parse(await executeDiagramTypes())
      expect(result.analysisReady).toBe(false)
      
      lastAnalysis = { files: [], layers: {}, domains: [], timestamp: "" }
      result = JSON.parse(await executeDiagramTypes())
      expect(result.analysisReady).toBe(true)
    })
  })

  describe("diagram_context tool", () => {
    async function executeDiagramContext() {
      return JSON.stringify({
        analysis: lastAnalysis ? {
          fileCount: lastAnalysis.files.length,
          layers: lastAnalysis.layers,
          topDomains: lastAnalysis.domains.slice(0, 10),
          languages: [...new Set(lastAnalysis.files.map(f => f.language))],
        } : null,
        currentDiagrams: currentDiagrams?.diagrams.map(d => ({
          id: d.id,
          title: d.title,
          category: d.category,
          isAuto: d.labels.includes("auto"),
        })) || [],
        viewUrl: `http://localhost:3333`,
      })
    }

    test("returns null analysis when not available", async () => {
      const result = JSON.parse(await executeDiagramContext())
      expect(result.analysis).toBeNull()
    })

    test("returns analysis summary when available", async () => {
      lastAnalysis = {
        files: [
          { path: "a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] },
          { path: "b.py", language: "python", layer: "service", imports: [], exports: [], functions: [], classes: [] },
        ],
        layers: { api: 1, service: 1 },
        domains: [{ name: "auth", fileCount: 2, layer: "service" }],
        timestamp: ""
      }
      
      const result = JSON.parse(await executeDiagramContext())
      
      expect(result.analysis.fileCount).toBe(2)
      expect(result.analysis.layers).toEqual({ api: 1, service: 1 })
      expect(result.analysis.topDomains).toHaveLength(1)
      expect(result.analysis.languages).toContain("typescript")
      expect(result.analysis.languages).toContain("python")
    })
  })

  describe("diagram_update tool", () => {
    async function executeDiagramUpdate(
      type: keyof typeof DIAGRAM_TYPES,
      mermaid: string,
      description?: string
    ) {
      const newDiagram = createDiagramRecord(type, mermaid, description)
      const existingDiagrams = currentDiagrams?.diagrams || []
      const merged = mergeDiagrams(newDiagram, existingDiagrams)
      
      await saveDiagrams(merged, "update")

      return JSON.stringify({ 
        success: true, 
        type,
        totalDiagrams: merged.length,
        message: `Diagram updated - view at http://localhost:3333`,
      })
    }

    test("creates new diagram", async () => {
      const result = JSON.parse(await executeDiagramUpdate(
        "architecture",
        "flowchart TD\n  A --> B",
        "Test architecture"
      ))
      
      expect(result.success).toBe(true)
      expect(result.type).toBe("architecture")
      expect(result.totalDiagrams).toBe(1)
      
      const saved = await loadDiagrams()
      expect(saved?.diagrams).toHaveLength(1)
      expect(saved?.diagrams[0].id).toBe("architecture")
    })

    test("updates existing diagram", async () => {
      await executeDiagramUpdate("architecture", "flowchart TD\n  A --> B", "First")
      await executeDiagramUpdate("architecture", "flowchart TD\n  X --> Y", "Updated")
      
      const saved = await loadDiagrams()
      expect(saved?.diagrams).toHaveLength(1)
      expect(saved?.diagrams[0].mermaid).toBe("flowchart TD\n  X --> Y")
      expect(saved?.diagrams[0].description).toBe("Updated")
    })

    test("preserves other diagrams when updating", async () => {
      await executeDiagramUpdate("architecture", "arch mermaid")
      await executeDiagramUpdate("sequence", "sequence mermaid")
      await executeDiagramUpdate("architecture", "updated arch")
      
      const saved = await loadDiagrams()
      expect(saved?.diagrams).toHaveLength(2)
      
      const archDiagram = saved?.diagrams.find(d => d.id === "architecture")
      const seqDiagram = saved?.diagrams.find(d => d.id === "sequence")
      
      expect(archDiagram?.mermaid).toBe("updated arch")
      expect(seqDiagram?.mermaid).toBe("sequence mermaid")
    })

    test("assigns correct priorities", async () => {
      await executeDiagramUpdate("architecture", "arch")
      await executeDiagramUpdate("dataflow", "data")
      await executeDiagramUpdate("sequence", "seq")
      
      const saved = await loadDiagrams()
      
      expect(saved?.diagrams[0].id).toBe("architecture")
      expect(saved?.diagrams[1].id).toBe("dataflow")
      expect(saved?.diagrams[2].id).toBe("sequence")
    })
  })

  describe("diagram_delete tool", () => {
    async function executeDiagramDelete(id: string) {
      const existingDiagrams = currentDiagrams?.diagrams || []
      const filtered = existingDiagrams.filter(d => d.id !== id)
      
      if (filtered.length === existingDiagrams.length) {
        return JSON.stringify({ success: false, error: `Diagram '${id}' not found` })
      }
      
      await saveDiagrams(filtered, "delete")
      return JSON.stringify({ success: true, deleted: id })
    }

    test("deletes existing diagram", async () => {
      currentDiagrams = {
        generated: "",
        hash: "",
        diagrams: [
          { id: "arch", category: "architecture", title: "Arch", description: "", mermaid: "", labels: [], priority: 95 },
          { id: "seq", category: "flows", title: "Seq", description: "", mermaid: "", labels: [], priority: 75 },
        ],
        summary: "2 diagrams"
      }
      
      const result = JSON.parse(await executeDiagramDelete("arch"))
      
      expect(result.success).toBe(true)
      expect(result.deleted).toBe("arch")
      
      const saved = await loadDiagrams()
      expect(saved?.diagrams).toHaveLength(1)
      expect(saved?.diagrams[0].id).toBe("seq")
    })

    test("returns error for non-existent diagram", async () => {
      currentDiagrams = {
        generated: "",
        hash: "",
        diagrams: [],
        summary: "0 diagrams"
      }
      
      const result = JSON.parse(await executeDiagramDelete("nonexistent"))
      
      expect(result.success).toBe(false)
      expect(result.error).toContain("not found")
    })
  })

  describe("Auto-generated diagrams from analysis", () => {
    test("generates layer diagram from analysis", async () => {
      lastAnalysis = {
        files: [
          { path: "api/a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] },
          { path: "service/b.ts", language: "typescript", layer: "service", imports: [], exports: [], functions: [], classes: [] },
        ],
        layers: { api: 1, service: 1 },
        domains: [],
        timestamp: ""
      }
      
      const autoDiagrams = generateDiagramsFromAnalysis(lastAnalysis)
      expect(autoDiagrams.length).toBeGreaterThan(0)
      
      const layerDiagram = autoDiagrams.find(d => d.id === "layer-overview")
      expect(layerDiagram).toBeDefined()
      expect(layerDiagram?.labels).toContain("auto")
    })

    test("merges auto diagrams with manual diagrams", async () => {
      currentDiagrams = {
        generated: "",
        hash: "",
        diagrams: [
          { id: "custom", category: "architecture", title: "Custom", description: "Manual", mermaid: "manual", labels: ["generated"], priority: 100 }
        ],
        summary: "1 diagram"
      }
      
      lastAnalysis = {
        files: [{ path: "a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] }],
        layers: { api: 1 },
        domains: [],
        timestamp: ""
      }
      
      const autoDiagrams = generateDiagramsFromAnalysis(lastAnalysis)
      const existingNonAuto = currentDiagrams.diagrams.filter(d => !d.labels.includes("auto"))
      const merged = [...autoDiagrams, ...existingNonAuto]
      
      expect(merged.some(d => d.id === "custom")).toBe(true)
      expect(merged.some(d => d.id === "layer-overview")).toBe(true)
    })
  })
})
