import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { join } from "path"
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises"
import { tmpdir } from "os"

describe("Analyzer Worker", () => {
  let tempDir: string
  let workspaceDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cartograph-worker-test-"))
  })

  beforeEach(async () => {
    workspaceDir = join(tempDir, `workspace-${Date.now()}`)
    await mkdir(workspaceDir, { recursive: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  async function createTestFiles(files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(workspaceDir, path)
      await mkdir(join(fullPath, ".."), { recursive: true })
      await writeFile(fullPath, content)
    }
  }

  async function runWorkerAnalysis(targetFiles?: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const workerPath = join(import.meta.dir, "../../dist/worker/analyzer.worker.js")
      const worker = new Worker(workerPath)
      
      worker.onmessage = (event) => {
        worker.terminate()
        resolve(event.data)
      }
      
      worker.onerror = (error) => {
        worker.terminate()
        reject(error)
      }
      
      worker.postMessage({ type: "analyze", workspaceDir, files: targetFiles })
      
      setTimeout(() => {
        worker.terminate()
        reject(new Error("Worker timeout"))
      }, 10000)
    })
  }

  test("analyzes TypeScript files", async () => {
    await createTestFiles({
      "src/index.ts": `
        import { foo } from "./utils"
        export function main() {}
        export class App {}
      `,
      "src/utils.ts": `
        export const foo = () => {}
      `,
    })

    const result = await runWorkerAnalysis()

    expect(result.files.length).toBeGreaterThanOrEqual(2)
    
    const indexFile = result.files.find((f: any) => f.path.includes("index.ts"))
    expect(indexFile).toBeDefined()
    expect(indexFile.language).toBe("typescript")
    expect(indexFile.imports).toContain("./utils")
    expect(indexFile.exports).toContain("main")
    expect(indexFile.classes).toContain("App")
  })

  test("detects layers from path patterns", async () => {
    await createTestFiles({
      "src/api/routes.ts": "export const routes = {}",
      "src/services/user.ts": "export class UserService {}",
      "src/models/user.ts": "export interface User {}",
      "src/utils/helpers.ts": "export const helper = () => {}",
      "src/components/Button.tsx": "export const Button = () => null",
    })

    const result = await runWorkerAnalysis()

    const apiFile = result.files.find((f: any) => f.path.includes("api/"))
    const serviceFile = result.files.find((f: any) => f.path.includes("services/"))
    const modelFile = result.files.find((f: any) => f.path.includes("models/"))
    const utilFile = result.files.find((f: any) => f.path.includes("utils/"))
    const uiFile = result.files.find((f: any) => f.path.includes("components/"))

    expect(apiFile?.layer).toBe("api")
    expect(serviceFile?.layer).toBe("service")
    expect(modelFile?.layer).toBe("model")
    expect(utilFile?.layer).toBe("util")
    expect(uiFile?.layer).toBe("ui")
  })

  test("calculates layer counts", async () => {
    await createTestFiles({
      "src/api/a.ts": "export const a = 1",
      "src/api/b.ts": "export const b = 2",
      "src/services/s.ts": "export const s = 3",
    })

    const result = await runWorkerAnalysis()

    expect(result.layers.api).toBe(2)
    expect(result.layers.service).toBe(1)
  })

  test("detects domains from directory structure", async () => {
    await createTestFiles({
      "src/auth/login.ts": "export const login = () => {}",
      "src/auth/logout.ts": "export const logout = () => {}",
      "src/users/list.ts": "export const listUsers = () => {}",
      "src/users/create.ts": "export const createUser = () => {}",
      "src/users/delete.ts": "export const deleteUser = () => {}",
    })

    const result = await runWorkerAnalysis()

    expect(result.domains.length).toBeGreaterThan(0)
    
    const authDomain = result.domains.find((d: any) => d.name === "auth")
    const usersDomain = result.domains.find((d: any) => d.name === "users")
    
    expect(authDomain?.fileCount).toBe(2)
    expect(usersDomain?.fileCount).toBe(3)
  })

  test("ignores node_modules and other excluded directories", async () => {
    await createTestFiles({
      "src/index.ts": "export const main = () => {}",
      "node_modules/lodash/index.js": "module.exports = {}",
      ".git/config": "fake git config",
      "dist/bundle.js": "bundled code",
    })

    const result = await runWorkerAnalysis()

    const hasNodeModules = result.files.some((f: any) => f.path.includes("node_modules"))
    const hasGit = result.files.some((f: any) => f.path.includes(".git"))
    const hasDist = result.files.some((f: any) => f.path.includes("dist"))

    expect(hasNodeModules).toBe(false)
    expect(hasGit).toBe(false)
    expect(hasDist).toBe(false)
  })

  test("handles incremental analysis with specific files", async () => {
    await createTestFiles({
      "src/a.ts": "export const a = 1",
      "src/b.ts": "export const b = 2",
      "src/c.ts": "export const c = 3",
    })

    const result = await runWorkerAnalysis(["src/a.ts", "src/b.ts"])

    expect(result.files).toHaveLength(2)
    expect(result.files.some((f: any) => f.path === "src/a.ts")).toBe(true)
    expect(result.files.some((f: any) => f.path === "src/b.ts")).toBe(true)
    expect(result.files.some((f: any) => f.path === "src/c.ts")).toBe(false)
  })

  test("extracts function names correctly", async () => {
    await createTestFiles({
      "src/functions.ts": `
        function regularFunction() {}
        async function asyncFunction() {}
        const arrowFunction = () => {}
        const asyncArrow = async () => {}
        export function exportedFunc() {}
      `,
    })

    const result = await runWorkerAnalysis()
    const file = result.files.find((f: any) => f.path.includes("functions.ts"))

    expect(file.functions).toContain("regularFunction")
    expect(file.functions).toContain("asyncFunction")
    expect(file.functions).toContain("arrowFunction")
    expect(file.functions).toContain("exportedFunc")
  })

  test("extracts class names correctly", async () => {
    await createTestFiles({
      "src/classes.ts": `
        class SimpleClass {}
        export class ExportedClass {}
        class ExtendedClass extends SimpleClass {}
      `,
    })

    const result = await runWorkerAnalysis()
    const file = result.files.find((f: any) => f.path.includes("classes.ts"))

    expect(file.classes).toContain("SimpleClass")
    expect(file.classes).toContain("ExportedClass")
    expect(file.classes).toContain("ExtendedClass")
  })

  test("returns timestamp in result", async () => {
    await createTestFiles({
      "src/index.ts": "export const x = 1",
    })

    const result = await runWorkerAnalysis()

    expect(result.timestamp).toBeDefined()
    expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0)
  })

  test("handles empty workspace", async () => {
    const emptyDir = join(tempDir, "empty-workspace")
    await mkdir(emptyDir, { recursive: true })
    
    const originalWorkspace = workspaceDir
    workspaceDir = emptyDir
    
    const result = await runWorkerAnalysis()
    
    workspaceDir = originalWorkspace
    
    expect(result.files).toHaveLength(0)
    expect(result.layers).toEqual({})
    expect(result.domains).toHaveLength(0)
  })
})
