# Cartograph

[![npm version](https://img.shields.io/npm/v/cartograph.svg)](https://www.npmjs.com/package/cartograph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-blue)](https://github.com/opencode-ai/opencode)
[![CI](https://github.com/cloudshipai/cartograph/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudshipai/cartograph/actions/workflows/ci.yml)

**Visual codebase mapping plugin for OpenCode — auto-generates architecture diagrams as you code**

Cartograph runs silently in the background while you use OpenCode. No commands to run. No tools to invoke. Just install and open the web UI at `http://localhost:3333`.

---

## Quick Install

```bash
bunx @cloudshipai/cartograph install
```

That's it! The installer automatically adds Cartograph to your OpenCode config.

---

## Features

- **Zero Configuration** — Plugin auto-starts a visualization server
- **Live Updates** — Diagrams update in real-time as you (or AI) make changes
- **Mermaid Diagrams** — Architecture, dataflow, sequence, class, state, ER, dependency
- **Interactive UI** — Expand/collapse diagrams, view source, dark theme
- **Multi-Language** — TypeScript, JavaScript, Python, Go

---

## What You'll See

Open `http://localhost:3333` after installing:

| Feature | Description |
|---------|-------------|
| **Architecture Diagrams** | High-level system component visualization |
| **Dataflow Diagrams** | How data moves through your system |
| **Sequence Diagrams** | Interaction flows between components |
| **Live Updates** | Diagrams refresh via WebSocket as code changes |

---

## Installation Options

### Option 1: One-liner (Recommended)

```bash
bunx @cloudshipai/cartograph install
```

### Option 2: Manual Config

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["cartograph"]
}
```

### Option 3: Development Install

```bash
git clone https://github.com/cloudshipai/cartograph.git
cd cartograph
bun install
bun run build
bunx @cloudshipai/cartograph install
```

---

## Usage

Once installed, Cartograph automatically:
1. Starts when you run `opencode`
2. Opens a web UI at `http://localhost:3333`
3. Listens for diagram generation requests

### Example Prompts

Ask the AI to generate diagrams:

```
"Generate an architecture diagram of this codebase"
"Create a sequence diagram for the auth flow"
"Update the dataflow diagram"
"Show me a class diagram of the models"
```

---

## For LLM Agents

If you're an AI assistant helping a user, Cartograph provides these tools:

| Tool | Description |
|------|-------------|
| `diagram_types` | List available diagram types |
| `diagram_generate` | Generate a diagram from description |
| `diagram_update` | Update a diagram with new Mermaid code |
| `diagram_prompt` | Get prompt for generating specific diagram type |

### Step-by-step Installation

```bash
# 1. Install Cartograph
bunx @cloudshipai/cartograph install

# 2. Verify config was updated
cat ~/.config/opencode/opencode.json

# 3. Start OpenCode
opencode

# 4. Verify web UI is running
curl -s http://localhost:3333/api/health
```

---

## Uninstall

```bash
bunx @cloudshipai/cartograph uninstall
```

---

## Configuration

Cartograph works with zero configuration. The plugin uses:

| Setting | Value |
|---------|-------|
| Port | `3333` |
| WebSocket | `ws://localhost:3333` |
| UI | Material Design dark theme |

---

## Supported Diagram Types

| Type | Description |
|------|-------------|
| `architecture` | High-level system components |
| `dataflow` | Data movement between systems |
| `sequence` | Interaction sequences |
| `class` | Class relationships |
| `state` | State machine diagrams |
| `er` | Entity-relationship diagrams |
| `dependency` | Module dependency graphs |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                         OpenCode                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cartograph Plugin                        │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Hooks     │  │   Tools     │  │   Server    │  │   │
│  │  │             │  │             │  │             │  │   │
│  │  │ • ready     │  │ • generate  │  │ • HTTP :3333│  │   │
│  │  │ • shutdown  │  │ • update    │  │ • WebSocket │  │   │
│  │  │ • message   │  │ • types     │  │ • REST API  │  │   │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘  │   │
│  └───────────────────────────────────────────┼──────────┘   │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                    ┌──────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │    Web UI        │
         │  localhost:3333  │
         │                  │
         │  ┌────────────┐  │
         │  │  Mermaid   │  │
         │  │  Diagrams  │  │
         │  └────────────┘  │
         └──────────────────┘
```

1. **Plugin loads** → starts web server on port `3333`
2. **Registers tools** → AI can generate/update diagrams
3. **WebSocket connection** → real-time diagram updates
4. **Mermaid rendering** → diagrams display in browser

---

## Development

```bash
git clone https://github.com/cloudshipai/cartograph.git
cd cartograph
bun install

# Build everything
bun run build

# Development mode
bun run dev        # Watch plugin
bun run dev:web    # Watch web UI

# Run tests
bun test           # All 65 tests
bun test:unit      # Unit tests
bun test:integration  # Integration tests
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide.

---

## Contributing

Contributions welcome! Please read [DEVELOPMENT.md](./DEVELOPMENT.md) first.

---

## License

MIT © [CloudShip AI](https://github.com/cloudshipai)
