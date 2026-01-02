import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const logFile = path.join(os.tmpdir(), "cartograph.log")

export function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString()
    const logEntry = data 
      ? `[${timestamp}] [cartograph] ${message} ${JSON.stringify(data)}\n`
      : `[${timestamp}] [cartograph] ${message}\n`
    fs.appendFileSync(logFile, logEntry)
  } catch {
  }
}

export function logError(message: string, error?: unknown): void {
  try {
    const timestamp = new Date().toISOString()
    const errorStr = error instanceof Error ? error.message : String(error)
    const logEntry = `[${timestamp}] [cartograph] ERROR: ${message} ${errorStr}\n`
    fs.appendFileSync(logFile, logEntry)
  } catch {
  }
}

export function getLogFilePath(): string {
  return logFile
}
