/**
 * StoryGenerator - Transforms raw codebase analysis into human-readable narrative architecture.
 * This is a complex transformation: 941 file nodes → story chapters with Mermaid diagrams.
 */

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import type { CodebaseAnalysis, FileAnalysis, FunctionInfo } from "../analyzer/treesitter"
import { log } from "../logger"

export interface Domain {
  name: string
  description: string
  files: FileAnalysis[]
  layer: string
  entryPoints: EntryPoint[]
  keyClasses: string[]
  keyFunctions: string[]
}

export interface EntryPoint {
  type: 'api' | 'cli' | 'event' | 'cron' | 'websocket'
  name: string
  path: string
  file: string
  handler?: string
}

export interface Flow {
  name: string
  description: string
  entryPoint: EntryPoint
  steps: FlowStep[]
  mermaid: string
}

export interface FlowStep {
  actor: string
  action: string
  target: string
  description: string
  file?: string
}

export interface LayerSummary {
  name: string
  description: string
  fileCount: number
  keyComponents: string[]
  mermaid: string
}

export interface ArchitectureStory {
  title: string
  summary: string
  generated: string
  stats: {
    totalFiles: number
    domains: number
    entryPoints: number
    flows: number
  }
  domains: Domain[]
  flows: Flow[]
  layers: LayerSummary[]
  systemDiagram: string
  layerDiagram: string
}

const LAYER_DESCRIPTIONS: Record<string, string> = {
  api: "Handles incoming HTTP requests and routes them to appropriate handlers",
  service: "Contains business logic and orchestrates operations",
  model: "Defines data structures and database models",
  ui: "User interface components and views",
  util: "Shared utilities and helper functions",
  test: "Test files and fixtures",
  config: "Configuration and settings",
  other: "Other files",
}

const SKIP_DIRS = new Set(["src", "lib", "app", "internal", "pkg", "cmd"])
const HANDLER_PATTERN = /^(get|post|put|patch|delete|handle|create|update|list|fetch)/i
const LAYER_ORDER = ["api", "service", "model", "util", "ui", "test", "config", "other"]

export class StoryGenerator {
  constructor(private architectureDir: string) {}

  async generate(analysis: CodebaseAnalysis): Promise<ArchitectureStory> {
    log("Generating architecture story...")
    
    const domains = this.detectDomains(analysis)
    const entryPoints = this.detectEntryPoints(analysis)
    const flows = this.generateFlows(analysis, entryPoints)
    const layers = this.generateLayerSummaries(analysis)
    
    const story: ArchitectureStory = {
      title: this.detectProjectName(analysis),
      summary: this.generateSummary(analysis, domains),
      generated: analysis.timestamp.toISOString(),
      stats: {
        totalFiles: analysis.files.length,
        domains: domains.length,
        entryPoints: entryPoints.length,
        flows: flows.length,
      },
      domains,
      flows,
      layers,
      systemDiagram: this.generateSystemDiagram(domains),
      layerDiagram: this.generateLayerDiagram(layers),
    }

    await mkdir(this.architectureDir, { recursive: true })
    await writeFile(
      join(this.architectureDir, "story.json"),
      JSON.stringify(story, null, 2)
    )

    log(`Story generated: ${domains.length} domains, ${flows.length} flows`)
    return story
  }

  private detectProjectName(analysis: CodebaseAnalysis): string {
    const topDirs = analysis.files
      .map(f => f.relativePath.split("/")[0])
      .filter(d => !d.includes("."))
    
    const counts = new Map<string, number>()
    topDirs.forEach(d => counts.set(d, (counts.get(d) || 0) + 1))
    
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || "Project"
  }

  private generateSummary(analysis: CodebaseAnalysis, domains: Domain[]): string {
    const fileCount = analysis.files.length
    const languages = new Set(analysis.files.map(f => f.language))
    const langList = [...languages].join(", ")
    
    const domainList = domains
      .slice(0, 3)
      .map(d => d.name)
      .join(", ")
    
    return `A ${langList} project with ${fileCount} files organized across ${domains.length} domains including ${domainList}. ` +
           `The codebase follows a layered architecture with clear separation between API, service, and data layers.`
  }

  private detectDomains(analysis: CodebaseAnalysis): Domain[] {
    const domainMap = new Map<string, FileAnalysis[]>()
    
    for (const file of analysis.files) {
      const domain = this.extractDomainFromPath(file.relativePath)
      
      if (!domainMap.has(domain)) domainMap.set(domain, [])
      domainMap.get(domain)!.push(file)
    }
    
    return this.convertToDomainObjects(domainMap, analysis)
  }

  private extractDomainFromPath(relativePath: string): string {
    const parts = relativePath.split("/")
    
    for (const part of parts.slice(0, -1)) {
      if (!SKIP_DIRS.has(part) && !part.startsWith("_")) {
        return part
      }
      
      const idx = parts.indexOf(part)
      if (SKIP_DIRS.has(part) && idx + 1 < parts.length - 1) {
        return parts[idx + 1]
      }
    }
    
    return "root"
  }

