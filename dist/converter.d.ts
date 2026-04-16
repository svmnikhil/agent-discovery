/**
 * Format conversion utilities.
 *
 * Converts awesome-copilot .agent.md files to Claude Code's native
 * subagent format (.claude/agents/*.md).
 */
/**
 * Convert an awesome-copilot .agent.md file to Claude Code subagent format.
 *
 * awesome-copilot format:
 *   ---
 *   name: "Agent Name"
 *   description: "What this agent does..."
 *   ---
 *   # Agent instructions...
 *
 * Claude Code subagent format:
 *   ---
 *   name: agent-name
 *   description: When to invoke this agent
 *   tools: Read, Grep, Glob, Bash
 *   ---
 *   # Agent instructions...
 */
export declare function convertToClaudeSubagent(name: string, description: string, rawContent: string): string;
