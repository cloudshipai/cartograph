import { describe, test, expect } from "bun:test"
import {
  mapTypeToCategory,
  generateDiagramsFromAnalysis,
  buildDiagramContext,
  createDiagramRecord,
  mergeDiagrams,
  DIAGRAM_TYPES,
  type AnalysisResult,
  type DiagramSet,
  type DiagramRecord,
} from "../../src/diagrams"

describe("mapTypeToCategory", () => {
  test("maps architecture to architecture", () => {
    expect(mapTypeToCategory("architecture")).toBe("architecture")
  })

  test("maps dataflow to flows", () => {
    expect(mapTypeToCategory("dataflow")).toBe("flows")
  })

  test("maps sequence to flows", () => {
    expect(mapTypeToCategory("sequence")).toBe("flows")
  })

  test("maps class to patterns", () => {
    expect(mapTypeToCategory("class")).toBe("patterns")
  })

  test("maps dependency to dependencies", () => {
    expect(mapTypeToCategory("dependency")).toBe("dependencies")
  })

  test("maps er to patterns", () => {
    expect(mapTypeToCategory("er")).toBe("patterns")
  })

  test("maps state to flows", () => {
    expect(mapTypeToCategory("state")).toBe("flows")
  })
})

describe("DIAGRAM_TYPES", () => {
  test("has all 7 diagram types", () => {
    const types = Object.keys(DIAGRAM_TYPES)
    expect(types).toHaveLength(7)
    expect(types).toContain("architecture")
    expect(types).toContain("dataflow")
    expect(types).toContain("sequence")
    expect(types).toContain("class")
    expect(types).toContain("dependency")
    expect(types).toContain("er")
    expect(types).toContain("state")
  })

  test("each type has label and prompt", () => {
    for (const [key, value] of Object.entries(DIAGRAM_TYPES)) {
      expect(value.label).toBeDefined()
      expect(value.label.length).toBeGreaterThan(0)
      expect(value.prompt).toBeDefined()
      expect(value.prompt.length).toBeGreaterThan(0)
    }
  })
})

describe("generateDiagramsFromAnalysis", () => {
  const createMockAnalysis = (overrides?: Partial<AnalysisResult>): AnalysisResult => ({
    files: [
      { path: "src/api/routes.ts", language: "typescript", layer: "api", imports: [], exports: ["router"], functions: ["handleRequest"], classes: [] },
      { path: "src/services/user.ts", language: "typescript", layer: "service", imports: ["./model"], exports: ["UserService"], functions: [], classes: ["UserService"] },
      { path: "src/models/user.ts", language: "typescript", layer: "model", imports: [], exports: ["User"], functions: [], classes: ["User"] },
    ],
    layers: { api: 1, service: 1, model: 1 },
    domains: [{ name: "users", fileCount: 3, layer: "service" }],
    timestamp: "2024-01-01T00:00:00.000Z",
    ...overrides,
  })

  test("generates layer-overview diagram when layers exist", () => {
    const analysis = createMockAnalysis()
    const diagrams = generateDiagramsFromAnalysis(analysis)
    
    const layerOverview = diagrams.find(d => d.id === "layer-overview")
    expect(layerOverview).toBeDefined()
    expect(layerOverview!.category).toBe("layers")
    expect(layerOverview!.title).toBe("Layer Architecture")
    expect(layerOverview!.mermaid).toContain("graph TD")
    expect(layerOverview!.labels).toContain("auto")
    expect(layerOverview!.priority).toBe(100)
  })

  test("generates domain-overview diagram when domains exist", () => {
    const analysis = createMockAnalysis()
    const diagrams = generateDiagramsFromAnalysis(analysis)
    
    const domainOverview = diagrams.find(d => d.id === "domain-overview")
    expect(domainOverview).toBeDefined()
    expect(domainOverview!.category).toBe("domains")
    expect(domainOverview!.title).toBe("Domain Structure")
    expect(domainOverview!.mermaid).toContain("graph LR")
    expect(domainOverview!.priority).toBe(90)
  })

  test("returns empty array for empty analysis", () => {
    const analysis: AnalysisResult = {
      files: [],
      layers: {},
      domains: [],
      timestamp: "2024-01-01T00:00:00.000Z",
    }
    const diagrams = generateDiagramsFromAnalysis(analysis)
    expect(diagrams).toHaveLength(0)
  })

  test("includes layer icons in mermaid output", () => {
    const analysis = createMockAnalysis()
    const diagrams = generateDiagramsFromAnalysis(analysis)
    const layerOverview = diagrams.find(d => d.id === "layer-overview")
    
    expect(layerOverview!.mermaid).toMatch(/🌐|⚙️|📊/)
  })

  test("includes layer colors in mermaid output", () => {
    const analysis = createMockAnalysis()
    const diagrams = generateDiagramsFromAnalysis(analysis)
    const layerOverview = diagrams.find(d => d.id === "layer-overview")
    
    expect(layerOverview!.mermaid).toContain("style")
    expect(layerOverview!.mermaid).toContain("fill:")
  })

  test("generates layer-dependencies diagram when cross-layer imports exist", () => {
    const analysis = createMockAnalysis({
      files: [
        { path: "src/services/user.ts", language: "typescript", layer: "service", imports: ["./model"], exports: [], functions: [], classes: [] },
        { path: "src/model.ts", language: "typescript", layer: "model", imports: [], exports: [], functions: [], classes: [] },
      ],
      layers: { service: 1, model: 1 },
    })
    const diagrams = generateDiagramsFromAnalysis(analysis)
    
    const depDiagram = diagrams.find(d => d.id === "layer-dependencies")
    expect(depDiagram).toBeDefined()
    expect(depDiagram!.category).toBe("dependencies")
    expect(depDiagram!.priority).toBe(80)
  })

  test("handles multiple domains correctly", () => {
    const analysis = createMockAnalysis({
      domains: [
        { name: "auth", fileCount: 10, layer: "service" },
        { name: "users", fileCount: 8, layer: "model" },
        { name: "api", fileCount: 5, layer: "api" },
      ],
    })
    const diagrams = generateDiagramsFromAnalysis(analysis)
    const domainOverview = diagrams.find(d => d.id === "domain-overview")
    
    expect(domainOverview!.mermaid).toContain("auth")
    expect(domainOverview!.mermaid).toContain("users")
    expect(domainOverview!.mermaid).toContain("api")
  })
})

