#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

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

function install(): void {
  console.log("\n🗺️  Cartograph - Visual Codebase Mapping for OpenCode\n")
  
  let configPath = findConfigPath()
  
  if (!configPath) {
    configPath = CONFIG_PATHS[0]
    ensureConfigDir(configPath)
    console.log(`📁 Creating config at ${configPath}`)
  } else {
    console.log(`📁 Found config at ${configPath}`)
  }
  
  const config = loadConfig(configPath)
  
  const plugins: string[] = Array.isArray(config.plugin) ? config.plugin : []
  
  if (plugins.includes(PLUGIN_NAME)) {
    console.log(`✅ ${PLUGIN_NAME} is already installed!\n`)
    printUsage()
    return
  }
  
  plugins.push(PLUGIN_NAME)
  config.plugin = plugins
  
  saveConfig(configPath, config)
  
  console.log(`✅ Added ${PLUGIN_NAME} to plugins\n`)
  console.log("📝 Updated opencode.json:")
  console.log(`   "plugin": ${JSON.stringify(plugins)}\n`)
  
  printUsage()
}

function uninstall(): void {
  console.log("\n🗺️  Cartograph - Uninstalling...\n")
  
  const configPath = findConfigPath()
  
  if (!configPath) {
    console.log("❌ No OpenCode config found\n")
    return
  }
  
  const config = loadConfig(configPath)
  const plugins: string[] = Array.isArray(config.plugin) ? config.plugin : []
  
  if (!plugins.includes(PLUGIN_NAME)) {
    console.log(`✅ ${PLUGIN_NAME} is not installed\n`)
    return
  }
  
  config.plugin = plugins.filter(p => p !== PLUGIN_NAME)
  saveConfig(configPath, config)
  
  console.log(`✅ Removed ${PLUGIN_NAME} from plugins\n`)
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
  cartograph install     Add cartograph to OpenCode plugins
  cartograph uninstall   Remove cartograph from OpenCode plugins
  cartograph help        Show this help message

Quick Install:
  bunx cartograph install

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
