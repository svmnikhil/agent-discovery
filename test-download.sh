#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "Testing download_agent..."
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"download_agent","arguments":{"name":"Expert React Frontend Engineer","targetDir":"'"$HOME/Documents/GitHub/career-tinder"'"}}}' | node dist/mcp-server.js 2>&1