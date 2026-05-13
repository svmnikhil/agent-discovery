/**
 * Map a StackSummary → a Cartesian set of 2–3 token catalog queries.
 *
 * Layer A is fully deterministic (proposeStaticQueries).
 * Layer B (LM-suggested) is parsed elsewhere by skill-runner.ts.
 * Layer C merges and dedupes (mergeQueries).
 */

import type { StackSummary } from './stack-md-parser';

export type QueryGroup = 'tech' | 'cross-cutting' | 'stack-adapted';

export interface ProposedQuery {
  group: QueryGroup;
  label: string;
  query: string;
  why: string;
}

const CORE_CONCERNS = ['review', 'testing', 'security', 'performance', 'refactoring', 'architecture'];
const FRONTEND_CONCERNS = ['accessibility', 'design system', 'state management'];
const BACKEND_CONCERNS = ['api', 'database', 'auth'];
const ALWAYS_ON = ['code review', 'documentation', 'technical writing', 'observability', 'dependency audit'];

const FRONTEND_FRAMEWORKS = new Set(['react','vue','svelte','angular','next','nuxt','solid','astro']);
const BACKEND_FRAMEWORKS  = new Set(['express','fastify','nest','django','flask','fastapi','spring','rails','laravel','gin','actix']);

const MAX_QUERIES = 35;

function pretty(s: string): string {
  if (!s) return s;
  // Special cases
  if (/^(ci|cd|cicd|ci\/cd)$/i.test(s)) return 'CI/CD';
  if (/^(api)$/i.test(s)) return 'API';
  return s
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function proposeStaticQueries(s: StackSummary): ProposedQuery[] {
  const out: ProposedQuery[] = [];

  const techTokens = new Set<string>();
  for (const t of [...s.frameworks, ...s.languages]) {
    const norm = t.toLowerCase().trim();
    if (norm && norm.length > 1) techTokens.add(norm);
  }

  for (const t of techTokens) {
    const label = pretty(t);

    out.push({ group: 'tech', label, query: t, why: `detected ${t} in STACK.md` });
    for (const c of CORE_CONCERNS) {
      out.push({ group: 'tech', label, query: `${t} ${c}`, why: `${t} + ${c}` });
    }
    if (FRONTEND_FRAMEWORKS.has(t)) {
      for (const c of FRONTEND_CONCERNS) {
        out.push({ group: 'tech', label, query: `${t} ${c}`, why: `${t} + ${c}` });
      }
    }
    if (BACKEND_FRAMEWORKS.has(t)) {
      for (const c of BACKEND_CONCERNS) {
        out.push({ group: 'tech', label, query: `${t} ${c}`, why: `${t} + ${c}` });
      }
    }
  }

  for (const i of s.infra) {
    const norm = i.toLowerCase();
    const label = pretty(norm);
    out.push({ group: 'tech', label, query: norm,                why: `detected ${norm}` });
    out.push({ group: 'tech', label, query: `${norm} security`,  why: `${norm} security review` });
    out.push({ group: 'tech', label, query: `${norm} deployment`, why: `${norm} deployment patterns` });
  }

  if (s.ci.length > 0) {
    for (const ci of s.ci) {
      out.push({ group: 'tech', label: 'CI/CD', query: `${ci} security`, why: `${ci} pipeline security` });
    }
    out.push({ group: 'tech', label: 'CI/CD', query: 'ci/cd', why: 'CI/CD patterns' });
  }

  for (const q of ALWAYS_ON) {
    out.push({ group: 'cross-cutting', label: pretty(q), query: q, why: 'applies to any codebase' });
  }

  return out;
}

const GROUP_ORDER: Record<QueryGroup, number> = {
  'tech': 0,
  'cross-cutting': 1,
  'stack-adapted': 2,
};

export function mergeQueries(
  staticQueries: ProposedQuery[],
  lmSuggestedQueries: ProposedQuery[],
): ProposedQuery[] {
  const seen = new Map<string, ProposedQuery>();
  // Static first so it wins on collision.
  for (const q of staticQueries) {
    const k = q.query.toLowerCase().trim();
    if (!seen.has(k)) seen.set(k, q);
  }
  for (const q of lmSuggestedQueries) {
    const k = q.query.toLowerCase().trim();
    if (!seen.has(k)) seen.set(k, q);
  }

  const merged = Array.from(seen.values());

  // Stable sort by group order; preserve in-group input order via index map.
  const idx = new Map<ProposedQuery, number>();
  merged.forEach((q, i) => idx.set(q, i));
  merged.sort((a, b) => {
    const ga = GROUP_ORDER[a.group], gb = GROUP_ORDER[b.group];
    if (ga !== gb) return ga - gb;
    return (idx.get(a)! - idx.get(b)!);
  });

  return merged.slice(0, MAX_QUERIES);
}
