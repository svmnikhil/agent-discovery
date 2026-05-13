import { describe, it, expect } from 'vitest';
import { proposeStaticQueries, mergeQueries, type ProposedQuery } from '../src/query-mapping';
import type { StackSummary } from '../src/stack-md-parser';

const empty: StackSummary = { languages: [], frameworks: [], testFrameworks: [], infra: [], ci: [] };

function summary(overrides: Partial<StackSummary>): StackSummary {
  return { ...empty, ...overrides };
}

describe('proposeStaticQueries', () => {
  it('expands React with frontend axes (10 queries: 1 bare + 6 core + 3 frontend)', () => {
    const qs = proposeStaticQueries(summary({ frameworks: ['react'] }));
    const reactQs = qs.filter(q => q.label === 'React');
    expect(reactQs.length).toBe(10);
    expect(reactQs.some(q => q.query === 'react')).toBe(true);
    expect(reactQs.some(q => q.query === 'react review')).toBe(true);
    expect(reactQs.some(q => q.query === 'react testing')).toBe(true);
    expect(reactQs.some(q => q.query === 'react accessibility')).toBe(true);
    expect(reactQs.some(q => q.query === 'react state management')).toBe(true);
  });

  it('includes BACKEND_CONCERNS for backend frameworks', () => {
    const qs = proposeStaticQueries(summary({ frameworks: ['django'] }));
    const djangoQs = qs.filter(q => q.label === 'Django');
    expect(djangoQs.some(q => q.query === 'django api')).toBe(true);
    expect(djangoQs.some(q => q.query === 'django database')).toBe(true);
    expect(djangoQs.some(q => q.query === 'django auth')).toBe(true);
  });

  it('Go-only stack gets only CORE_CONCERNS + ALWAYS_ON (no frontend/backend axes)', () => {
    const qs = proposeStaticQueries(summary({ languages: ['go'] }));
    const goQs = qs.filter(q => q.label === 'Go');
    // 1 bare + 6 core
    expect(goQs.length).toBe(7);
    expect(goQs.some(q => q.query === 'go accessibility')).toBe(false);
    expect(goQs.some(q => q.query === 'go api')).toBe(false);
    expect(qs.some(q => q.group === 'cross-cutting' && q.query === 'code review')).toBe(true);
  });

  it('empty stack yields only ALWAYS_ON cross-cutting', () => {
    const qs = proposeStaticQueries(empty);
    expect(qs.every(q => q.group === 'cross-cutting')).toBe(true);
    expect(qs.map(q => q.query)).toEqual(expect.arrayContaining([
      'code review', 'documentation', 'observability', 'dependency audit',
    ]));
  });

  it('expands infra with bare/security/deployment triples', () => {
    const qs = proposeStaticQueries(summary({ infra: ['docker', 'kubernetes'] }));
    expect(qs.some(q => q.query === 'docker')).toBe(true);
    expect(qs.some(q => q.query === 'docker security')).toBe(true);
    expect(qs.some(q => q.query === 'docker deployment')).toBe(true);
    expect(qs.some(q => q.query === 'kubernetes')).toBe(true);
    expect(qs.some(q => q.query === 'kubernetes security')).toBe(true);
  });

  it('emits CI/CD queries under shared label', () => {
    const qs = proposeStaticQueries(summary({ ci: ['github-actions'] }));
    const ci = qs.filter(q => q.label === 'CI/CD');
    expect(ci.some(q => q.query === 'github-actions security')).toBe(true);
    expect(ci.some(q => q.query === 'ci/cd')).toBe(true);
  });
});

describe('mergeQueries', () => {
  it('dedupes by lowercased query, static wins on collision', () => {
    const stat: ProposedQuery[] = [
      { group: 'tech', label: 'React', query: 'react testing', why: 'static-why' },
    ];
    const lm: ProposedQuery[] = [
      { group: 'stack-adapted', label: 'React', query: 'REACT testing', why: 'lm-why' },
    ];
    const merged = mergeQueries(stat, lm);
    expect(merged).toHaveLength(1);
    expect(merged[0].why).toBe('static-why');
    expect(merged[0].group).toBe('tech');
  });

  it('caps at 35 queries', () => {
    const stat: ProposedQuery[] = Array.from({ length: 50 }, (_, i) => ({
      group: 'tech' as const, label: `L${i}`, query: `q${i}`, why: `w${i}`,
    }));
    expect(mergeQueries(stat, [])).toHaveLength(35);
  });

  it('orders groups: tech → cross-cutting → stack-adapted', () => {
    const merged = mergeQueries(
      [
        { group: 'cross-cutting', label: 'Code Review', query: 'code review', why: 'x' },
        { group: 'tech', label: 'React', query: 'react', why: 'x' },
      ],
      [
        { group: 'stack-adapted', label: 'Otel', query: 'opentelemetry', why: 'x' },
      ],
    );
    expect(merged.map(q => q.group)).toEqual(['tech', 'cross-cutting', 'stack-adapted']);
  });
});
