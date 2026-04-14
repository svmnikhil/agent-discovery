#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "=== Product Improvement Testing ==="
echo ""

echo "1. Check catalog structure for type information:"
echo '{"jsonrpc":"2.0","id":40,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"react native","type":"all","limit":5}}}' | node dist/mcp-server.js 2>&1 | head -60

echo ""
echo "2. Test downloading with overwrite (for re-downloads):"
echo '{"jsonrpc":"2.0","id":41,"method":"tools/call","params":{"name":"download_agent","arguments":{"name":"Expert React Frontend Engineer","targetDir":"'"$HOME/Documents/GitHub/career-tinder"'}}}' | node dist/mcp-server.js 2>&1 | head -20

echo ""
echo "3. Look at installed agent to see activation instructions:"
head -50 "$HOME/Documents/GitHub/career-tinder/.github/agents/expert-react-frontend-engineer.agent.md"

echo ""
echo "4. Check if there's a way to list installed agents:"
ls -la "$HOME/Documents/GitHub/career-tinder/.github/agents/"

echo ""
echo "5. Search for instructions (not just agents):"
echo '{"jsonrpc":"2.0","id":42,"method":"tools/call","params":{"name":"search_agents","arguments":{"query":"git","type":"instruction","limit":3}}}' | node dist/mcp-server.js 2>&1 | head -40