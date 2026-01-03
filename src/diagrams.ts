export const DIAGRAM_TYPES = {
  architecture: {
    label: "Architecture Overview",
    prompt: `Analyze the codebase structure and generate a Mermaid flowchart showing high-level architecture. Include main components, services, how they connect, and external dependencies. Return ONLY valid Mermaid syntax starting with 'flowchart'. No explanation.`,
  },
  dataflow: {
    label: "Data Flow", 
    prompt: `Analyze the codebase and generate a Mermaid flowchart showing data flow. Include entry points, transformations, storage, and responses. Return ONLY valid Mermaid syntax starting with 'flowchart'. No explanation.`,
  },
  sequence: {
    label: "Key Sequences",
    prompt: `Analyze the codebase and generate a Mermaid sequence diagram for the most important user flow. Return ONLY valid Mermaid syntax starting with 'sequenceDiagram'. No explanation.`,
  },
  class: {
    label: "Class Diagram",
    prompt: `Analyze the codebase and generate a Mermaid class diagram showing key classes/interfaces and relationships. Return ONLY valid Mermaid syntax starting with 'classDiagram'. No explanation.`,
  },
  dependency: {
    label: "Dependencies",
    prompt: `Analyze the codebase and generate a Mermaid flowchart showing module/package dependencies. Return ONLY valid Mermaid syntax starting with 'flowchart'. No explanation.`,
  },
  er: {
    label: "Entity Relationships",
    prompt: `Analyze the codebase and generate a Mermaid ER diagram for data models. Return ONLY valid Mermaid syntax starting with 'erDiagram'. No explanation.`,
  },
  state: {
    label: "State Machine",
    prompt: `Analyze the codebase and generate a Mermaid state diagram for any state machines found. Return ONLY valid Mermaid syntax starting with 'stateDiagram-v2'. No explanation.`,
  },
} as const

export type DiagramType = keyof typeof DIAGRAM_TYPES

export interface DiagramRecord {
  id: string
  category: string
  title: string
  description: string
  mermaid: string
  labels: string[]
  priority: number
}

export interface DiagramSet {
  generated: string
  hash: string
  diagrams: DiagramRecord[]
  summary: string
  lastCompactionUpdate?: string
}

export interface AnalysisResult {
  files: Array<{
    path: string
    language: string
    layer: string
    imports: string[]
    exports: string[]
    functions: string[]
    classes: string[]
  }>
  layers: Record<string, number>
  domains: Array<{ name: string; fileCount: number; layer: string }>
  timestamp: string
}

export type DiagramCategory = "architecture" | "layers" | "flows" | "dependencies" | "patterns" | "domains" | "insights"

export function mapTypeToCategory(type: DiagramType): DiagramCategory {
  const mapping: Record<DiagramType, DiagramCategory> = {
    architecture: "architecture",
    dataflow: "flows",
    sequence: "flows", 
    class: "patterns",
    dependency: "dependencies",
    er: "patterns",
    state: "flows",
  }
  return mapping[type] || "architecture"
}

