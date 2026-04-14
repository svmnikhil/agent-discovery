#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "=== Understanding Catalog Types ==="
echo ""

echo "1. Search for all types to understand structure:"
echo '{"jsonrpc":"2.0","id":30,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"react","type":"all","limit":3}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result" | head -40

echo ""
echo "2. Check if skills have a different download path:"
echo '{"jsonrpc":"2.0","id":31,"method":"tools/call","params":{"name":"get_agent_details","arguments":{"name":"Autoresearch"}}}' | node dist/mcp-server.js 2>&1 | head -50

echo ""
echo "3. Check catalog metadata:"
cat .cache/catalog.json | head -100