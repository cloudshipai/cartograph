/**
 * Cartograph - Visual Codebase Mapping for OpenCode
 * 
 * This plugin runs entirely in the background:
 * 1. On load: starts web server on :3333, does initial codebase scan
 * 2. On file changes: re-analyzes and pushes updates via WebSocket
 * 3. User visits localhost:3333 to see live visualization
 */

import type { Plugin } from "@opencode-ai/plugin"
import { CodeAnalyzer } from "./analyzer/treesitter"
import { MdxGenerator } from "./generator/mdx"
import { CartographServer } from "./server"
import { watch } from "chokidar"
import { join } from "path"

function openBrowser(url: string) {
  const platform = process.platform
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
  Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" })
}

interface CartographState {
  analyzer: CodeAnalyzer
  generator: MdxGenerator
  server: CartographServer
  watcher: ReturnType<typeof watch> | null
}

const CartographPlugin: Plugin = async (ctx) => {
  const workspaceDir = ctx.directory
  const architectureDir = join(workspaceDir, ".architecture")
  const port = 3333

  // Initialize components
  const state: CartographState = {
    analyzer: new CodeAnalyzer(workspaceDir),
    generator: new MdxGenerator(architectureDir),
    server: new CartographServer(port, architectureDir),
    watcher: null,
  }

  // Ensure .architecture directory exists
  await Bun.write(join(architectureDir, ".gitkeep"), "")

  // Initial analysis
  console.log("[cartograph] Starting initial codebase analysis...")
  const analysis = await state.analyzer.analyze()
  await state.generator.generate(analysis)
  console.log("[cartograph] Initial analysis complete")

  await state.server.start()
  console.log(`[cartograph] Visualization running at http://localhost:${port}`)

  openBrowser(`http://localhost:${port}`)

  // Watch for file changes
  const ignorePatterns = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.architecture/**",
    "**/dist/**",
    "**/build/**",
  ]

  state.watcher = watch(workspaceDir, {
    ignored: ignorePatterns,
    persistent: true,
    ignoreInitial: true,
  })

  // Debounce re-analysis
  let debounceTimer: Timer | null = null
  const debounceMs = 1000

  const triggerReanalysis = async () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      console.log("[cartograph] File change detected, re-analyzing...")
      const analysis = await state.analyzer.analyze()
      await state.generator.generate(analysis)
      state.server.broadcastUpdate(analysis)
    }, debounceMs)
  }

  state.watcher
    .on("add", triggerReanalysis)
    .on("change", triggerReanalysis)
    .on("unlink", triggerReanalysis)

  // Return plugin hooks
  return {
    // Re-analyze after any tool execution that might modify files
    "tool.execute.after": async (input, output) => {
      const modifyingTools = ["write", "edit", "bash", "Write", "Edit"]
      if (modifyingTools.some(t => input.tool?.includes(t))) {
        await triggerReanalysis()
      }
    },

    // Cleanup on shutdown
    cleanup: async () => {
      if (state.watcher) await state.watcher.close()
      state.server.stop()
      console.log("[cartograph] Shutdown complete")
    },
  }
}

export default CartographPlugin