  private convertToDomainObjects(domainMap: Map<string, FileAnalysis[]>, analysis: CodebaseAnalysis): Domain[] {
    const domains: Domain[] = []
    
    for (const [name, files] of domainMap) {
      if (files.length < 2) continue
      
      const layerCounts = new Map<string, number>()
      const allClasses: string[] = []
      const allFunctions: string[] = []
      
      for (const file of files) {
        const layer = analysis.layerMap.get(file.relativePath) || "other"
        layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1)
        
        allClasses.push(...file.classes.filter(c => c.isExported).map(c => c.name))
        allFunctions.push(...file.functions.filter(f => f.isExported).map(f => f.name))
      }
      
      const sortedLayers = [...layerCounts.entries()].sort((a, b) => b[1] - a[1])
      const primaryLayer = sortedLayers[0]?.[0] || "other"
      
      domains.push({
        name: this.formatDomainName(name),
        description: this.generateDomainDescription(name, files, primaryLayer),
        files,
        layer: primaryLayer,
        entryPoints: [],
        keyClasses: allClasses.slice(0, 5),
        keyFunctions: allFunctions.slice(0, 5),
      })
    }
    
    return domains.sort((a, b) => b.files.length - a.files.length)
  }

  private formatDomainName(name: string): string {
    return name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private generateDomainDescription(name: string, files: FileAnalysis[], layer: string): string {
    const patterns: Record<string, string> = {
      api: "Exposes HTTP endpoints for",
      service: "Implements business logic for",
      model: "Defines data models for",
      ui: "Provides user interface for",
      util: "Provides utilities for",
      config: "Configures",
      test: "Tests",
    }
    
    const prefix = patterns[layer] || "Contains files related to"
    const formattedName = this.formatDomainName(name).toLowerCase()
    
    return `${prefix} ${formattedName} functionality. Contains ${files.length} files.`
  }

  private detectEntryPoints(analysis: CodebaseAnalysis): EntryPoint[] {
    const entryPoints: EntryPoint[] = []
    
    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath) || "other"
      
      if (layer === "api") {
        this.extractApiEntryPoints(file, entryPoints)
      }
      
      if (file.relativePath.includes("cmd/") || file.relativePath.includes("commands/")) {
        this.extractCliEntryPoints(file, entryPoints)
      }
    }
    
    return entryPoints
  }

  private extractApiEntryPoints(file: FileAnalysis, entryPoints: EntryPoint[]): void {
    for (const func of file.functions) {
      if (HANDLER_PATTERN.test(func.name)) {
        entryPoints.push({
          type: "api",
          name: this.extractRouteName(func),
          path: this.extractRoutePath(func, file),
          file: file.relativePath,
          handler: func.name,
        })
      }
    }
    
    for (const exp of file.exports) {
      if (exp.type === "function" && HANDLER_PATTERN.test(exp.name)) {
        const existing = entryPoints.find(e => e.handler === exp.name)
        if (!existing) {
          entryPoints.push({
            type: "api",
            name: exp.name,
            path: `/${exp.name.toLowerCase()}`,
            file: file.relativePath,
            handler: exp.name,
          })
        }
      }
    }
  }

  private extractCliEntryPoints(file: FileAnalysis, entryPoints: EntryPoint[]): void {
    for (const func of file.functions.filter(f => f.isExported)) {
      entryPoints.push({
        type: "cli",
        name: func.name,
        path: `$ ${func.name.toLowerCase()}`,
        file: file.relativePath,
        handler: func.name,
      })
    }
  }

  private extractRouteName(func: FunctionInfo): string {
    return func.name
      .replace(/^(get|post|put|patch|delete|handle)/i, "")
      .replace(/([A-Z])/g, " $1")
      .trim()
  }

  private extractRoutePath(func: FunctionInfo, file: FileAnalysis): string {
    const name = func.name
      .replace(/^(get|post|put|patch|delete|handle)/i, "")
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "")
    
    const domain = file.relativePath.split("/")[1] || ""
    return `/api/${domain}/${name}`.replace(/\/+/g, "/")
  }

  private generateFlows(analysis: CodebaseAnalysis, entryPoints: EntryPoint[]): Flow[] {
    return entryPoints
      .slice(0, 5)
      .map(ep => this.traceFlow(analysis, ep))
      .filter(flow => flow.steps.length > 1)
  }

  private traceFlow(analysis: CodebaseAnalysis, entryPoint: EntryPoint): Flow {
    const steps: FlowStep[] = []
    
    steps.push({
      actor: "Client",
      action: entryPoint.type === "api" ? `${entryPoint.path}` : entryPoint.path,
      target: this.extractComponent(entryPoint.file),
      description: `Request arrives at ${entryPoint.name}`,
      file: entryPoint.file,
    })
    
    const file = analysis.files.find(f => f.relativePath === entryPoint.file)
    if (file) {
      const deps = analysis.dependencyGraph.get(file.relativePath) || []
      
      for (const dep of deps.slice(0, 3)) {
        const depFile = analysis.files.find(f => f.relativePath.includes(dep.replace(/^\.\//, "")))
        if (depFile) {
          const layer = analysis.layerMap.get(depFile.relativePath) || "other"
          
          steps.push({
            actor: this.extractComponent(entryPoint.file),
            action: this.getLayerAction(layer),
            target: this.extractComponent(depFile.relativePath),
            description: `Delegates to ${layer} layer`,
            file: depFile.relativePath,
          })
        }
      }
    }
    
    return {
      name: entryPoint.name,
      description: `Flow triggered by ${entryPoint.type} request to ${entryPoint.path}`,
      entryPoint,
      steps,
      mermaid: this.generateSequenceDiagram(steps),
    }
  }

  private extractComponent(filePath: string): string {
    const fileName = filePath.split("/").pop() || filePath
    return fileName.replace(/\.(ts|tsx|js|jsx|py|go)$/, "")
  }

  private getLayerAction(layer: string): string {
    const actions: Record<string, string> = {
      service: "process()",
      model: "query()",
      api: "handle()",
      util: "helper()",
      config: "load()",
    }
    return actions[layer] || "call()"
  }

  private generateSequenceDiagram(steps: FlowStep[]): string {
    const participants = [...new Set(steps.flatMap(s => [s.actor, s.target]))]
    
    let mermaid = "sequenceDiagram\n"
    
    for (const p of participants) {
      mermaid += `    participant ${this.sanitizeMermaidId(p)}\n`
    }
    
    mermaid += "\n"
    
    for (const step of steps) {
      const from = this.sanitizeMermaidId(step.actor)
      const to = this.sanitizeMermaidId(step.target)
      mermaid += `    ${from}->>${to}: ${step.action}\n`
    }
    
    return mermaid
  }

  private sanitizeMermaidId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, "_")
  }

  private generateLayerSummaries(analysis: CodebaseAnalysis): LayerSummary[] {
    const layerFiles = new Map<string, FileAnalysis[]>()
    
    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath) || "other"
      if (!layerFiles.has(layer)) layerFiles.set(layer, [])
      layerFiles.get(layer)!.push(file)
    }
    
    const summaries: LayerSummary[] = []
    
    for (const [layer, files] of layerFiles) {
      if (files.length === 0) continue
      
      const keyComponents = files
        .slice(0, 5)
        .map(f => this.extractComponent(f.relativePath))
      
      summaries.push({
        name: layer.charAt(0).toUpperCase() + layer.slice(1),
        description: LAYER_DESCRIPTIONS[layer] || "Contains various files",
        fileCount: files.length,
        keyComponents,
        mermaid: this.generateLayerBox(layer, files.length, keyComponents),
      })
    }
    
    return summaries.sort((a, b) => {
      return LAYER_ORDER.indexOf(a.name.toLowerCase()) - LAYER_ORDER.indexOf(b.name.toLowerCase())
    })
  }

  private generateLayerBox(layer: string, count: number, components: string[]): string {
    return `subgraph ${layer}["${layer.toUpperCase()} (${count} files)"]\n` +
           components.map(c => `    ${this.sanitizeMermaidId(c)}["${c}"]`).join("\n") +
           "\nend"
  }

  private generateSystemDiagram(domains: Domain[]): string {
    if (domains.length === 0) return ""
    
    let mermaid = "graph TD\n"
    
    const byLayer = new Map<string, Domain[]>()
    for (const d of domains) {
      if (!byLayer.has(d.layer)) byLayer.set(d.layer, [])
      byLayer.get(d.layer)!.push(d)
    }
    
    for (const [layer, doms] of byLayer) {
      mermaid += `    subgraph ${layer}["${layer.toUpperCase()}"]\n`
      for (const d of doms.slice(0, 5)) {
        const id = this.sanitizeMermaidId(d.name)
        mermaid += `        ${id}["${d.name}<br/>${d.files.length} files"]\n`
      }
      mermaid += "    end\n"
    }
    
    const layers = ["api", "service", "model"]
    for (let i = 0; i < layers.length - 1; i++) {
      if (byLayer.has(layers[i]) && byLayer.has(layers[i + 1])) {
        mermaid += `    ${layers[i]} --> ${layers[i + 1]}\n`
      }
    }
    
    return mermaid
  }

  private generateLayerDiagram(layers: LayerSummary[]): string {
    if (layers.length === 0) return ""
    
    let mermaid = "graph TD\n"
    
    for (const layer of layers) {
      const id = this.sanitizeMermaidId(layer.name)
      mermaid += `    ${id}["${layer.name}<br/>${layer.fileCount} files"]\n`
    }
    
    const order = ["Api", "Service", "Model"]
    for (let i = 0; i < order.length - 1; i++) {
      if (layers.some(l => l.name === order[i]) && layers.some(l => l.name === order[i + 1])) {
        mermaid += `    ${order[i]} --> ${order[i + 1]}\n`
      }
    }
    
    return mermaid
  }
}
