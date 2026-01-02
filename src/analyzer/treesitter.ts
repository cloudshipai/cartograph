/**
 * Code Analyzer using tree-sitter for AST parsing
 * Detects: imports, exports, functions, classes, and their relationships
 */

import { readdir, readFile } from "fs/promises"
import { join, extname, relative } from "path"

export interface FileAnalysis {
  path: string
  relativePath: string
  language: string
  imports: ImportInfo[]
  exports: ExportInfo[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
}

export interface ImportInfo {
  source: string
  specifiers: string[]
  isRelative: boolean
}

export interface ExportInfo {
  name: string
  type: "function" | "class" | "variable" | "default"
}

export interface FunctionInfo {
  name: string
  line: number
  params: string[]
  isAsync: boolean
  isExported: boolean
}

export interface ClassInfo {
  name: string
  line: number
  methods: string[]
  isExported: boolean
}

export interface CodebaseAnalysis {
  timestamp: Date
  files: FileAnalysis[]
  dependencyGraph: Map<string, string[]>
  layerMap: Map<string, string>
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".architecture",
  "dist",
  "build",
  "__pycache__",
  ".next",
  ".venv",
  "venv",
])

export class CodeAnalyzer {
  private lastAnalysis: CodebaseAnalysis | null = null
  private fileCache: Map<string, FileAnalysis> = new Map()

  constructor(private workspaceDir: string) {}

  async analyze(): Promise<CodebaseAnalysis> {
    const files = await this.collectFiles()
    const analyses: FileAnalysis[] = []

    for (const filePath of files) {
      try {
        const analysis = await this.analyzeFile(filePath)
        if (analysis) {
          analyses.push(analysis)
          this.fileCache.set(analysis.relativePath, analysis)
        }
      } catch (e) {
        console.warn(`[cartograph] Failed to analyze ${filePath}:`, e)
      }
    }

    const dependencyGraph = this.buildDependencyGraph(analyses)
    const layerMap = this.detectLayers(analyses)

    this.lastAnalysis = {
      timestamp: new Date(),
      files: analyses,
      dependencyGraph,
      layerMap,
    }

    return this.lastAnalysis
  }

  async analyzeIncremental(changedPaths: string[]): Promise<CodebaseAnalysis> {
    for (const relativePath of changedPaths) {
      const fullPath = join(this.workspaceDir, relativePath)
      try {
        const analysis = await this.analyzeFile(fullPath)
        if (analysis) {
          this.fileCache.set(relativePath, analysis)
        } else {
          this.fileCache.delete(relativePath)
        }
      } catch {
        this.fileCache.delete(relativePath)
      }
    }

    const analyses = Array.from(this.fileCache.values())
    const dependencyGraph = this.buildDependencyGraph(analyses)
    const layerMap = this.detectLayers(analyses)

    this.lastAnalysis = {
      timestamp: new Date(),
      files: analyses,
      dependencyGraph,
      layerMap,
    }

    return this.lastAnalysis
  }

  getLastAnalysis(): CodebaseAnalysis | null {
    return this.lastAnalysis
  }

  private async collectFiles(dir: string = this.workspaceDir): Promise<string[]> {
    const files: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          files.push(...await this.collectFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (LANGUAGE_EXTENSIONS[ext]) {
          files.push(fullPath)
        }
      }
    }

