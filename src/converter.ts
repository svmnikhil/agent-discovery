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
export function convertToClaudeSubagent(
  name: string,
  description: string,
  rawContent: string
): string {
  // Extract frontmatter and body from the original
  let body = rawContent;
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    body = rawContent.slice(frontmatterMatch[0].length).trim();
  }

  // Generate a kebab-case name
  const kebabName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Build Claude Code subagent frontmatter
  const claudeFrontmatter = [
    `name: ${kebabName}`,
    `description: ${description}`,
    `tools: Read, Grep, Glob, Bash`,
  ].join("\n");

  return `---\n${claudeFrontmatter}\n---\n\n${body}`;
}
