/**
 * Type definitions for the agent-discovery plugin
 */

export interface CatalogEntry {
  name: string;
  type: "agent" | "instruction" | "skill";
  url: string;
  description: string;
  /** File name derived from the URL (e.g. "dotnet-upgrade.agent.md") */
  fileName: string;
}

export interface Catalog {
  fetchedAt: string;
  source: string;
  entries: CatalogEntry[];
}

export interface AgentDetails {
  name: string;
  type: "agent" | "instruction" | "skill";
  url: string;
  fileName: string;
  description: string;
  content: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}