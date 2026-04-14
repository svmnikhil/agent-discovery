#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

# Test fetch_catalog
echo "Testing fetch_catalog..."
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fetch_catalog","arguments":{}}}' | node dist/mcp-server.js 2>&1 | head -20

echo ""
echo "Testing search_agents..."
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"react","limit":5}}}' | node dist/mcp-server.js 2>&1 | head -50