describe("buildDiagramContext", () => {
  test("returns empty string when no analysis or diagrams", () => {
    const context = buildDiagramContext(null, null)
    expect(context).toBe("")
  })

  test("includes analysis info when available", () => {
    const analysis: AnalysisResult = {
      files: [
        { path: "a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] },
        { path: "b.ts", language: "typescript", layer: "service", imports: [], exports: [], functions: [], classes: [] },
      ],
      layers: { api: 1, service: 1 },
      domains: [{ name: "core", fileCount: 2, layer: "service" }],
      timestamp: "2024-01-01T00:00:00.000Z",
    }
    const context = buildDiagramContext(analysis, null)
    
    expect(context).toContain("## Codebase Analysis")
    expect(context).toContain("2 files")
    expect(context).toContain("api(1)")
    expect(context).toContain("service(1)")
    expect(context).toContain("core")
  })

  test("includes diagram info when available", () => {
    const diagrams: DiagramSet = {
      generated: "2024-01-01T00:00:00.000Z",
      hash: "abc123",
      diagrams: [
        { id: "arch", category: "architecture", title: "Architecture", description: "Main arch", mermaid: "graph TD", labels: [], priority: 100 },
      ],
      summary: "1 diagram",
    }
    const context = buildDiagramContext(null, diagrams)
    
    expect(context).toContain("## Current Diagrams")
    expect(context).toContain("Architecture")
    expect(context).toContain("Main arch")
  })

  test("includes both analysis and diagrams when both available", () => {
    const analysis: AnalysisResult = {
      files: [{ path: "a.ts", language: "typescript", layer: "api", imports: [], exports: [], functions: [], classes: [] }],
      layers: { api: 1 },
      domains: [],
      timestamp: "2024-01-01T00:00:00.000Z",
    }
    const diagrams: DiagramSet = {
      generated: "2024-01-01T00:00:00.000Z",
      hash: "abc123",
      diagrams: [{ id: "arch", category: "architecture", title: "Architecture", description: "Main", mermaid: "graph TD", labels: [], priority: 100 }],
      summary: "1 diagram",
    }
    const context = buildDiagramContext(analysis, diagrams)
    
    expect(context).toContain("## Codebase Analysis")
    expect(context).toContain("## Current Diagrams")
  })

  test("limits domains to first 5", () => {
    const analysis: AnalysisResult = {
      files: [],
      layers: {},
      domains: Array.from({ length: 10 }, (_, i) => ({ name: `domain${i}`, fileCount: 1, layer: "other" })),
      timestamp: "2024-01-01T00:00:00.000Z",
    }
    const context = buildDiagramContext(analysis, null)
    
    expect(context).toContain("domain0")
    expect(context).toContain("domain4")
    expect(context).not.toContain("domain5")
  })

  test("limits diagrams to first 5", () => {
    const diagrams: DiagramSet = {
      generated: "2024-01-01T00:00:00.000Z",
      hash: "abc123",
      diagrams: Array.from({ length: 10 }, (_, i) => ({
        id: `diag${i}`,
        category: "architecture",
        title: `Diagram ${i}`,
        description: `Desc ${i}`,
        mermaid: "graph TD",
        labels: [],
        priority: 100 - i,
      })),
      summary: "10 diagrams",
    }
    const context = buildDiagramContext(null, diagrams)
    
    expect(context).toContain("Diagram 0")
    expect(context).toContain("Diagram 4")
    expect(context).not.toContain("Diagram 5")
  })
})

describe("createDiagramRecord", () => {
  test("creates architecture diagram with correct priority", () => {
    const record = createDiagramRecord("architecture", "flowchart TD\n  A --> B")
    
    expect(record.id).toBe("architecture")
    expect(record.category).toBe("architecture")
    expect(record.title).toBe("Architecture Overview")
    expect(record.priority).toBe(95)
    expect(record.labels).toContain("architecture")
    expect(record.labels).toContain("generated")
  })

  test("creates dataflow diagram with correct priority", () => {
    const record = createDiagramRecord("dataflow", "flowchart LR\n  A --> B")
    
    expect(record.id).toBe("dataflow")
    expect(record.category).toBe("flows")
    expect(record.priority).toBe(90)
  })

  test("creates sequence diagram with lower priority", () => {
    const record = createDiagramRecord("sequence", "sequenceDiagram\n  A->>B: msg")
    
    expect(record.id).toBe("sequence")
    expect(record.category).toBe("flows")
    expect(record.priority).toBe(75)
  })

  test("uses custom description when provided", () => {
    const record = createDiagramRecord("architecture", "graph TD", "Custom description")
    expect(record.description).toBe("Custom description")
  })

  test("uses default description when not provided", () => {
    const record = createDiagramRecord("sequence", "sequenceDiagram")
    expect(record.description).toBe("Generated sequence diagram")
  })
})

describe("mergeDiagrams", () => {
  const existingDiagrams: DiagramRecord[] = [
    { id: "architecture", category: "architecture", title: "Arch", description: "Old", mermaid: "old", labels: [], priority: 95 },
    { id: "sequence", category: "flows", title: "Seq", description: "Seq desc", mermaid: "seq", labels: [], priority: 75 },
  ]

  test("replaces diagram with same id", () => {
    const newDiagram: DiagramRecord = {
      id: "architecture",
      category: "architecture",
      title: "New Arch",
      description: "New",
      mermaid: "new",
      labels: ["updated"],
      priority: 95,
    }
    
    const merged = mergeDiagrams(newDiagram, existingDiagrams)
    
    expect(merged).toHaveLength(2)
    expect(merged[0].id).toBe("architecture")
    expect(merged[0].description).toBe("New")
    expect(merged[0].mermaid).toBe("new")
  })

  test("adds new diagram when id doesn't exist", () => {
    const newDiagram: DiagramRecord = {
      id: "class",
      category: "patterns",
      title: "Class",
      description: "Class diagram",
      mermaid: "class",
      labels: [],
      priority: 75,
    }
    
    const merged = mergeDiagrams(newDiagram, existingDiagrams)
    
    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe("class")
  })

  test("new diagram is always first in merged array", () => {
    const newDiagram: DiagramRecord = {
      id: "dataflow",
      category: "flows",
      title: "Data",
      description: "Data flow",
      mermaid: "data",
      labels: [],
      priority: 90,
    }
    
    const merged = mergeDiagrams(newDiagram, existingDiagrams)
    
    expect(merged[0].id).toBe("dataflow")
  })

  test("handles empty existing diagrams", () => {
    const newDiagram: DiagramRecord = {
      id: "architecture",
      category: "architecture",
      title: "Arch",
      description: "First",
      mermaid: "first",
      labels: [],
      priority: 95,
    }
    
    const merged = mergeDiagrams(newDiagram, [])
    
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe("architecture")
  })
})
