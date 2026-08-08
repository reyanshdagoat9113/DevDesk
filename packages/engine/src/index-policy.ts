/**
 * Index scope policy: profiles + optional .devdeskignore on top of .gitignore
 * (Rust scanner already honors .gitignore). Applied in TypeScript after scan.
 *
 * Profiles control *what* is indexed; they do not change product features.
 * - source-first: product/source code; excludes planning HTML, landing, media, etc.
 * - source-docs: source + documentation languages
 * - full-text: all text languages the engine already supports (legacy breadth)
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizePath } from './utils.js';

export type IndexProfile = 'source-first' | 'source-docs' | 'full-text';

export const DEFAULT_INDEX_PROFILE: IndexProfile = 'source-first';

export type SkipReason =
  | 'binary'
  | 'language'
  | 'profile'
  | 'devdeskignore'
  | 'unchanged';

export interface SkipReasonCounts {
  binary: number;
  language: number;
  profile: number;
  devdeskignore: number;
  unchanged: number;
}

export function emptySkipReasons(): SkipReasonCounts {
  return {
    binary: 0,
    language: 0,
    profile: 0,
    devdeskignore: 0,
    unchanged: 0,
  };
}

/** Shared non-source bulk (all profiles except full-text). */
export const BUILD_ARTIFACT_PATTERNS: string[] = [
  'release/**',
  'dist/**',
  'coverage/**',
  '**/*.map',
];

/** Built-in globs for source-first (gitignore-style, relative to repo root). */
export const SOURCE_FIRST_PATTERNS: string[] = [
  ...BUILD_ARTIFACT_PATTERNS,
  // Planning / marketing bulk under monorepos
  'docs/planning/**',
  'docs/**/*.html',
  '**/*-plan.html',
  '**/milestone*-plan.html',
  'packages/landing/**',
  // Screenshots and design dumps
  'Screenshot*.png',
  'ChatGPT Image*.png',
  '**/*Screenshot*.png',
  // Large non-source text often present in monorepos
  '**/CHANGELOG.md',
  '**/LICENSE*',
];

/** source-docs: keep markdown/docs, still drop marketing site + build artifacts. */
export const SOURCE_DOCS_PATTERNS: string[] = [
  ...BUILD_ARTIFACT_PATTERNS,
  'packages/landing/**',
  'Screenshot*.png',
  'ChatGPT Image*.png',
  '**/*Screenshot*.png',
];

/** Languages dropped only in source-first (docs stay searchable in source-docs). */
export const SOURCE_FIRST_DOC_LANGUAGE_EXTRAS = new Set([
  'markdown',
  'mdx',
  'asciidoc',
  'restructuredtext',
  'text',
  'html',
  'svg',
  'sourcemap',
]);

const DEVDESKIGNORE_NAMES = ['.devdeskignore'];

export function isIndexProfile(value: unknown): value is IndexProfile {
  return value === 'source-first' || value === 'source-docs' || value === 'full-text';
}

export function resolveIndexProfile(value?: string | null): IndexProfile {
  if (isIndexProfile(value)) {
    return value;
  }
  return DEFAULT_INDEX_PROFILE;
}

/**
 * Minimal gitignore-style matcher for relative POSIX paths.
 * Supports: `#` comments, `!` negation, `**`, `*`, trailing `/` for dirs, leading `/` for root-only.
 * Intentionally small (no dependency) — sufficient for profile templates and .devdeskignore.
 */
export function createPathMatcher(patterns: string[]): {
  ignores: (relativePath: string) => boolean;
  patterns: string[];
} {
  const rules: Array<{ negate: boolean; regex: RegExp; dirOnly: boolean }> = [];

  for (const raw of patterns) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    let negate = false;
    let body = line;
    if (body.startsWith('!')) {
      negate = true;
      body = body.slice(1);
    }

    let dirOnly = false;
    if (body.endsWith('/')) {
      dirOnly = true;
      body = body.slice(0, -1);
    }

    // Leading slash = anchored to root
    let anchored = false;
    if (body.startsWith('/')) {
      anchored = true;
      body = body.slice(1);
    }

    const regex = globToRegExp(body, anchored);
    rules.push({ negate, regex, dirOnly });
  }

  return {
    patterns: patterns.slice(),
    ignores(relativePath: string): boolean {
      const rel = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
      let ignored = false;
      for (const rule of rules) {
        if (rule.dirOnly) {
          // Match path under a directory prefix
          const dirMatch =
            rule.regex.test(rel) ||
            rule.regex.test(rel + '/') ||
            // Also treat "foo" dir pattern as matching "foo/bar"
            matchDirPrefix(rule.regex, rel);
          if (dirMatch) {
            ignored = !rule.negate;
          }
          continue;
        }
        if (rule.regex.test(rel)) {
          ignored = !rule.negate;
        }
      }
      return ignored;
    },
  };
}

