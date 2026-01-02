# Cartograph

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-blue)](https://github.com/opencode-ai/opencode)

**Visual codebase mapping plugin for OpenCode — auto-generates architecture diagrams as you code**

Cartograph runs silently in the background while you use OpenCode. No commands to run. No tools to invoke. Just install and open the web UI at `http://localhost:3333`.

---

## Features

- **Zero Configuration** — Plugin auto-starts a visualization server
- **Live Updates** — Graph updates in real-time as you (or AI) make changes
- **Interactive Graph** — Nodes are files, edges are imports/dependencies
- **Layer Detection** — Automatically identifies API, Service, Model, UI layers
- **Multi-Language** — TypeScript, JavaScript, Python, Go

---

## Installation

### Option 1: From npm (Recommended)

```bash
npm install -g cartograph
```

Then add to your project's `opencode.json`:

```json
{
  "plugins": ["cartograph"]
}
```

### Option 2: Local Plugin File

```bash
# Create plugin directory
mkdir -p ~/.config/opencode/plugin

# Download the plugin
curl -L -o ~/.config/opencode/plugin/cartograph.js \
  https://github.com/cloudshipai/cartograph/releases/latest/download/cartograph.js
```

OpenCode auto-discovers plugins in `~/.config/opencode/plugin/`.

### Option 3: Development Install

```bash
git clone https://github.com/cloudshipai/cartograph.git
cd cartograph
bun install
bun run build

# Link for development
ln -s $(pwd)/dist/index.js ~/.config/opencode/plugin/cartograph.js
```

---

## For LLM Agents

If you're an AI assistant helping a user install Cartograph, follow these steps:

### Step 1: Check if OpenCode is installed

```bash
opencode --version
```

### Step 2: Install Cartograph

```bash
npm install -g cartograph
```

### Step 3: Add to project config

Create or update `opencode.json` in the project root:

```json
{
  "plugins": ["cartograph"]
}
```

### Step 4: Restart OpenCode

The plugin will auto-start when OpenCode launches. Open `http://localhost:3333` to view the architecture visualization.

### Step 5: Verify installation

```bash
curl -s http://localhost:3333/api/graph | head -c 100
```

If successful, you'll see JSON graph data.

---

## What You'll See

Open `http://localhost:3333` after installing:

| Feature | Description |
|---------|-------------|
| **Dependency Graph** | Interactive visualization of file imports/exports |
| **Layer View** | Color-coded by architectural layer (API, Service, Model, etc.) |
| **Live Updates** | Graph refreshes via WebSocket as code changes |
| **Stats Dashboard** | File counts, function counts, dependency metrics |

---

## Generated Files

Cartograph creates an `.architecture/` folder in your project:

```
.architecture/           # Auto-generated (add to .gitignore if desired)
├── maps/
│   ├── overview.mdx     # Codebase stats and structure
│   └── layers.mdx       # Layer breakdown
├── graph.json           # Dependency graph data
└── manifest.json        # Metadata
```

---

## Supported Languages

| Language | Extensions |
|----------|------------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx` |
| Python | `.py` |
| Go | `.go` |

---

## How It Works

1. **Plugin loads** → starts web server on port `3333`
2. **Initial scan** → regex-based parsing for imports, exports, functions, classes
3. **Generates artifacts** → `.architecture/` folder with MDX docs and graph data
4. **Hooks OpenCode events** → `tool.execute.after`, `chat.message`, `session.compacting`
5. **Incremental updates** → re-analyzes changed files, pushes via WebSocket
6. **Context injection** → injects architecture summary during session compaction

---

## Configuration

Cartograph works with zero configuration, but you can customize via `opencode.json`:

```json
{
  "plugins": ["cartograph"],
  "cartograph": {
    "port": 3333,
    "outputDir": ".architecture",
    "exclude": ["node_modules", "dist", ".git"]
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `port` | `3333` | Web UI port |
| `outputDir` | `.architecture` | Where to write graph data |
| `exclude` | `["node_modules", ...]` | Directories to skip |

---

## Roadmap

- [ ] Comment system on graph nodes (creates TODOs)
- [ ] Communication flow visualization
- [ ] Package-level view (collapse files into packages)
- [ ] Export to Mermaid/PlantUML
- [ ] Integration with OpenCode agent memory

---

## Contributing

```bash
git clone https://github.com/cloudshipai/cartograph.git
cd cartograph
bun install
bun run dev        # Watch mode for plugin
bun run dev:web    # Watch mode for web UI
```

---

## License

MIT © [CloudShip AI](https://github.com/cloudshipai)
