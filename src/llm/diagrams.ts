import { createHash } from "crypto"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { log, logError } from "../logger"
import type { CodebaseAnalysis } from "../analyzer/treesitter"

export type DiagramCategory = 
  | "architecture" 
  | "layers" 
  | "flows" 
  | "dependencies" 
  | "patterns" 
  | "domains"
  | "insights"

export interface Diagram {
  id: string
  category: DiagramCategory
  title: string
  description: string
  mermaid: string
  labels: string[]
  priority: number
}

export interface DiagramSet {
  generated: string
  hash: string
  diagrams: Diagram[]
  summary: string
}

interface LLMConfig {
  apiKey: string
  model: string
  baseUrl: string
}

const CACHE_TTL_MS = 60 * 60 * 1000

export class DiagramGenerator {
  private cacheDir: string
  private config: LLMConfig | null = null

  constructor(architectureDir: string) {
    this.cacheDir = join(architectureDir, ".cache")
    this.initConfig()
  }

  private initConfig(): void {
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (openaiKey) {
      this.config = {
        apiKey: openaiKey,
        model: "gpt-4o-mini",
        baseUrl: "https://api.openai.com/v1",
      }
    } else if (anthropicKey) {
      this.config = {
        apiKey: anthropicKey,
        model: "claude-3-haiku-20240307",
        baseUrl: "https://api.anthropic.com/v1",
      }
    }

    if (this.config) {
      log(`LLM configured: ${this.config.model}`)
    } else {
      log("No LLM API key found - using template diagrams only")
    }
  }

  async generate(analysis: CodebaseAnalysis): Promise<DiagramSet> {
    const hash = this.computeHash(analysis)
    
    const cached = await this.loadCache(hash)
    if (cached) {
      log("Using cached diagrams")
      await this.saveDiagrams(cached)
      return cached
    }

    log("Generating architecture diagrams...")
    const startTime = Date.now()

    const context = this.buildContext(analysis)
    
    const diagrams: Diagram[] = []

    const templateDiagrams = this.generateTemplateDiagrams(analysis)
    diagrams.push(...templateDiagrams)

    if (this.config) {
      const llmDiagrams = await this.generateLLMDiagrams(analysis, context)
      diagrams.push(...llmDiagrams)
    }

    diagrams.sort((a, b) => b.priority - a.priority)

    const summary = this.config 
      ? await this.generateSummary(context) 
      : this.generateTemplateSummary(analysis)

    const result: DiagramSet = {
      generated: new Date().toISOString(),
      hash,
      diagrams,
      summary,
    }

    await this.saveCache(hash, result)
    await this.saveDiagrams(result)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`Generated ${diagrams.length} diagrams in ${elapsed}s`)

