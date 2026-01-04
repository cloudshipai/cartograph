import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { createOpencodeClient } from "@opencode-ai/sdk"
import { tool } from "@opencode-ai/plugin"
import { log, logError } from "./logger"
import { CartographServer } from "./server"
import { join, dirname } from "path"
import { realpathSync, existsSync } from "fs"
import { homedir } from "os"
import {
  DIAGRAM_TYPES,
  generateDiagramsFromAnalysis,
  buildDiagramContext,
  createDiagramRecord,
  mergeDiagrams,
  type DiagramType,
  type DiagramRecord,
  type DiagramSet,
  type AnalysisResult,
} from "./diagrams"

type OpencodeClient = ReturnType<typeof createOpencodeClient>

// Singleton state - prevents multiple initializations
let isInitialized = false
let initializingDirectory: string | null = null

let globalServer: CartographServer | null = null
let globalWorker: Worker | null = null
let globalClient: OpencodeClient | null = null
let lastAnalysis: AnalysisResult | null = null
let currentDiagrams: DiagramSet | null = null
let architectureDir: string = ""
let serverPort: number = 3333

// Max files to analyze (sanity limit)
const MAX_FILES_LIMIT = 10000

/**
 * Validate that the directory is a reasonable project directory
 * Returns error message if invalid, null if valid
 */
function validateDirectory(directory: string): string | null {
  // Check if it's the home directory or a parent of home
  const home = homedir()
  const resolvedDir = realpathSync(directory)
  const resolvedHome = realpathSync(home)
  
  if (resolvedDir === resolvedHome) {
    return `Directory is home directory (${home}). Cartograph only works in project directories.`
  }
  
  // Check if home is inside the directory (meaning directory is a parent of home)
  if (resolvedHome.startsWith(resolvedDir + "/")) {
    return `Directory (${directory}) contains home directory. Cartograph only works in project directories.`
  }
  
  // Check for common project indicators
  const projectIndicators = [
    "package.json",
    "Cargo.toml", 
    "go.mod",
    "pyproject.toml",
    "requirements.txt",
    ".git",
    "Makefile",
    "CMakeLists.txt",
    "pom.xml",
    "build.gradle",
    ".opencode",
  ]
  
  const hasProjectIndicator = projectIndicators.some(indicator => 
    existsSync(join(directory, indicator))
  )
  
  if (!hasProjectIndicator) {
    return `Directory (${directory}) doesn't appear to be a project directory. No package.json, .git, or other project files found.`
  }
  
  return null
}

async function loadExistingDiagrams(): Promise<void> {
  try {
    const diagramsPath = join(architectureDir, "diagrams.json")
    const file = Bun.file(diagramsPath)
    if (await file.exists()) {
      currentDiagrams = await file.json() as DiagramSet
      log(`Loaded ${currentDiagrams.diagrams.length} existing diagrams`)
    }
  } catch (err) {
    logError("Failed to load existing diagrams", err)
  }
}

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
  await Bun.write(diagramsPath, JSON.stringify(diagramSet, null, 2))
  globalServer?.broadcast(JSON.stringify({ type: "update", data: { reason } }))
}



async function triggerDiagramUpdateSubtask(sessionId: string): Promise<void> {
  if (!globalClient) {
    logError("No client for subtask")
    return
  }

  const context = buildDiagramContext(lastAnalysis, currentDiagrams)
  const existingDiagramIds = currentDiagrams?.diagrams.map(d => d.id).join(", ") || "none"
  
  const subtaskPrompt = `Based on our conversation, check if any architecture diagrams need updating.

${context}

Current diagram IDs: ${existingDiagramIds}

If you discussed architectural changes, new components, or data flow patterns that aren't reflected in the diagrams:
1. Generate appropriate Mermaid diagram(s)
2. Call diagram_update tool for each diagram

If no updates needed, just respond briefly that diagrams are current.`

  try {
    log(`Triggering diagram update subtask for session ${sessionId}`)
    await globalClient.session.promptAsync({
      path: { id: sessionId },
      body: {
        parts: [{
          type: "subtask",
          prompt: subtaskPrompt,
          description: "Update architecture diagrams based on recent conversation",
          agent: "build",
        }],
      }
    })
    log("Diagram update subtask dispatched")
  } catch (err) {
    logError("Failed to dispatch diagram subtask", err)
  }
}

function createWorker(): Worker {
  const resolvedPluginPath = realpathSync(import.meta.path)
  const pluginDistDir = dirname(resolvedPluginPath)
  const workerPath = join(pluginDistDir, "worker", "analyzer.worker.js")
  log(`Worker path: ${workerPath}`)
  return new Worker(workerPath)
}

function openBrowser(url: string): void {
  const platform = process.platform
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
  Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" })
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const server = Bun.serve({ port, fetch: () => new Response("") })
      server.stop(true)
      return port
    } catch {
      continue
    }
  }
  return startPort
}

function cleanup(): void {
  globalWorker?.terminate()
  globalWorker = null
  globalServer?.stop()
  globalServer = null
  globalClient = null
  isInitialized = false
  initializingDirectory = null
}

