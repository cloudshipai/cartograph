#!/bin/bash
set -e

echo "=== Cartograph OpenCode Test Container ==="
echo "OPENCODE_WORKSPACE_DIR: ${OPENCODE_WORKSPACE_DIR:-/workspaces}"
echo ""

echo "=== Plugin Check ==="
echo "Looking for plugins in /root/.config/opencode/plugin/:"
ls -la /root/.config/opencode/plugin/ 2>/dev/null || echo "  (directory not found)"
echo ""

echo "=== Web UI Check ==="
if [ -d "/root/.config/opencode/plugin/web" ]; then
  echo "Web UI directory exists:"
  ls -la /root/.config/opencode/plugin/web/ | head -5
else
  echo "Warning: Web UI directory not found!"
fi
echo ""

echo "=== Config Check ==="
echo "OpenCode config (/root/.config/opencode/opencode.json):"
cat /root/.config/opencode/opencode.json 2>/dev/null || echo "  (no config file)"
echo ""

echo "=== Bun Check ==="
bun --version || echo "Bun not available!"
echo ""

echo "=== Sample Project Check ==="
echo "Workspace contents:"
ls -la /workspaces/sample-project/ 2>/dev/null || echo "  (empty or not mounted)"
echo ""

echo "=== Testing Plugin Import with Bun ==="
echo "Attempting to import the plugin directly with Bun to check for errors:"
bun -e "import('/root/.config/opencode/plugin/cartograph-plugin.js').then(m => console.log('Plugin loaded successfully:', Object.keys(m))).catch(e => console.error('Plugin import failed:', e))" 2>&1 || echo "Bun import test failed"
echo ""

echo "=== Starting OpenCode server ==="
echo "Command: opencode serve --port 4096 --hostname 0.0.0.0 --print-logs --log-level DEBUG"
exec opencode serve --port 4096 --hostname 0.0.0.0 --print-logs --log-level DEBUG