export function generateDiagramsFromAnalysis(analysis: AnalysisResult): DiagramRecord[] {
  const diagrams: DiagramRecord[] = []

  const layerIcons: Record<string, string> = {
    api: "🌐", service: "⚙️", model: "📊", ui: "🎨", util: "🔧", config: "⚙️", test: "🧪", other: "📁"
  }
  const layerColors: Record<string, string> = {
    api: "#3b82f6", service: "#10b981", model: "#f59e0b", ui: "#8b5cf6", util: "#6b7280"
  }

  const layerOrder = ["api", "service", "model", "ui", "util", "config", "test", "other"]
  const sortedLayers = Object.entries(analysis.layers)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => layerOrder.indexOf(a[0]) - layerOrder.indexOf(b[0]))

  if (sortedLayers.length > 0) {
    let mermaid = "graph TD\n"
    const ids: string[] = []
    
    for (const [layer, count] of sortedLayers) {
      const id = layer.charAt(0).toUpperCase() + layer.slice(1)
      ids.push(id)
      const icon = layerIcons[layer] || "📁"
      mermaid += `    ${id}["${icon} ${id}<br/>${count} files"]\n`
    }
    
    for (let i = 0; i < ids.length - 1; i++) {
      const from = ids[i]
      const to = ids[i + 1]
      if (["Ui", "Api"].includes(from) && ["Service", "Api"].includes(to)) {
        mermaid += `    ${from} --> ${to}\n`
      }
      if (from === "Service" && ["Model", "Util"].includes(to)) {
        mermaid += `    ${from} --> ${to}\n`
      }
    }
    
    for (const [layer] of sortedLayers) {
      const id = layer.charAt(0).toUpperCase() + layer.slice(1)
      const color = layerColors[layer]
      if (color) mermaid += `    style ${id} fill:${color},color:#fff\n`
    }

    diagrams.push({
      id: "layer-overview",
      category: "layers",
      title: "Layer Architecture",
      description: `${analysis.files.length} files across ${sortedLayers.length} layers`,
      mermaid,
      labels: ["architecture", "layers", "auto"],
      priority: 100,
    })
  }

  if (analysis.domains.length > 0) {
    let mermaid = "graph LR\n"
    const topDomains = analysis.domains.slice(0, 6)
    
    for (const domain of topDomains) {
      const id = domain.name.replace(/[^a-zA-Z0-9]/g, "")
      const icon = layerIcons[domain.layer] || "📁"
      mermaid += `    ${id}["${icon} ${domain.name}<br/>${domain.fileCount} files"]\n`
    }
    
    for (let i = 0; i < topDomains.length - 1; i++) {
      const from = topDomains[i].name.replace(/[^a-zA-Z0-9]/g, "")
      const to = topDomains[i + 1].name.replace(/[^a-zA-Z0-9]/g, "")
      if (topDomains[i].layer !== topDomains[i + 1].layer) {
        mermaid += `    ${from} -.-> ${to}\n`
      }
    }

    diagrams.push({
      id: "domain-overview",
      category: "domains",
      title: "Domain Structure",
      description: `${analysis.domains.length} domains detected`,
      mermaid,
      labels: ["domains", "structure", "auto"],
      priority: 90,
    })
  }

  const layerDeps = new Map<string, Set<string>>()
  for (const file of analysis.files) {
    const fromLayer = file.layer || "other"
    for (const imp of file.imports) {
      if (imp.startsWith(".")) {
        const targetFile = analysis.files.find(f => 
          imp.includes(f.path.split("/").pop()?.replace(/\.[^.]+$/, "") || "")
        )
        if (targetFile && targetFile.layer !== fromLayer) {
          if (!layerDeps.has(fromLayer)) layerDeps.set(fromLayer, new Set())
          layerDeps.get(fromLayer)!.add(targetFile.layer)
        }
      }
    }
  }

  if (layerDeps.size > 0) {
    let mermaid = "graph LR\n"
    const allLayers = new Set<string>()
    layerDeps.forEach((deps, from) => {
      allLayers.add(from)
      deps.forEach(to => allLayers.add(to))
    })
    
    for (const layer of allLayers) {
      const id = layer.charAt(0).toUpperCase() + layer.slice(1)
      mermaid += `    ${id}((${id}))\n`
    }
    
    for (const [from, deps] of layerDeps) {
      const fromId = from.charAt(0).toUpperCase() + from.slice(1)
      for (const to of deps) {
        const toId = to.charAt(0).toUpperCase() + to.slice(1)
        mermaid += `    ${fromId} --> ${toId}\n`
      }
    }

    diagrams.push({
      id: "layer-dependencies",
      category: "dependencies",
      title: "Layer Dependencies",
      description: "How layers depend on each other",
      mermaid,
      labels: ["dependencies", "layers", "auto"],
      priority: 80,
    })
  }

  return diagrams
}

export function buildDiagramContext(
  lastAnalysis: AnalysisResult | null,
  currentDiagrams: DiagramSet | null
): string {
  const parts: string[] = []
  
  if (lastAnalysis) {
    parts.push(`## Codebase Analysis`)
    parts.push(`- ${lastAnalysis.files.length} files`)
    parts.push(`- Layers: ${Object.entries(lastAnalysis.layers).map(([k,v]) => `${k}(${v})`).join(", ")}`)
    parts.push(`- Domains: ${lastAnalysis.domains.slice(0, 5).map(d => d.name).join(", ")}`)
  }
  
  if (currentDiagrams && currentDiagrams.diagrams.length > 0) {
    parts.push(`\n## Current Diagrams`)
    for (const d of currentDiagrams.diagrams.slice(0, 5)) {
      parts.push(`- ${d.title}: ${d.description}`)
    }
  }
  
  return parts.join("\n")
}

export function createDiagramRecord(
  type: DiagramType,
  mermaid: string,
  description?: string
): DiagramRecord {
  const typeConfig = DIAGRAM_TYPES[type]
  return {
    id: type,
    category: mapTypeToCategory(type),
    title: typeConfig.label,
    description: description || `Generated ${type} diagram`,
    mermaid,
    labels: [type, "generated"],
    priority: type === "architecture" ? 95 : type === "dataflow" ? 90 : 75,
  }
}

export function mergeDiagrams(
  newDiagram: DiagramRecord,
  existingDiagrams: DiagramRecord[]
): DiagramRecord[] {
  const otherDiagrams = existingDiagrams.filter(d => d.id !== newDiagram.id)
  return [newDiagram, ...otherDiagrams]
}
