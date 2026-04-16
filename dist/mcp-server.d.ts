#!/usr/bin/env node
/**
 * Agent Discovery MCP Server
 *
 * Provides tools to discover, search, and install AI agents from a pre-built
 * SQLite catalog. No runtime fetching needed — catalog is bundled at publish time.
 *
 * Tools:
 *   search_agents   - FTS5 search on local SQLite catalog
 *   recommend       - Broad FTS5 retrieval for LLM re-ranking
 *   get_agent_details - Fetch full content from raw.githubusercontent.com
 *   download_agent  - Download and install to target directory
 *   catalog_info    - Show DB version, source count, build date
 */
export {};
