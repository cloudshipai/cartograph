import { readdir, readFile } from "fs/promises"
import { join, extname } from "path"

declare var self: Worker

interface AnalyzeRequest {
  type: "analyze"
  workspaceDir: string
  files?: string[]
}

interface AnalyzeResult {
  type: "result"
  files: FileInfo[]
  layers: Record<string, number>
  domains: DomainInfo[]
  timestamp: string
}

interface FileInfo {
  path: string
  language: string
  layer: string
  imports: string[]
  exports: string[]
  functions: string[]
  classes: string[]
}

interface DomainInfo {
  name: string
  fileCount: number
  layer: string
}

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".architecture", "dist", "build", 
  "__pycache__", ".next", ".venv", "venv", ".cache"
])

const EXTENSIONS: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", 
  ".jsx": "jsx", ".py": "python", ".go": "go", ".rs": "rust"
}

const LAYER_PATTERNS: [RegExp, string][] = [
  [/\/(api|routes|handlers|controllers)\//i, "api"],
  [/\/(services?|usecases?)\//i, "service"],
  [/\/(models?|entities|schemas?|types?)\//i, "model"],
  [/\/(utils?|helpers?|lib)\//i, "util"],
  [/\/(components?|views?|pages?|ui)\//i, "ui"],
  [/\/(config|settings)\//i, "config"],
  [/\/(tests?|__tests__|spec)\//i, "test"],
]

async function collectFiles(dir: string, base: string = dir): Promise<string[]> {
  const files: string[] = []
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name)) continue
      
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        files.push(...await collectFiles(fullPath, base))
      } else {
        const ext = extname(entry.name)
        if (EXTENSIONS[ext]) {
          files.push(fullPath.replace(base + "/", ""))
        }
      }
    }
  } catch {}
  
  return files
}

function detectLayer(path: string): string {
  for (const [pattern, layer] of LAYER_PATTERNS) {
    if (pattern.test("/" + path)) return layer
  }
  return "other"
}

async function analyzeFile(workspaceDir: string, relativePath: string): Promise<FileInfo | null> {
  try {
    const fullPath = join(workspaceDir, relativePath)
    const content = await readFile(fullPath, "utf-8")
    const ext = extname(relativePath)
    
    const imports: string[] = []
    const exports: string[] = []
    const functions: string[] = []
    const classes: string[] = []
    
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
    for (const m of importMatches) imports.push(m[1])
    
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g)
    for (const m of exportMatches) exports.push(m[1])
    
    const funcMatches = content.matchAll(/(?:async\s+)?function\s+(\w+)|(\w+)\s*(?::\s*\w+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g)
    for (const m of funcMatches) functions.push(m[1] || m[2])
    
    const classMatches = content.matchAll(/class\s+(\w+)/g)
    for (const m of classMatches) classes.push(m[1])
    
    return {
      path: relativePath,
      language: EXTENSIONS[ext] || "unknown",
      layer: detectLayer(relativePath),
      imports: imports.filter(Boolean),
      exports: exports.filter(Boolean),
      functions: functions.filter(Boolean),
      classes: classes.filter(Boolean),
    }
  } catch {
    return null
  }
}

function detectDomains(files: FileInfo[]): DomainInfo[] {
  const domainMap = new Map<string, FileInfo[]>()
  const skipDirs = new Set(["src", "lib", "app", "internal", "pkg", "cmd"])
  
  for (const file of files) {
    const parts = file.path.split("/")
    let domain = "root"
    for (const part of parts.slice(0, -1)) {
      if (!skipDirs.has(part) && !part.startsWith("_")) {
        domain = part
        break
      }
    }
    if (!domainMap.has(domain)) domainMap.set(domain, [])
    domainMap.get(domain)!.push(file)
  }
  
  return [...domainMap.entries()]
    .filter(([_, files]) => files.length >= 2)
    .map(([name, files]) => {
      const layerCounts = new Map<string, number>()
      for (const f of files) {
        layerCounts.set(f.layer, (layerCounts.get(f.layer) || 0) + 1)
      }
      const topLayer = [...layerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "other"
      return { name, fileCount: files.length, layer: topLayer }
    })
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 10)
}

self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const { workspaceDir, files: targetFiles } = event.data
  
  const filePaths = targetFiles || await collectFiles(workspaceDir)
  const files: FileInfo[] = []
  
  for (const path of filePaths) {
    const info = await analyzeFile(workspaceDir, path)
    if (info) files.push(info)
  }
  
  const layers: Record<string, number> = {}
  for (const f of files) {
    layers[f.layer] = (layers[f.layer] || 0) + 1
  }
  
  const result: AnalyzeResult = {
    type: "result",
    files,
    layers,
    domains: detectDomains(files),
    timestamp: new Date().toISOString(),
  }
  
  self.postMessage(result)
}
