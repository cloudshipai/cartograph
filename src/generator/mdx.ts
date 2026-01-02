/**
 * MDX Generator - Creates architecture documentation files
 */

import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import type { CodebaseAnalysis, FileAnalysis } from "../analyzer/treesitter"

export class MdxGenerator {
  constructor(private architectureDir: string) {}

  async generate(analysis: CodebaseAnalysis): Promise<void> {
    await mkdir(join(this.architectureDir, "maps"), { recursive: true })

    // Generate overview
    await this.generateOverview(analysis)

    // Generate layer map
    await this.generateLayerMap(analysis)

    // Generate dependency graph data
    await this.generateDependencyData(analysis)

    // Generate file manifest for web UI
    await this.generateManifest(analysis)
  }

  private async generateOverview(analysis: CodebaseAnalysis): Promise<void> {
    const stats = this.calculateStats(analysis)

    const content = `---
title: Codebase Overview
generated: ${analysis.timestamp.toISOString()}
---

# Codebase Overview

## Stats

| Metric | Count |
|--------|-------|
| Total Files | ${stats.totalFiles} |
| TypeScript/JavaScript | ${stats.tsFiles} |
| Python | ${stats.pyFiles} |
| Go | ${stats.goFiles} |
| Functions | ${stats.totalFunctions} |
| Classes | ${stats.totalClasses} |
| Exports | ${stats.totalExports} |

## Language Distribution

\`\`\`
${this.generateLanguageBar(stats)}
\`\`\`

## Top-Level Structure

${analysis.files
  .map(f => f.relativePath.split("/")[0])
  .filter((v, i, a) => a.indexOf(v) === i)
  .filter(d => !d.includes("."))
  .map(d => `- \`${d}/\``)
  .join("\n")}
`

    await writeFile(join(this.architectureDir, "maps", "overview.mdx"), content)
  }

  private async generateLayerMap(analysis: CodebaseAnalysis): Promise<void> {
    const layers = new Map<string, FileAnalysis[]>()

    for (const file of analysis.files) {
      const layer = analysis.layerMap.get(file.relativePath) || "other"
      if (!layers.has(layer)) layers.set(layer, [])
      layers.get(layer)!.push(file)
    }

    const content = `---
title: Architecture Layers
generated: ${analysis.timestamp.toISOString()}
---

# Architecture Layers

${Array.from(layers.entries())
  .map(([layer, files]) => `
## ${layer.charAt(0).toUpperCase() + layer.slice(1)} Layer

${files.length} files

${files.slice(0, 10).map(f => `- \`${f.relativePath}\``).join("\n")}
${files.length > 10 ? `\n... and ${files.length - 10} more` : ""}
`)
  .join("\n")}
`

    await writeFile(join(this.architectureDir, "maps", "layers.mdx"), content)
  }

  private async generateDependencyData(analysis: CodebaseAnalysis): Promise<void> {
    // Convert Map to serializable format
    const nodes = analysis.files.map(f => ({
      id: f.relativePath,
      label: f.relativePath.split("/").pop(),
      layer: analysis.layerMap.get(f.relativePath) || "other",
      functions: f.functions.length,
      classes: f.classes.length,
      exports: f.exports.length,
    }))

    const edges: { source: string; target: string }[] = []
    for (const [source, targets] of analysis.dependencyGraph) {
      for (const target of targets) {
        // Resolve relative imports
        const resolved = this.resolveImport(source, target, analysis.files)
        if (resolved) {
          edges.push({ source, target: resolved })
        }
      }
    }

    const data = { nodes, edges, timestamp: analysis.timestamp.toISOString() }
    await writeFile(
      join(this.architectureDir, "graph.json"),
      JSON.stringify(data, null, 2)
    )
  }

  private async generateManifest(analysis: CodebaseAnalysis): Promise<void> {
    const manifest = {
      version: "1.0",
      generated: analysis.timestamp.toISOString(),
      files: {
        overview: "maps/overview.mdx",
        layers: "maps/layers.mdx",
        graph: "graph.json",
      },
      stats: this.calculateStats(analysis),
    }

    await writeFile(
      join(this.architectureDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    )
  }

  private calculateStats(analysis: CodebaseAnalysis) {
    let tsFiles = 0, pyFiles = 0, goFiles = 0
    let totalFunctions = 0, totalClasses = 0, totalExports = 0

    for (const file of analysis.files) {
      if (file.language === "typescript" || file.language === "tsx" || file.language === "javascript" || file.language === "jsx") {
        tsFiles++
      } else if (file.language === "python") {
        pyFiles++
      } else if (file.language === "go") {
        goFiles++
      }

      totalFunctions += file.functions.length
      totalClasses += file.classes.length
      totalExports += file.exports.length
    }

    return {
      totalFiles: analysis.files.length,
      tsFiles,
      pyFiles,
      goFiles,
      totalFunctions,
      totalClasses,
      totalExports,
    }
  }

  private generateLanguageBar(stats: ReturnType<typeof this.calculateStats>): string {
    const total = stats.totalFiles || 1
    const tsPercent = Math.round((stats.tsFiles / total) * 50)
    const pyPercent = Math.round((stats.pyFiles / total) * 50)
    const goPercent = Math.round((stats.goFiles / total) * 50)

    return [
      `TS/JS: ${"█".repeat(tsPercent)}${"░".repeat(50 - tsPercent)} ${stats.tsFiles}`,
      `Python: ${"█".repeat(pyPercent)}${"░".repeat(50 - pyPercent)} ${stats.pyFiles}`,
      `Go:     ${"█".repeat(goPercent)}${"░".repeat(50 - goPercent)} ${stats.goFiles}`,
    ].join("\n")
  }

  private resolveImport(fromFile: string, importPath: string, files: FileAnalysis[]): string | null {
    if (!importPath.startsWith(".")) return null

    const fromDir = fromFile.split("/").slice(0, -1).join("/")
    let resolved = join(fromDir, importPath).replace(/\\/g, "/")

    // Try common extensions
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]
    for (const ext of extensions) {
      const candidate = resolved + ext
      if (files.some(f => f.relativePath === candidate)) {
        return candidate
      }
    }

    return null
  }
}
