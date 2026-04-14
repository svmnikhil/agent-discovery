#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "Testing MCP server..."
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/mcp-server.js 2>&1 | head -5

echo ""
echo "Listing tools..."
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist/mcp-server.js 2>&1 | head -20