const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const { directory, client } = input

  // Singleton guard - prevent multiple initializations
  if (isInitialized && initializingDirectory === directory) {
    log(`Already initialized for ${directory}, returning existing hooks`)
    return createHooks(directory)
  }
  
  if (isInitialized && initializingDirectory !== directory) {
    log(`Already initialized for different directory (${initializingDirectory}), cleaning up first`)
    cleanup()
  }

  const validationError = validateDirectory(directory)
  if (validationError) {
    logError(validationError)
    // Return minimal hooks that do nothing
    return {
      event: async () => {},
      tool: {},
    }
  }

  isInitialized = true
  initializingDirectory = directory
  architectureDir = join(directory, ".architecture")
  globalClient = client
  
  log(`Cartograph initializing for: ${directory}`)

  setImmediate(async () => {
    try {
      await Bun.write(join(architectureDir, ".gitkeep"), "")
      await loadExistingDiagrams()
      
      serverPort = await findAvailablePort(3333)
      globalServer = new CartographServer(serverPort, architectureDir)
      await globalServer.start()
      log(`Server ready at http://localhost:${serverPort}`)
      openBrowser(`http://localhost:${serverPort}`)

      globalWorker = createWorker()
      globalWorker.onmessage = async (event) => {
        const analysis = event.data as AnalysisResult
        
        // Sanity check on file count
        if (analysis.files.length > MAX_FILES_LIMIT) {
          logError(`Analysis returned ${analysis.files.length} files, exceeds limit of ${MAX_FILES_LIMIT}. Skipping.`)
          return
        }
        
        lastAnalysis = analysis
        log(`Analysis complete: ${analysis.files.length} files`)
        
        await Bun.write(
          join(architectureDir, "analysis.json"),
          JSON.stringify(analysis, null, 2)
        )
        
        const autoDiagrams = generateDiagramsFromAnalysis(analysis)
        if (autoDiagrams.length > 0) {
          const existingNonAuto = currentDiagrams?.diagrams.filter(
            d => !d.labels.includes("auto")
          ) || []
          
          const merged = [...autoDiagrams, ...existingNonAuto]
          await saveDiagrams(merged, "analysis")
          log(`Auto-generated ${autoDiagrams.length} diagrams from analysis`)
        }
        
        globalServer?.broadcast(JSON.stringify({ type: "analysis", data: lastAnalysis }))
      }

      globalWorker.postMessage({ type: "analyze", workspaceDir: directory, maxFiles: MAX_FILES_LIMIT })
      log("Initial analysis started in worker")
    } catch (err) {
      logError("Init failed", err)
      cleanup()
    }
  })

  return createHooks(directory)
}

function createHooks(directory: string): Hooks {
  const hooks: Hooks = {
    event: async ({ event }) => {
      if (event.type === "server.instance.disposed") {
        log("Shutting down...")
        cleanup()
      }
      
      if (event.type === "session.compacted") {
        const sessionId = (event as any).properties?.sessionID
        if (sessionId && globalClient) {
          log(`Session ${sessionId} compacted, triggering diagram update`)
          await triggerDiagramUpdateSubtask(sessionId)
        }
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      const context = buildDiagramContext(lastAnalysis, currentDiagrams)
      if (context) {
        output.context.push(`[Cartograph Architecture]\n${context}\nView: http://localhost:${serverPort}`)
      }
    },

    "tool.execute.after": async (input, _output) => {
      const fileModifyingTools = ["write", "Write", "edit", "Edit", "MultiEdit"]
      if (fileModifyingTools.some(t => input.tool?.includes(t)) && globalWorker) {
        const args = typeof _output.metadata === "object" ? _output.metadata : {}
        const filePath = (args as any)?.filePath
        if (filePath) {
          log(`File changed: ${filePath}, triggering incremental analysis`)
          globalWorker.postMessage({ 
            type: "analyze", 
            workspaceDir: directory,
            files: [filePath],
            maxFiles: MAX_FILES_LIMIT,
          })
        }
      }
    },

    tool: {
      diagram_types: tool({
        description: "List available diagram types and current diagrams",
        args: {},
        execute: async () => {
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
            viewUrl: `http://localhost:${serverPort}`,
            analysisReady: !!lastAnalysis,
          })
        },
      }),

      diagram_context: tool({
        description: "Get current codebase context for diagram generation. Use this to understand the codebase structure before generating diagrams.",
        args: {},
        execute: async () => {
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
            viewUrl: `http://localhost:${serverPort}`,
          })
        },
      }),

      diagram_update: tool({
        description: "Create or update a diagram. The agent should generate the Mermaid syntax based on codebase understanding.",
        args: {
          type: tool.schema
            .enum(["architecture", "dataflow", "sequence", "class", "state", "er", "dependency"])
            .describe("Diagram type"),
          mermaid: tool.schema.string().describe("Mermaid diagram syntax"),
          description: tool.schema.string().optional().describe("What this diagram shows"),
        },
        execute: async ({ type, mermaid, description }) => {
          const diagramType = type as DiagramType
          const newDiagram = createDiagramRecord(diagramType, mermaid, description)
          const existingDiagrams = currentDiagrams?.diagrams || []
          const merged = mergeDiagrams(newDiagram, existingDiagrams)
          
          await saveDiagrams(merged, "update")

          return JSON.stringify({ 
            success: true, 
            type: diagramType,
            totalDiagrams: merged.length,
            message: `Diagram updated - view at http://localhost:${serverPort}`,
          })
        },
      }),

      diagram_delete: tool({
        description: "Delete a diagram by ID",
        args: {
          id: tool.schema.string().describe("Diagram ID to delete"),
        },
        execute: async ({ id }) => {
          const existingDiagrams = currentDiagrams?.diagrams || []
          const filtered = existingDiagrams.filter(d => d.id !== id)
          
          if (filtered.length === existingDiagrams.length) {
            return JSON.stringify({ success: false, error: `Diagram '${id}' not found` })
          }
          
          await saveDiagrams(filtered, "delete")
          return JSON.stringify({ success: true, deleted: id })
        },
      }),
    },
  }

  log("Hooks registered")
  return hooks
}

export default plugin
