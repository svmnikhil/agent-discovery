import { describe, it, expect } from 'vitest';
import { parseStackMd } from '../src/stack-md-parser';

const FULL_FIXTURE = `# Stack

## Core Sections (Required)

### 1) Runtime Summary

| Component | Value | Evidence |
| --- | --- | --- |
| Language | TypeScript | tsconfig.json |
| Runtime  | Node v20    | package.json#engines |
| Package manager | npm | package-lock.json |

### 2) Production Frameworks and Dependencies

| Package | Version | Role | Evidence |
| --- | --- | --- | --- |
| react   | 18.2  | UI framework | package.json |
| react-router | 6.x | routing | package.json |
| vite    | 5.0   | build system | package.json |

### 3) Development Toolchain

- vitest 1.0 — test runner
- eslint 8.x — linter
- prettier 3 — formatter

### 4) Key Commands

\`\`\`bash
npm install
npm test
\`\`\`

### 5) Environment and Config

- .env.example
- Dockerfile present (docker build)
- .github/workflows/ci.yml (GitHub Actions)

### 6) Evidence

- package.json
- Dockerfile
`;

describe('parseStackMd', () => {
  it('parses the canonical full template shape', () => {
    const s = parseStackMd(FULL_FIXTURE);
    expect(s.languages).toContain('typescript');
    expect(s.frameworks).toContain('react');
    expect(s.frameworks).toContain('vite');
    expect(s.testFrameworks).toContain('vitest');
    expect(s.infra).toContain('docker');
    expect(s.ci).toContain('github-actions');
  });

  it('caps languages at 3', () => {
    const fixture = `# Stack

### 1) Runtime Summary

| Component | Value | Evidence |
| --- | --- | --- |
| Language | TypeScript | tsconfig.json |
| Language | Python | pyproject.toml |
| Language | Go | go.mod |
| Language | Rust | Cargo.toml |
| Language | Ruby | Gemfile |
`;
    const s = parseStackMd(fixture);
    expect(s.languages.length).toBeLessThanOrEqual(3);
  });

  it('returns empty arrays on missing sections (never throws)', () => {
    expect(() => parseStackMd('')).not.toThrow();
    const s = parseStackMd('# Stack\n\nNothing useful here.');
    expect(s.languages).toEqual([]);
    expect(s.frameworks).toEqual([]);
    expect(s.testFrameworks).toEqual([]);
    expect(s.infra).toEqual([]);
    expect(s.ci).toEqual([]);
  });

  it('detects infra and CI via whole-doc keyword sweep (prose-only mention)', () => {
    const prose = `# Stack

This project uses Docker for local development and Kubernetes in production.
CI is handled by GitLab CI pipelines.
`;
    const s = parseStackMd(prose);
    expect(s.infra).toContain('docker');
    expect(s.infra).toContain('kubernetes');
    expect(s.ci).toContain('gitlab-ci');
  });

  it('matches H3 headers without numeric prefix', () => {
    const fixture = `# Stack

### Runtime Summary

- Language: Go
- Runtime: go 1.21

### Production Frameworks and Dependencies

- gin
- gorm
`;
    const s = parseStackMd(fixture);
    expect(s.languages).toContain('go');
    expect(s.frameworks).toContain('gin');
    expect(s.frameworks).toContain('gorm');
  });

  it('strips @version and trailing version numbers', () => {
    const fixture = `# Stack

### 2) Production Frameworks and Dependencies

- react@18.2.0
- vue 3.4
- next 14
`;
    const s = parseStackMd(fixture);
    expect(s.frameworks).toContain('react');
    expect(s.frameworks).toContain('vue');
    expect(s.frameworks).toContain('next');
  });

  it('handles case-insensitive header matching', () => {
    const fixture = `# Stack

### RUNTIME SUMMARY

- Language: Python
`;
    const s = parseStackMd(fixture);
    expect(s.languages).toContain('python');
  });

  it('normalizes language aliases (ts → typescript, py → python, c# → csharp)', () => {
    const fixture = `# Stack

### 1) Runtime Summary

- Language: TS
- Language: c#
- Language: PY
`;
    const s = parseStackMd(fixture);
    expect(s.languages).toContain('typescript');
    expect(s.languages).toContain('csharp');
    expect(s.languages).toContain('python');
  });

  it('detects test frameworks across the document', () => {
    const fixture = `# Stack

Uses pytest for testing and jest for the frontend slice.
`;
    const s = parseStackMd(fixture);
    expect(s.testFrameworks).toContain('pytest');
    expect(s.testFrameworks).toContain('jest');
  });

  it('skips markdown table header rows', () => {
    const fixture = `# Stack

### 2) Production Frameworks and Dependencies

| Package | Version | Role |
| --- | --- | --- |
| express | 4.18 | server |
`;
    const s = parseStackMd(fixture);
    expect(s.frameworks).toContain('express');
    expect(s.frameworks).not.toContain('package');
    expect(s.frameworks).not.toContain('---');
  });
});
