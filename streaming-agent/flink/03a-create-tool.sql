-- ───────────────────────────────────────────────────────────────────────
-- Bind the Flink MCP connection (created via `confluent flink connection
-- create agent-discovery-mcp-connection …`) as a callable tool.
-- ───────────────────────────────────────────────────────────────────────

-- Drop on iteration if needed:
-- DROP TOOL IF EXISTS agent_discovery;

CREATE TOOL agent_discovery
USING CONNECTION `agent-discovery-mcp-connection`
WITH (
  'type' = 'mcp',
  'allowed_tools' = 'get_current_team, search_catalog_for_category, propose_team_change',
  'request_timeout' = '30'
);
