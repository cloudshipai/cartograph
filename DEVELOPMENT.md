# Cartograph Development Guide

Visual codebase mapping plugin for OpenCode that auto-generates architecture diagrams.

## Quick Start

```bash
# Install dependencies
bun install

# Build everything (plugin + worker + web UI)
bun run build

# Run tests
bun test

# Development mode (watch)
bun test:watch
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenCode                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Cartograph Plugin                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │  Tools   │  │  Hooks   │  │  Server  │  │ Worker  │ │    │
│  │  │          │  │          │  │  (Bun)   │  │(Analyze)│ │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │    │
│  └───────┼─────────────┼─────────────┼─────────────┼──────┘    │
│          │             │             │             │            │
└──────────┼─────────────┼─────────────┼─────────────┼────────────┘
           │             │             │             │
           ▼             ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ diagram_ │  │ session. │  │ React UI │  │ File     │
    │ update   │  │ compacted│  │ :3333    │  │ Analysis │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Project Structure

```
cartograph/
├── src/
│   ├── index.ts              # Plugin entry - hooks, tools, lifecycle
│   ├── diagrams.ts           # Diagram logic (testable, pure functions)
│   ├── logger.ts             # File-based logging to /tmp/cartograph.log
│   ├── server/
│   │   └── index.ts          # Bun HTTP/WebSocket server
│   └── worker/
│       └── analyzer.worker.ts # Background file analysis worker
├── web/                       # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   └── tailwind.config.js
├── tests/
│   ├── unit/                  # Pure function tests
│   └── integration/           # Server, worker, tools tests
└── dist/                      # Build output
```

## Key Concepts

### Plugin Lifecycle

```typescript
// src/index.ts
const plugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  // 1. Initialize on plugin load
  const { directory, client } = input
  
  // 2. Start server + worker in background
  setImmediate(async () => {
    await loadExistingDiagrams()
    globalServer = new CartographServer(port, architectureDir)
    globalWorker = createWorker()
  })
  
  // 3. Return hooks
  return {
    event: async ({ event }) => { /* handle events */ },
    tool: { /* register tools */ },
  }
}
```

### Event Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `server.instance.disposed` | OpenCode shutdown | Cleanup server/worker |
| `session.compacted` | Context compaction | Trigger diagram update via subtask |
| `experimental.session.compacting` | Before compaction | Inject architecture context |
| `tool.execute.after` | After tool runs | Re-analyze on file changes |

### Tools

| Tool | Description | Used By |
|------|-------------|---------|
| `diagram_types` | List available diagram types | Agent discovery |
| `diagram_context` | Get codebase analysis context | Agent understanding |
| `diagram_update` | Create/update diagram with Mermaid | Agent action |
| `diagram_delete` | Remove a diagram | Agent cleanup |

### Data Flow

```
1. Worker analyzes codebase → analysis.json
2. generateDiagramsFromAnalysis() → auto diagrams
3. Agent calls diagram_update → manual diagrams
4. saveDiagrams() → diagrams.json + WebSocket broadcast
5. React UI receives update → re-renders
```

## Development Workflow

### Adding a New Diagram Type

1. Add to `DIAGRAM_TYPES` in `src/diagrams.ts`:
```typescript
export const DIAGRAM_TYPES = {
  // ... existing types
  newtype: {
    label: "New Type",
    prompt: "Generate a Mermaid diagram for...",
  },
}
```

2. Add category mapping in `mapTypeToCategory()`:
```typescript
export function mapTypeToCategory(type: DiagramType): DiagramCategory {
  const mapping = {
    // ... existing mappings
    newtype: "architecture",
  }
}
```

3. Update tool schema in `src/index.ts`:
```typescript
type: tool.schema
  .enum(["architecture", "dataflow", "sequence", "class", "state", "er", "dependency", "newtype"])
```

4. Add tests in `tests/unit/diagrams.test.ts`

### Adding a New Hook

```typescript
// In src/index.ts hooks object
"hook.name": async (input, output) => {
  // Handle hook
},
```

### Adding a New API Endpoint

```typescript
// In src/server/index.ts fetch handler
if (path === "/api/newendpoint") {
  const data = await doSomething()
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}
```

## Testing

### Test Structure

```
tests/
├── unit/
│   └── diagrams.test.ts      # Pure function tests (fast, no I/O)
└── integration/
    ├── server.test.ts        # HTTP/WebSocket tests
    ├── tools.test.ts         # Tool execution simulation
    └── worker.test.ts        # File analysis tests
```

### Running Tests

```bash
# All tests
bun test

# Unit tests only (fast)
bun test:unit

# Integration tests only
bun test:integration

# Specific file
bun test tests/unit/diagrams.test.ts

# Watch mode
bun test:watch
```

### Writing Tests

**Unit tests** - test pure functions:
```typescript
import { mapTypeToCategory } from "../../src/diagrams"

test("maps architecture to architecture", () => {
  expect(mapTypeToCategory("architecture")).toBe("architecture")
})
```

**Integration tests** - test with real I/O:
```typescript
let tempDir: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "test-"))
})

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

test("server responds", async () => {
  const server = new CartographServer(port, tempDir)
  await server.start()
  const response = await fetch(`http://localhost:${port}/`)
  expect(response.status).toBe(200)
  server.stop()
})
```

## Building

```bash
# Full build (plugin + worker + web)
bun run build

# Plugin only (faster)
bun run build:plugin

# Web UI only
bun run build:web

# Type check
bun run typecheck
```

### Build Output

```
dist/
├── index.js              # Main plugin bundle
├── worker/
│   └── analyzer.worker.js # Worker bundle
└── web/
    ├── index.html
    └── assets/           # Vite-built React app
```

## Debugging

### Logs

Plugin logs to `/tmp/cartograph.log`:
```bash
tail -f /tmp/cartograph.log
```

### Common Issues

**Port in use**
```bash
# Find process using port 3333
lsof -i :3333
# Kill it
kill -9 <PID>
```

**Worker not found**
```bash
# Rebuild worker
bun run build:plugin
```

**WebSocket not connecting**
- Check browser console for errors
- Verify server is running on correct port
- Check CORS headers

## Code Style

### Patterns Used

**Singleton for global resources**:
```typescript
let globalServer: CartographServer | null = null

function getServer(): CartographServer {
  if (!globalServer) throw new Error("Server not initialized")
  return globalServer
}
```

**Extracted pure functions for testability**:
```typescript
// src/diagrams.ts - pure, testable
export function generateDiagramsFromAnalysis(analysis: AnalysisResult): DiagramRecord[]

// src/index.ts - uses the pure function
const diagrams = generateDiagramsFromAnalysis(lastAnalysis)
```

**Type-safe tool definitions**:
```typescript
diagram_update: tool({
  description: "...",
  args: {
    type: tool.schema.enum(["architecture", "dataflow", ...]),
    mermaid: tool.schema.string(),
  },
  execute: async ({ type, mermaid }) => { ... },
}),
```

## Web UI Development

```bash
# Start Vite dev server (hot reload)
cd web && npm run dev

# The dev server proxies /api and /ws to localhost:3333
# So you need the plugin running in OpenCode
```

### Tailwind Theme

Colors defined in `web/tailwind.config.js`:
- `surface-0` through `surface-4` - background scale
- `content-primary/secondary/muted` - text colors
- `accent` - interactive elements
- `layer-*` - architecture layer colors

## Release Checklist

1. Run all tests: `bun test`
2. Build: `bun run build`
3. Test in OpenCode manually
4. Update version in `package.json`
5. Tag release: `git tag v0.1.x`
