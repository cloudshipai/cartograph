#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { homedir } from "os"
import { spawnSync } from "child_process"

const PLUGIN_NAME = "@cloudshipai/cartograph"
const CONFIG_PATHS = [
  join(homedir(), ".config", "opencode", "opencode.json"),
  join(homedir(), ".opencode", "opencode.json"),
]

function findConfigPath(): string | null {
  for (const path of CONFIG_PATHS) {
    if (existsSync(path)) return path
  }
  return null
}

function ensureConfigDir(configPath: string): void {
  const dir = join(configPath, "..")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function loadConfig(configPath: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"))
  } catch {
    return {}
  }
}

function saveConfig(configPath: string, config: Record<string, unknown>): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
}

function addPlugin(pluginEntry: string): void {
  let configPath = findConfigPath()
  
  if (!configPath) {
    configPath = CONFIG_PATHS[0]
    ensureConfigDir(configPath)
    console.log(`📁 Creating config at ${configPath}`)
  } else {
    console.log(`📁 Found config at ${configPath}`)
  }
  
  const config = loadConfig(configPath)
  let plugins: string[] = Array.isArray(config.plugin) ? config.plugin : []
  
  // Remove any existing cartograph entries (both npm and local paths)
  plugins = plugins.filter(p => 
    p !== PLUGIN_NAME && 
    !p.includes("cartograph/dist/index.js")
  )
  
  plugins.push(pluginEntry)
  config.plugin = plugins
  
  saveConfig(configPath, config)
  
  return
}

function install(): void {
  console.log("\n🗺️  Cartograph - Visual Codebase Mapping for OpenCode\n")
  
  addPlugin(PLUGIN_NAME)
  
  console.log(`✅ Added ${PLUGIN_NAME} to plugins\n`)
  printUsage()
}

function dev(): void {
  console.log("\n🗺️  Cartograph - Dev Install\n")
  
  // Find the cartograph repo root (where package.json is)
  let repoRoot = process.cwd()
  
  // Check if we're in the cartograph repo
  const packageJsonPath = join(repoRoot, "package.json")
  if (!existsSync(packageJsonPath)) {
    console.log("❌ Run this command from the cartograph repository root\n")
    console.log("   cd /path/to/cartograph")
    console.log("   bun run cli.ts dev\n")
    return
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
  if (packageJson.name !== "@cloudshipai/cartograph") {
    console.log("❌ Not in the cartograph repository\n")
    return
  }
  
  // Build the plugin
  console.log("🔨 Building plugin...")
  const buildResult = spawnSync("bun", ["run", "build"], { 
    cwd: repoRoot, 
    stdio: "inherit" 
  })
  
  if (buildResult.status !== 0) {
    console.log("❌ Build failed\n")
    return
  }
  
  // Get absolute path to dist/index.js
  const distPath = resolve(repoRoot, "dist", "index.js")
  
  if (!existsSync(distPath)) {
    console.log(`❌ Built file not found at ${distPath}\n`)
    return
  }
  
  addPlugin(distPath)
  
  console.log(`✅ Linked local dev version\n`)
  console.log(`📍 Plugin path: ${distPath}\n`)
  console.log("💡 Tips:")
  console.log("   • Run 'bun run build' after making changes")
  console.log("   • Restart opencode to pick up changes")
  console.log("   • Run 'bunx @cloudshipai/cartograph install' to switch back to npm version\n")
}

function uninstall(): void {
  console.log("\n🗺️  Cartograph - Uninstalling...\n")
  
  const configPath = findConfigPath()
  
  if (!configPath) {
    console.log("❌ No OpenCode config found\n")
    return
  }
  
  const config = loadConfig(configPath)
  let plugins: string[] = Array.isArray(config.plugin) ? config.plugin : []
  
  const hadPlugin = plugins.some(p => 
    p === PLUGIN_NAME || p.includes("cartograph/dist/index.js")
  )
  
  if (!hadPlugin) {
    console.log(`✅ ${PLUGIN_NAME} is not installed\n`)
    return
  }
  
  // Remove both npm and local versions
  config.plugin = plugins.filter(p => 
    p !== PLUGIN_NAME && !p.includes("cartograph/dist/index.js")
  )
  saveConfig(configPath, config)
  
  console.log(`✅ Removed cartograph from plugins\n`)
}

function printUsage(): void {
  console.log("🚀 Getting Started:")
  console.log("   1. Run 'opencode' in any project directory")
  console.log("   2. Cartograph will auto-open at http://localhost:3333")
  console.log("   3. Ask the AI to generate architecture diagrams\n")
  console.log("💡 Example prompts:")
  console.log('   "Generate an architecture diagram of this codebase"')
  console.log('   "Create a sequence diagram for the auth flow"')
  console.log('   "Update the data flow diagram"\n')
}

function printHelp(): void {
  console.log(`
🗺️  Cartograph - Visual Codebase Mapping for OpenCode

Usage:
  cartograph install     Add cartograph to OpenCode plugins (from npm)
  cartograph dev         Link local dev version (run from repo root)
  cartograph uninstall   Remove cartograph from OpenCode plugins
  cartograph help        Show this help message

Quick Install (npm):
  bunx @cloudshipai/cartograph install

Dev Install (local):
  cd /path/to/cartograph
  bun src/cli.ts dev

After installation, start OpenCode in any project:
  opencode

Cartograph will automatically:
  • Open a web UI at http://localhost:3333
  • Analyze your codebase structure
  • Generate architecture diagrams on request
`)
}

const command = process.argv[2]

switch (command) {
  case "install":
    install()
    break
  case "dev":
    dev()
    break
  case "uninstall":
    uninstall()
    break
  case "help":
  case "--help":
  case "-h":
    printHelp()
    break
  default:
    if (command) {
      console.log(`Unknown command: ${command}\n`)
    }
    printHelp()
}
