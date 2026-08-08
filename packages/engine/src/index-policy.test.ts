import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createIndexPolicy,
  createPathMatcher,
  resolveIndexProfile,
  SOURCE_FIRST_PATTERNS,
} from './index-policy.js';

describe('index-policy', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-policy-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves profiles with source-first default', () => {
    expect(resolveIndexProfile(undefined)).toBe('source-first');
    expect(resolveIndexProfile('full-text')).toBe('full-text');
    expect(resolveIndexProfile('nope')).toBe('source-first');
  });

  it('matches gitignore-style globs', () => {
    const matcher = createPathMatcher([
      'docs/planning/**',
      'packages/landing/**',
      '**/*.html',
      'Screenshot*.png',
    ]);

    expect(matcher.ignores('docs/planning/codebase-size-optimization-plan.html')).toBe(true);
    expect(matcher.ignores('packages/landing/src/app/page.tsx')).toBe(true);
    expect(matcher.ignores('apps/desktop/index.ts')).toBe(false);
    expect(matcher.ignores('docs/install.md')).toBe(false);
    expect(matcher.ignores('foo/bar.html')).toBe(true);
    expect(matcher.ignores('Screenshot 2026-03-01.png')).toBe(true);
  });

  it('supports negation in .devdeskignore-style patterns', () => {
    const matcher = createPathMatcher(['docs/**', '!docs/install.md']);
    expect(matcher.ignores('docs/planning/x.html')).toBe(true);
    expect(matcher.ignores('docs/install.md')).toBe(false);
  });

  it('source-first drops planning HTML paths and doc languages', () => {
    const policy = createIndexPolicy(tempDir, 'source-first');
    const planning = path.join(tempDir, 'docs', 'planning', 'plan.html');
    expect(policy.ignoresPath(planning, tempDir)).toBe(true);
    expect(policy.ignoresLanguage('markdown')).toBe(true);
    expect(policy.ignoresLanguage('typescript')).toBe(false);
    expect(policy.ignoresLanguage('json')).toBe(false);
  });

  it('source-docs keeps markdown but still drops landing', () => {
    const policy = createIndexPolicy(tempDir, 'source-docs');
    expect(policy.ignoresLanguage('markdown')).toBe(false);
    const landing = path.join(tempDir, 'packages', 'landing', 'page.tsx');
    expect(policy.ignoresPath(landing, tempDir)).toBe(true);
    const readme = path.join(tempDir, 'README.md');
    expect(policy.ignoresPath(readme, tempDir)).toBe(false);
  });

  it('full-text only applies .devdeskignore', () => {
    fs.writeFileSync(
      path.join(tempDir, '.devdeskignore'),
      '# test\nsecret/**\n',
      'utf8',
    );
    const policy = createIndexPolicy(tempDir, 'full-text');
    expect(policy.ignoresLanguage('markdown')).toBe(false);
    expect(policy.ignoresPath(path.join(tempDir, 'docs', 'planning', 'x.html'), tempDir)).toBe(false);
    expect(policy.ignoresPath(path.join(tempDir, 'secret', 'key.ts'), tempDir)).toBe(true);
  });

  it('does not let user negation override the selected profile', () => {
    fs.writeFileSync(
      path.join(tempDir, '.devdeskignore'),
      'docs/**\n!docs/planning/keep.html\n',
      'utf8',
    );

    const sourcePolicy = createIndexPolicy(tempDir, 'source-first');
    expect(sourcePolicy.ignoresPath(path.join(tempDir, 'docs', 'planning', 'keep.html'), tempDir)).toBe(true);

    const fullTextPolicy = createIndexPolicy(tempDir, 'full-text');
    expect(fullTextPolicy.ignoresPath(path.join(tempDir, 'docs', 'planning', 'keep.html'), tempDir)).toBe(false);
  });

  it('ships a non-empty source-first template', () => {
    expect(SOURCE_FIRST_PATTERNS.length).toBeGreaterThan(5);
  });
});
