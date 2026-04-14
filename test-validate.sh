#!/bin/bash
cd ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery

echo "Testing validate_agent..."
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"validate_agent","arguments":{"filePath":"'"$HOME/Documents/GitHub/career-tinder/.github/agents/expert-react-frontend-engineer.agent.md"'"}}}' | node dist/mcp-server.js 2>&1