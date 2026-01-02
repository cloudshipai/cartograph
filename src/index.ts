// Top-level logging - if this doesn't appear, the module isn't being imported at all
console.log("[cartograph] ========================================");
console.log("[cartograph] Module file loaded at top level");
console.log("[cartograph] ========================================");

import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import { CodeAnalyzer } from "./analyzer/treesitter"
import { MdxGenerator } from "./generator/mdx"
import { CartographServer } from "./server"
import { join, relative, isAbsolute } from "path"

function openBrowser(url: string) {
  try {
    const platform = process.platform
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
    Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" })
  } catch {
    // Ignore - browser opening is best-effort (may fail in Docker/headless)
  }
}

interface CartographState {
  analyzer: CodeAnalyzer
  generator: MdxGenerator
  server: CartographServer
  lastAnalysis: Date | null
  recentChanges: Set<string>
}

const FILE_MODIFYING_TOOLS = ["write", "Write", "edit", "Edit", "bash", "Bash", "MultiEdit"]
const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"])

// Store tool args by callID to retrieve in after hook
const pendingToolCalls = new Map<string, unknown>()

/**
 * Extract file paths from tool params. Returns empty array for bash commands
 * that might modify files (triggers full reanalysis since we can't know which files).
 */
function extractFilePaths(toolName: string, input: unknown, workspaceDir: string): string[] {
  const paths: string[] = []
  
  try {
    const params = typeof input === 'string' ? JSON.parse(input) : input
    
    if (params?.filePath) {
      paths.push(params.filePath)
    }
    
    if (Array.isArray(params?.edits)) {
      for (const edit of params.edits) {
        if (edit?.filePath) paths.push(edit.filePath)
      }
    }
    
    if (toolName.toLowerCase().includes('bash') && params?.command) {
      const cmd = params.command
      const fileOps = /(?:touch|>|>>|mv|cp)\s+|git\s+(?:checkout|reset|stash\s+pop)/
      if (fileOps.test(cmd)) return []
    }
  } catch {
    return []
  }
  
  return paths
    .map(p => isAbsolute(p) ? relative(workspaceDir, p) : p)
    .filter(p => {
      const ext = p.substring(p.lastIndexOf('.'))
      return SUPPORTED_EXTENSIONS.has(ext) && !p.startsWith('..')
    })
}

const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  console.log("[cartograph] Plugin function called")
  const { directory } = input
  const workspaceDir = directory
  const architectureDir = join(workspaceDir, ".architecture")
  const port = 3333

  console.log(`[cartograph] Workspace: ${workspaceDir}`)
  console.log(`[cartograph] Architecture dir: ${architectureDir}`)

  const state: CartographState = {
    analyzer: new CodeAnalyzer(workspaceDir),
    generator: new MdxGenerator(architectureDir),
    server: new CartographServer(port, architectureDir),
    lastAnalysis: null,
    recentChanges: new Set(),
  }

  await Bun.write(join(architectureDir, ".gitkeep"), "")

  await state.server.start()
  console.log(`[cartograph] Ready at http://localhost:${port}`)

  setImmediate(async () => {
    try {
      const startTime = Date.now()
      const analysis = await state.analyzer.analyze()
      await state.generator.generate(analysis)
      state.lastAnalysis = new Date()
      state.server.broadcastUpdate(analysis)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[cartograph] Analyzed ${analysis.files.length} files in ${elapsed}s`)
    } catch (err) {
      console.error("[cartograph] Analysis failed:", err)
    }
  })

  openBrowser(`http://localhost:${port}`)

  let debounceTimer: Timer | null = null
  const debounceMs = 2000
  let pendingFiles: Set<string> = new Set()

  const triggerReanalysis = async (reason: string, changedFiles?: string[]) => {
    if (changedFiles && changedFiles.length > 0) {
      changedFiles.forEach(f => pendingFiles.add(f))
    }
    
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      const filesToAnalyze = Array.from(pendingFiles)
      pendingFiles = new Set()
      
      const useIncremental = filesToAnalyze.length > 0 && filesToAnalyze.length <= 20
      
      if (useIncremental) {
        console.log(`[cartograph] Incremental analysis (${reason}): ${filesToAnalyze.length} files`)
        const analysis = await state.analyzer.analyzeIncremental(filesToAnalyze)
        await state.generator.generate(analysis)
        filesToAnalyze.forEach(f => state.recentChanges.add(f))
      } else {
        console.log(`[cartograph] Full re-analysis (${reason})...`)
        const analysis = await state.analyzer.analyze()
        await state.generator.generate(analysis)
        state.recentChanges.clear()
      }
      
      state.lastAnalysis = new Date()
      const latestAnalysis = await state.analyzer.getLastAnalysis()
      if (latestAnalysis) {
        state.server.broadcastUpdate(latestAnalysis)
      }
    }, debounceMs)
  }

  const hooks: Hooks = {
    event: async ({ event }) => {
      if (event.type === "server.instance.disposed") {
        console.log("[cartograph] Shutting down...")
        if (debounceTimer) clearTimeout(debounceTimer)
        state.server.stop()
        console.log("[cartograph] Shutdown complete")
      }
    },

    "tool.execute.before": async (input, output) => {
      if (FILE_MODIFYING_TOOLS.some(t => input.tool?.includes(t))) {
        pendingToolCalls.set(input.callID, output.args)
      }
    },

    "tool.execute.after": async (input, _output) => {
      if (FILE_MODIFYING_TOOLS.some(t => input.tool?.includes(t))) {
        const args = pendingToolCalls.get(input.callID)
        pendingToolCalls.delete(input.callID)
        
        const changedFiles = extractFilePaths(input.tool || '', args, workspaceDir)
        await triggerReanalysis(`tool: ${input.tool}`, changedFiles)
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      const recentList = Array.from(state.recentChanges).slice(0, 10)
      const recentStr = recentList.length > 0 
        ? `Recently modified: ${recentList.join(', ')}${state.recentChanges.size > 10 ? ` (+${state.recentChanges.size - 10} more)` : ''}`
        : ''
      
      output.context.push(
        `[Cartograph Architecture Context]\n` +
        `Visualization: http://localhost:${port}\n` +
        `Last analysis: ${state.lastAnalysis?.toISOString() || 'pending'}\n` +
        `${recentStr}\n` +
        `See .architecture/graph.json for dependency graph, .architecture/maps/ for layer docs.`
      )
      
      state.recentChanges.clear()
    },

    "chat.message": async (input, _output) => {
      if (input.agent === "user") {
        const timeSinceLastAnalysis = state.lastAnalysis 
          ? Date.now() - state.lastAnalysis.getTime() 
          : Infinity
        
        const TEN_MINUTES = 10 * 60 * 1000
        if (timeSinceLastAnalysis > TEN_MINUTES) {
          await triggerReanalysis("stale analysis (>10min)")
        }
      }
    },
  }

  console.log("[cartograph] Hooks registered, returning")
  return hooks
}

export default plugin
