#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "=== Phase 2: Search Testing ==="
echo ""

echo "1. Search for 'mobile' agents (relevant to React Native):"
echo '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"mobile","type":"agent","limit":5}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result" | head -30

echo ""
echo "2. Search for 'typescript' agents:"
echo '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"typescript","type":"agent","limit":5}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result" | head -30

echo ""
echo "3. Search for 'testing' skills:"
echo '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"testing","type":"skill","limit":5}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result" | head -30

echo ""
echo "4. Get details for a specific agent:"
echo '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"get_agent_details","arguments":{"name":"Expert React Frontend Engineer"}}}' | node dist/mcp-server.js 2>&1 | head -100