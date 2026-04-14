#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "=== Phase 3: Download & Use Agent Testing ==="
echo ""

echo "1. Download a TypeScript-focused agent for React Native:"
echo '{"jsonrpc":"2.0","id":20,"method":"tools/call","params":{"name":"download_agent","arguments":{"name":"Expert React Frontend Engineer","targetDir":"'"$HOME/Documents/GitHub/career-tinder"'"}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result"

echo ""
echo "2. Download another agent (testing skills):"
echo '{"jsonrpc":"2.0","id":21,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"autoresearch","type":"skill","limit":1}}}' | node dist/mcp-server.js 2>&1 | head -30

echo ""
echo "3. Download the autoresearch skill:"
echo '{"jsonrpc":"2.0","id":22,"method":"tools/call","params":{"name":"download_agent","arguments":{"name":"Autoresearch","targetDir":"'"$HOME/Documents/GitHub/career-tinder"'"}}}' | node dist/mcp-server.js 2>&1 | grep -A 1000 "result"

echo ""
echo "4. Check what was downloaded:"
ls -la "$HOME/Documents/GitHub/career-tinder/.github/agents/"