    return files
  }

  private async analyzeFile(filePath: string): Promise<FileAnalysis | null> {
    const ext = extname(filePath)
    const language = LANGUAGE_EXTENSIONS[ext]
    if (!language) return null

    const content = await readFile(filePath, "utf-8")
    const relativePath = relative(this.workspaceDir, filePath)

    // Parse based on language
    const imports = this.parseImports(content, language)
    const exports = this.parseExports(content, language)
    const functions = this.parseFunctions(content, language)
    const classes = this.parseClasses(content, language)

    return {
      path: filePath,
      relativePath,
      language,
      imports,
      exports,
      functions,
      classes,
    }
  }

  private parseImports(content: string, language: string): ImportInfo[] {
    const imports: ImportInfo[] = []

    if (language === "typescript" || language === "tsx" || language === "javascript" || language === "jsx") {
      // ES6 imports: import { x, y } from "module"
      const es6Regex = /import\s+(?:(?:\{([^}]+)\})|(?:(\w+)))\s+from\s+["']([^"']+)["']/g
      let match
      while ((match = es6Regex.exec(content)) !== null) {
        const specifiers = match[1]
          ? match[1].split(",").map(s => s.trim().split(" as ")[0])
          : match[2] ? [match[2]] : []
        const source = match[3]
        imports.push({
          source,
          specifiers,
          isRelative: source.startsWith(".") || source.startsWith("/"),
        })
      }

      // CommonJS: const x = require("module")
      const cjsRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\(["']([^"']+)["']\)/g
      while ((match = cjsRegex.exec(content)) !== null) {
        imports.push({
          source: match[2],
          specifiers: [match[1]],
          isRelative: match[2].startsWith(".") || match[2].startsWith("/"),
        })
      }
    } else if (language === "python") {
      // Python imports: from x import y, import x
      const fromImportRegex = /from\s+([\w.]+)\s+import\s+([^#\n]+)/g
      let match
      while ((match = fromImportRegex.exec(content)) !== null) {
        const specifiers = match[2].split(",").map(s => s.trim().split(" as ")[0])
        imports.push({
          source: match[1],
          specifiers,
          isRelative: match[1].startsWith("."),
        })
      }

      const importRegex = /^import\s+([\w.]+)/gm
      while ((match = importRegex.exec(content)) !== null) {
        imports.push({
          source: match[1],
          specifiers: [match[1].split(".").pop() || match[1]],
          isRelative: false,
        })
      }
    } else if (language === "go") {
      // Go imports: import "pkg" or import ( "pkg1" "pkg2" )
      const singleImportRegex = /import\s+"([^"]+)"/g
      const multiImportRegex = /import\s+\(([\s\S]*?)\)/g
      
      let match
      while ((match = singleImportRegex.exec(content)) !== null) {
        imports.push({
          source: match[1],
          specifiers: [match[1].split("/").pop() || match[1]],
          isRelative: match[1].startsWith("."),
        })
      }

      while ((match = multiImportRegex.exec(content)) !== null) {
        const block = match[1]
        const pkgRegex = /"([^"]+)"/g
        let pkgMatch
        while ((pkgMatch = pkgRegex.exec(block)) !== null) {
          imports.push({
            source: pkgMatch[1],
            specifiers: [pkgMatch[1].split("/").pop() || pkgMatch[1]],
            isRelative: pkgMatch[1].startsWith("."),
          })
        }
      }
    }

    return imports
  }

  private parseExports(content: string, language: string): ExportInfo[] {
    const exports: ExportInfo[] = []

    if (language === "typescript" || language === "tsx" || language === "javascript" || language === "jsx") {
      // export function/class/const
      const exportRegex = /export\s+(async\s+)?(function|class|const|let|var)\s+(\w+)/g
      let match
      while ((match = exportRegex.exec(content)) !== null) {
        const type = match[2] === "class" ? "class" : match[2] === "function" ? "function" : "variable"
        exports.push({ name: match[3], type })
      }

      // export default
      if (/export\s+default/.test(content)) {
        exports.push({ name: "default", type: "default" })
      }
    } else if (language === "python") {
      // Python: __all__ = ["x", "y"]
      const allMatch = /__all__\s*=\s*\[([^\]]+)\]/
      const match = content.match(allMatch)
      if (match) {
        const names = match[1].match(/["'](\w+)["']/g) || []
        names.forEach(n => {
          exports.push({ name: n.replace(/["']/g, ""), type: "variable" })
        })
      }
    }

    return exports
  }

  private parseFunctions(content: string, language: string): FunctionInfo[] {
    const functions: FunctionInfo[] = []
    const lines = content.split("\n")

    if (language === "typescript" || language === "tsx" || language === "javascript" || language === "jsx") {
      const funcRegex = /(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g
      let match
      while ((match = funcRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length
        functions.push({
          name: match[3],
          line: lineNum,
          params: match[4].split(",").map(p => p.trim()).filter(Boolean),
          isAsync: !!match[2],
          isExported: !!match[1],
        })
      }
    } else if (language === "python") {
      const funcRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm
      let match
      while ((match = funcRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length
        functions.push({
          name: match[2],
          line: lineNum,
          params: match[3].split(",").map(p => p.trim().split(":")[0]).filter(Boolean),
          isAsync: match[0].includes("async"),
          isExported: !match[2].startsWith("_"),
        })
      }
    } else if (language === "go") {
      const funcRegex = /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)/g
      let match
      while ((match = funcRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length
        const name = match[1]
        functions.push({
          name,
          line: lineNum,
          params: match[2].split(",").map(p => p.trim().split(" ")[0]).filter(Boolean),
          isAsync: false,
          isExported: /^[A-Z]/.test(name),
        })
      }
    }

    return functions
  }

  private parseClasses(content: string, language: string): ClassInfo[] {
    const classes: ClassInfo[] = []

    if (language === "typescript" || language === "tsx" || language === "javascript" || language === "jsx") {
      const classRegex = /(export\s+)?class\s+(\w+)/g
      let match
      while ((match = classRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length
        classes.push({
          name: match[2],
          line: lineNum,
          methods: [],
          isExported: !!match[1],
        })
      }
    } else if (language === "python") {
      const classRegex = /^class\s+(\w+)/gm
      let match
      while ((match = classRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length
        classes.push({
          name: match[1],
          line: lineNum,
          methods: [],
          isExported: !match[1].startsWith("_"),
        })
      }
    }

    return classes
  }

  private buildDependencyGraph(files: FileAnalysis[]): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    for (const file of files) {
      const deps: string[] = []
      for (const imp of file.imports) {
        if (imp.isRelative) {
          deps.push(imp.source)
        }
      }
      graph.set(file.relativePath, deps)
    }

    return graph
  }

  private detectLayers(files: FileAnalysis[]): Map<string, string> {
    const layerMap = new Map<string, string>()

    const layerPatterns: [RegExp, string][] = [
      [/\/(api|routes?|handlers?|controllers?)\//, "api"],
      [/\/(services?|usecases?|domain)\//, "service"],
      [/\/(models?|entities?|schemas?)\//, "model"],
      [/\/(utils?|helpers?|lib)\//, "util"],
      [/\/(components?|views?|pages?)\//, "ui"],
      [/\/(tests?|__tests__|specs?)\//, "test"],
      [/\/(config|settings?)\//, "config"],
    ]

    for (const file of files) {
      let layer = "other"
      for (const [pattern, name] of layerPatterns) {
        if (pattern.test(file.relativePath)) {
          layer = name
          break
        }
      }
      layerMap.set(file.relativePath, layer)
    }

    return layerMap
  }
}