function matchDirPrefix(regex: RegExp, rel: string): boolean {
  // If pattern matched a directory name segment path
  const parts = rel.split('/');
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    if (regex.test(acc) || regex.test(acc + '/')) {
      return true;
    }
  }
  return false;
}

function globToRegExp(glob: string, anchored: boolean): RegExp {
  let source = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 3;
        continue;
      }
      source += '.*';
      i += 2;
      continue;
    }
    if (c === '*') {
      source += '[^/]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      source += '[^/]';
      i += 1;
      continue;
    }
    if ('+|(){}^$[]\\.'.includes(c)) {
      source += '\\' + c;
      i += 1;
      continue;
    }
    source += c;
    i += 1;
  }

  const body = anchored ? `^${source}$` : `(^|/)${source}$`;
  return new RegExp(body, 'i');
}

export function loadDevdeskIgnorePatterns(repoPath: string): string[] {
  const patterns: string[] = [];
  for (const name of DEVDESKIGNORE_NAMES) {
    const full = path.join(repoPath, name);
    if (!fs.existsSync(full)) continue;
    try {
      const text = fs.readFileSync(full, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        patterns.push(trimmed);
      }
    } catch {
      // ignore unreadable
    }
  }
  return patterns;
}

export interface IndexPolicy {
  profile: IndexProfile;
  /** True if path should be excluded by profile path patterns or .devdeskignore */
  ignoresPath: (absoluteOrRepoRelativePath: string, repoPath: string) => boolean;
  /** True if language is excluded by profile language rules */
  ignoresLanguage: (language: string) => boolean;
  /** Human-readable pattern list for diagnostics */
  appliedPatterns: string[];
}

export function createIndexPolicy(
  repoPath: string,
  profileInput?: string | null,
): IndexPolicy {
  const profile = resolveIndexProfile(profileInput);
  const profilePatterns: string[] = [];

  if (profile === 'source-first') {
    profilePatterns.push(...SOURCE_FIRST_PATTERNS);
  } else if (profile === 'source-docs') {
    profilePatterns.push(...SOURCE_DOCS_PATTERNS);
  }
  // full-text: only .devdeskignore (+ scanner .gitignore / default dir excludes).
  // Keep profile and user rules separate so a .devdeskignore negation can undo
  // an earlier user rule without overriding the selected profile's boundaries.

  const userPatterns = loadDevdeskIgnorePatterns(repoPath);
  const profileMatcher = createPathMatcher(profilePatterns);
  const userMatcher = createPathMatcher(userPatterns);
  const repoNormalized = normalizePath(path.resolve(repoPath));

  const toRelativePath = (filePath: string): string => {
    const absolute = normalizePath(path.isAbsolute(filePath) ? filePath : path.join(repoPath, filePath));
    if (absolute.toLowerCase().startsWith(repoNormalized.toLowerCase() + '/')) {
      return absolute.slice(repoNormalized.length + 1);
    }
    if (absolute.toLowerCase() === repoNormalized.toLowerCase()) {
      return '';
    }

    let relative = filePath.replace(/\\/g, '/');
    const marker = repoNormalized.split('/').pop();
    if (marker) {
      const idx = relative.toLowerCase().indexOf('/' + marker.toLowerCase() + '/');
      if (idx >= 0) {
        relative = relative.slice(idx + marker.length + 2);
      }
    }
    return relative;
  };

  return {
    profile,
    appliedPatterns: [...profileMatcher.patterns, ...userMatcher.patterns],
    ignoresPath(filePath: string): boolean {
      const relative = toRelativePath(filePath);
      return profileMatcher.ignores(relative) || userMatcher.ignores(relative);
    },
    ignoresLanguage(language: string): boolean {
      if (profile === 'full-text') {
        return false;
      }
      if (profile === 'source-docs') {
        // Keep docs languages; no extra language bans beyond shouldIndex()
        return false;
      }
      // source-first: drop pure doc/text languages (code + config remain)
      return SOURCE_FIRST_DOC_LANGUAGE_EXTRAS.has(language);
    },
  };
}

export function formatSkipReasons(counts: SkipReasonCounts): string {
  const parts: string[] = [];
  for (const key of Object.keys(counts) as Array<keyof SkipReasonCounts>) {
    if (counts[key] > 0) {
      parts.push(`${key}=${counts[key]}`);
    }
  }
  return parts.length ? parts.join(', ') : 'none';
}
