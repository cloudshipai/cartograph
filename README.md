# Cartograph

**Visual codebase mapping plugin for OpenCode - auto-generates architecture diagrams as you code**

## What It Does

Cartograph runs silently in the background while you use OpenCode:

1. **Auto-starts** a visualization server at `http://localhost:3333`
2. **Analyzes** your codebase structure, dependencies, and layers
3. **Updates live** as you (or AI) make changes to files
4. **Visualizes** your code as an interactive map

No commands to run. No tools to invoke. Just install and open the web UI.

## Installation

```bash
# In your project
npm install cartograph

# Or add to opencode.json
{
  "plugins": ["cartograph"]
}
```

## What You'll See

Open `http://localhost:3333` after installing:

- **Interactive dependency graph** - nodes are files, edges are imports
- **Layer visualization** - API, Service, Model, UI, etc.
- **Live updates** - graph updates in real-time as code changes
- **Stats dashboard** - file counts, function counts, etc.

## Architecture

```
.architecture/           # Auto-generated (gitignore-able)
├── maps/
│   ├── overview.mdx     # Codebase stats and structure
│   └── layers.mdx       # Layer breakdown
├── graph.json           # Dependency graph data
└── manifest.json        # Metadata
```

## Supported Languages

- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- Python (`.py`)
- Go (`.go`)

## How It Works

1. Plugin loads → starts web server on `:3333`
2. Initial scan using tree-sitter for AST parsing
3. Generates `.architecture/` folder with MDX docs and graph data
4. Watches for file changes via chokidar
5. Re-analyzes on change → pushes update via WebSocket → UI refreshes

## Roadmap

- [ ] Comment system on nodes (→ creates TODOs)
- [ ] Communication flow visualization
- [ ] Package-level view (collapse files into packages)
- [ ] Export to Mermaid/PlantUML
- [ ] Integration with OpenCode agent memory

## License

MIT