    return result
  }

  private async saveDiagrams(data: DiagramSet): Promise<void> {
    try {
      const architectureDir = join(this.cacheDir, "..")
      await writeFile(join(architectureDir, "diagrams.json"), JSON.stringify(data, null, 2))
    } catch (err) {
      logError("Failed to save diagrams.json", err)
    }
  }

  private generateTemplateDiagrams(analysis: CodebaseAnalysis): Diagram[] {
    const diagrams: Diagram[] = []

    diagrams.push(this.createLayerOverviewDiagram(analysis))
    diagrams.push(this.createDependencyMatrixDiagram(analysis))
    
    const topDomains = this.detectDomains(analysis).slice(0, 5)
    for (const domain of topDomains) {
      diagrams.push(this.createDomainDiagram(domain, analysis))
    }

    const entryPoints = this.detectEntryPoints(analysis).slice(0, 3)
    for (const entry of entryPoints) {
      diagrams.push(this.createFlowDiagram(entry, analysis))
    }

    return diagrams
  }

  private createLayerOverviewDiagram(analysis: CodebaseAnalysis): Diagram {
    const layerCounts = new Map<string, number>()
    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath) || "other"
      layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1)
    }

    const layers = [...layerCounts.entries()]
      .filter(([_, count]) => count > 0)
      .sort((a, b) => {
        const order = ["api", "service", "model", "util", "ui", "config", "test", "other"]
        return order.indexOf(a[0]) - order.indexOf(b[0])
      })

    let mermaid = "graph TD\n"
    
    const layerIds: string[] = []
    for (const [layer, count] of layers) {
      const id = layer.charAt(0).toUpperCase() + layer.slice(1)
      layerIds.push(id)
      const icon = this.getLayerIcon(layer)
      mermaid += `    ${id}["${icon} ${id}<br/>${count} files"]\n`
    }

    for (let i = 0; i < layerIds.length - 1; i++) {
      const from = layerIds[i]
      const to = layerIds[i + 1]
      if (["Api", "Service", "Model"].includes(from) && ["Service", "Model", "Util"].includes(to)) {
        mermaid += `    ${from} --> ${to}\n`
      }
    }

    mermaid += `\n    style Api fill:#3b82f6,color:#fff\n`
    mermaid += `    style Service fill:#10b981,color:#fff\n`
    mermaid += `    style Model fill:#f59e0b,color:#fff\n`

    return {
      id: "layer-overview",
      category: "layers",
      title: "Layer Architecture",
      description: "How code is organized across architectural layers",
      mermaid,
      labels: ["architecture", "layers", "overview"],
      priority: 100,
    }
  }

  private createDependencyMatrixDiagram(analysis: CodebaseAnalysis): Diagram {
    const layerDeps = new Map<string, Set<string>>()
    
    for (const [file, deps] of analysis.dependencyGraph) {
      const fromLayer = analysis.layerMap.get(file) || "other"
      
      for (const dep of deps) {
        const resolved = this.resolveImport(file, dep, analysis)
        if (resolved) {
          const toLayer = analysis.layerMap.get(resolved) || "other"
          if (fromLayer !== toLayer) {
            if (!layerDeps.has(fromLayer)) layerDeps.set(fromLayer, new Set())
            layerDeps.get(fromLayer)!.add(toLayer)
          }
        }
      }
    }

    let mermaid = "graph LR\n"
    
    const layers = ["api", "service", "model", "util", "ui", "config"]
    for (const layer of layers) {
      const id = layer.charAt(0).toUpperCase() + layer.slice(1)
      mermaid += `    ${id}((${id}))\n`
    }

    mermaid += "\n"
    
    for (const [from, tos] of layerDeps) {
      const fromId = from.charAt(0).toUpperCase() + from.slice(1)
      for (const to of tos) {
        const toId = to.charAt(0).toUpperCase() + to.slice(1)
        if (layers.includes(from) && layers.includes(to)) {
          mermaid += `    ${fromId} --> ${toId}\n`
        }
      }
    }

    return {
      id: "dependency-matrix",
      category: "dependencies",
      title: "Layer Dependencies",
      description: "How layers depend on each other",
      mermaid,
      labels: ["dependencies", "layers", "coupling"],
      priority: 90,
    }
  }

  private createDomainDiagram(domain: { name: string; files: string[]; layer: string }, analysis: CodebaseAnalysis): Diagram {
    const keyFiles = domain.files.slice(0, 8)
    
    let mermaid = `graph TD\n`
    mermaid += `    subgraph ${this.sanitizeId(domain.name)}["${domain.name}"]\n`
    
    for (const file of keyFiles) {
      const fileAnalysis = analysis.files.find(f => f.relativePath === file)
      const name = file.split("/").pop()?.replace(/\.[^.]+$/, "") || file
      const id = this.sanitizeId(name)
      
      const classCount = fileAnalysis?.classes.length || 0
      const funcCount = fileAnalysis?.functions.length || 0
      const label = classCount > 0 ? `📦 ${name}` : `📄 ${name}`
      
      mermaid += `        ${id}["${label}"]\n`
    }
    
    mermaid += `    end\n`

    return {
      id: `domain-${this.sanitizeId(domain.name)}`,
      category: "domains",
      title: domain.name,
      description: `${domain.files.length} files in the ${domain.layer} layer`,
      mermaid,
      labels: ["domain", domain.layer, domain.name.toLowerCase()],
      priority: 70,
    }
  }

  private createFlowDiagram(entry: { name: string; path: string; file: string; type: string }, analysis: CodebaseAnalysis): Diagram {
    const file = analysis.files.find(f => f.relativePath === entry.file)
    if (!file) {
      return this.createEmptyFlowDiagram(entry)
    }

    const deps = analysis.dependencyGraph.get(entry.file) || []
    
    let mermaid = "sequenceDiagram\n"
    mermaid += `    participant Client\n`
    
    const component = entry.file.split("/").pop()?.replace(/\.[^.]+$/, "") || "Handler"
    mermaid += `    participant ${this.sanitizeId(component)} as ${component}\n`

    const resolvedDeps: string[] = []
    for (const dep of deps.slice(0, 3)) {
      const resolved = this.resolveImport(entry.file, dep, analysis)
      if (resolved) {
        const name = resolved.split("/").pop()?.replace(/\.[^.]+$/, "") || dep
        mermaid += `    participant ${this.sanitizeId(name)} as ${name}\n`
        resolvedDeps.push(name)
      }
    }

    mermaid += `\n`
    mermaid += `    Client->>${this.sanitizeId(component)}: ${entry.type.toUpperCase()} ${entry.path}\n`
    
    for (const dep of resolvedDeps) {
      mermaid += `    ${this.sanitizeId(component)}->>${this.sanitizeId(dep)}: process()\n`
      mermaid += `    ${this.sanitizeId(dep)}-->>${this.sanitizeId(component)}: result\n`
    }
    
    mermaid += `    ${this.sanitizeId(component)}-->>Client: response\n`

    return {
      id: `flow-${this.sanitizeId(entry.name)}`,
      category: "flows",
      title: entry.name,
      description: `${entry.type.toUpperCase()} ${entry.path}`,
      mermaid,
      labels: ["flow", entry.type, "sequence"],
      priority: 80,
    }
  }

  private createEmptyFlowDiagram(entry: { name: string; path: string; type: string }): Diagram {
    const mermaid = `sequenceDiagram
    participant Client
    participant Handler
    Client->>Handler: ${entry.type.toUpperCase()} ${entry.path}
    Handler-->>Client: response`

    return {
      id: `flow-${this.sanitizeId(entry.name)}`,
      category: "flows",
      title: entry.name,
      description: `${entry.type.toUpperCase()} ${entry.path}`,
      mermaid,
      labels: ["flow", entry.type],
      priority: 60,
    }
  }

  private async generateLLMDiagrams(analysis: CodebaseAnalysis, context: string): Promise<Diagram[]> {
    const diagrams: Diagram[] = []

    const prompts = [
      {
        category: "architecture" as DiagramCategory,
        title: "System Architecture",
        prompt: `Create a high-level system architecture diagram showing the main components/services and how they interact. Use meaningful labels. Show external dependencies if any.`,
      },
      {
        category: "patterns" as DiagramCategory,
        title: "Design Patterns",
        prompt: `Identify and visualize the main design patterns used in this codebase (Repository, Service, Factory, etc.). Show how they're connected.`,
      },
      {
        category: "flows" as DiagramCategory,
        title: "Data Flow",
        prompt: `Create a flowchart showing how data flows through the main paths in this system. Use clear labels for each step.`,
      },
      {
        category: "insights" as DiagramCategory,
        title: "Key Relationships",
        prompt: `Visualize the most important relationships and dependencies in this codebase. Focus on what a new developer should understand first.`,
      },
    ]

    const results = await Promise.all(
      prompts.map(p => this.generateSingleDiagram(p, context))
    )

    for (const result of results) {
      if (result) diagrams.push(result)
    }

    return diagrams
  }

  private async generateSingleDiagram(
    spec: { category: DiagramCategory; title: string; prompt: string },
    context: string
  ): Promise<Diagram | null> {
    if (!this.config) return null

    const fullPrompt = `You are an expert software architect creating Mermaid diagrams.

CODEBASE CONTEXT:
${context}

TASK: ${spec.prompt}

RULES:
- Output ONLY valid Mermaid code (no markdown, no explanation)
- Use "graph TD" for flowcharts, "sequenceDiagram" for sequences, "classDiagram" for classes
- Keep it readable: max 12-15 nodes
- Use clear, descriptive labels (not file names)
- Add meaningful edge labels where helpful
- Use subgraphs to group related components

OUTPUT:`

    try {
      const mermaid = await this.callLLM(fullPrompt, 600)
      
      if (!mermaid || mermaid.length < 20) return null

      const cleaned = this.cleanMermaidCode(mermaid)
      if (!cleaned) return null

      return {
        id: `llm-${spec.category}-${Date.now()}`,
        category: spec.category,
        title: spec.title,
        description: `AI-generated ${spec.title.toLowerCase()} visualization`,
        mermaid: cleaned,
        labels: ["ai-generated", spec.category],
        priority: 85,
      }
    } catch (err) {
      logError(`Failed to generate ${spec.title}`, err)
      return null
    }
  }

  private async generateSummary(context: string): Promise<string> {
    if (!this.config) return ""

    const prompt = `Based on this codebase analysis, write a 2-sentence summary of what this project does and its architecture style. Be specific.

${context}

Summary:`

    return this.callLLM(prompt, 150)
  }

  private generateTemplateSummary(analysis: CodebaseAnalysis): string {
    const langs = [...new Set(analysis.files.map(f => f.language))]
    const fileCount = analysis.files.length
    
    return `A ${langs.join("/")} project with ${fileCount} files organized in a layered architecture.`
  }

  private async callLLM(prompt: string, maxTokens: number): Promise<string> {
    if (!this.config) return ""

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        logError(`LLM API error: ${response.status}`, await response.text())
        return ""
      }

      const data = await response.json() as { choices: { message: { content: string } }[] }
      return data.choices[0]?.message?.content?.trim() || ""
    } catch (err) {
      logError("LLM request failed", err)
      return ""
    }
  }

  private cleanMermaidCode(raw: string): string {
    let code = raw
      .replace(/```mermaid\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    if (!code.match(/^(graph|sequenceDiagram|classDiagram|flowchart|stateDiagram|erDiagram|pie|gantt)/)) {
      return ""
    }

    return code
  }

  private buildContext(analysis: CodebaseAnalysis): string {
    const filesByLang = new Map<string, number>()
    for (const file of analysis.files) {
      filesByLang.set(file.language, (filesByLang.get(file.language) || 0) + 1)
    }

    const layerCounts = new Map<string, number>()
    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath) || "other"
      layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1)
    }

    const domains = this.detectDomains(analysis).slice(0, 8)
    const entryPoints = this.detectEntryPoints(analysis).slice(0, 5)

    const keyClasses = analysis.files
      .flatMap(f => f.classes.filter(c => c.isExported))
      .slice(0, 15)
      .map(c => c.name)

    const keyFunctions = analysis.files
      .flatMap(f => f.functions.filter(fn => fn.isExported))
      .slice(0, 15)
      .map(f => f.name)

    return `
FILES: ${analysis.files.length}
LANGUAGES: ${[...filesByLang.entries()].map(([k,v]) => `${k}(${v})`).join(", ")}

LAYERS:
${[...layerCounts.entries()].map(([k,v]) => `- ${k}: ${v} files`).join("\n")}

DOMAINS:
${domains.map(d => `- ${d.name}: ${d.files.length} files (${d.layer})`).join("\n")}

ENTRY POINTS:
${entryPoints.map(e => `- ${e.type} ${e.path}`).join("\n")}

KEY CLASSES: ${keyClasses.join(", ")}
KEY FUNCTIONS: ${keyFunctions.join(", ")}
`.trim()
  }

  private detectDomains(analysis: CodebaseAnalysis): { name: string; files: string[]; layer: string }[] {
    const domainMap = new Map<string, string[]>()
    
    for (const file of analysis.files) {
      const parts = file.relativePath.split("/")
      const skipDirs = new Set(["src", "lib", "app", "internal", "pkg", "cmd"])
      
      let domain = "root"
      for (const part of parts.slice(0, -1)) {
        if (!skipDirs.has(part) && !part.startsWith("_") && !part.startsWith(".")) {
          domain = part
          break
        }
      }
      
      if (!domainMap.has(domain)) domainMap.set(domain, [])
      domainMap.get(domain)!.push(file.relativePath)
    }

    return [...domainMap.entries()]
      .filter(([_, files]) => files.length >= 2)
      .map(([name, files]) => {
        const layerCounts = new Map<string, number>()
        for (const f of files) {
          const layer = analysis.layerMap.get(f) || "other"
          layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1)
        }
        const topLayer = [...layerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "other"
        
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, " "),
          files,
          layer: topLayer,
        }
      })
      .sort((a, b) => b.files.length - a.files.length)
  }

  private detectEntryPoints(analysis: CodebaseAnalysis): { name: string; path: string; file: string; type: string }[] {
    const entries: { name: string; path: string; file: string; type: string }[] = []
    const handlerPattern = /^(get|post|put|patch|delete|handle|create|update|list|fetch)/i

    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath)
      
      if (layer === "api") {
        for (const func of file.functions) {
          if (handlerPattern.test(func.name)) {
            const name = func.name
              .replace(/^(get|post|put|patch|delete|handle)/i, "")
              .replace(/([A-Z])/g, " $1")
              .trim() || func.name
            
            entries.push({
              name,
              path: this.inferPath(func.name, file.relativePath),
              file: file.relativePath,
              type: this.inferMethod(func.name),
            })
          }
        }
      }
    }

    return entries
  }

  private inferPath(funcName: string, filePath: string): string {
    const name = funcName
      .replace(/^(get|post|put|patch|delete|handle)/i, "")
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "")
    
    const parts = filePath.split("/")
    const domain = parts.find(p => !["src", "api", "routes", "handlers"].includes(p) && !p.includes(".")) || ""
    
    return `/api/${domain}/${name}`.replace(/\/+/g, "/").replace(/\/$/, "")
  }

  private inferMethod(funcName: string): string {
    const lower = funcName.toLowerCase()
    if (lower.startsWith("get") || lower.startsWith("list") || lower.startsWith("fetch")) return "GET"
    if (lower.startsWith("post") || lower.startsWith("create")) return "POST"
    if (lower.startsWith("put") || lower.startsWith("update")) return "PUT"
    if (lower.startsWith("delete")) return "DELETE"
    return "GET"
  }

  private resolveImport(fromFile: string, importPath: string, analysis: CodebaseAnalysis): string | null {
    if (!importPath.startsWith(".")) return null

    const fromDir = fromFile.split("/").slice(0, -1).join("/")
    let resolved = join(fromDir, importPath).replace(/\\/g, "/")

    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"]
    for (const ext of extensions) {
      const candidate = resolved + ext
      if (analysis.files.some(f => f.relativePath === candidate)) {
        return candidate
      }
    }

    return null
  }

  private getLayerIcon(layer: string): string {
    const icons: Record<string, string> = {
      api: "🌐",
      service: "⚙️",
      model: "📊",
      ui: "🎨",
      util: "🔧",
      config: "⚙️",
      test: "🧪",
    }
    return icons[layer] || "📁"
  }

  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "")
  }

  private computeHash(analysis: CodebaseAnalysis): string {
    const content = analysis.files
      .map(f => `${f.relativePath}:${f.functions.length}:${f.classes.length}`)
      .sort()
      .join("|")
    
    return createHash("sha256").update(content).digest("hex").slice(0, 16)
  }

  private async loadCache(hash: string): Promise<DiagramSet | null> {
    try {
      const path = join(this.cacheDir, `diagrams-${hash}.json`)
      const content = await readFile(path, "utf-8")
      const data = JSON.parse(content) as DiagramSet & { cachedAt: number }
      
      if (Date.now() - data.cachedAt < CACHE_TTL_MS) {
        return data
      }
    } catch {
    }
    return null
  }

  private async saveCache(hash: string, data: DiagramSet): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true })
      const path = join(this.cacheDir, `diagrams-${hash}.json`)
      await writeFile(path, JSON.stringify({ ...data, cachedAt: Date.now() }, null, 2))
    } catch (err) {
      logError("Failed to save diagram cache", err)
    }
  }
}
