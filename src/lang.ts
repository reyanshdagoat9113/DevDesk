/**
 * Language detection from filename and extension
 * Simple, fast, and easily maintainable in TypeScript
 */

const EXTENSION_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  vue: 'vue',
  svelte: 'svelte',

  // Systems
  rs: 'rust',
  go: 'go',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',

  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  groovy: 'groovy',

  // .NET
  cs: 'csharp',
  fs: 'fsharp',
  vb: 'vbnet',

  // Scripting
  py: 'python',
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',

  // Data/Config
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  ini: 'ini',

  // Documentation
  md: 'markdown',
  mdx: 'mdx',
  rst: 'restructuredtext',
  txt: 'text',

  // Database
  sql: 'sql',

  // Other
  swift: 'swift',
  m: 'objective-c',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  lisp: 'lisp',
  r: 'r',

  // Build
  makefile: 'makefile',
  cmake: 'cmake',
  dockerfile: 'dockerfile',
  gradle: 'gradle',
};

const FILENAME_MAP: Record<string, string> = {
  makefile: 'makefile',
  dockerfile: 'dockerfile',
  jenkinsfile: 'groovy',
  brewfile: 'ruby',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'ruby',
  cargofile: 'toml',
  '.gitignore': 'gitignore',
  '.env': 'env',
  '.editorconfig': 'editorconfig',
  license: 'text',
  readme: 'markdown',
  changelog: 'markdown',
};

/**
 * Detect language from filename and extension
 */
export function detectLanguage(filename: string, extension: string | null): string {
  // 1. Check filename (exact match, case-insensitive)
  const filenameLower = filename.toLowerCase();
  if (FILENAME_MAP[filenameLower]) {
    return FILENAME_MAP[filenameLower];
  }

  // 2. Check extension
  if (extension) {
    const extLower = extension.toLowerCase();
    if (EXTENSION_MAP[extLower]) {
      return EXTENSION_MAP[extLower];
    }
  }

  // 3. Check for partial filename matches (e.g., README.md, LICENSE.txt)
  if (filenameLower.startsWith('readme')) return 'markdown';
  if (filenameLower.startsWith('license')) return 'text';
  if (filenameLower.startsWith('changelog')) return 'markdown';
  if (filenameLower.startsWith('contributing')) return 'markdown';
  if (filenameLower === '.gitignore') return 'gitignore';
  if (filenameLower.startsWith('.env')) return 'env';

  return 'unknown';
}

/**
 * Get file extension from path
 */
export function getExtension(path: string): string | null {
  const basename = path.split('/').pop() || path.split('\\').pop() || path;
  const dotIndex = basename.lastIndexOf('.');

  if (dotIndex <= 0) return null;

  // Handle double extensions like .d.ts
  const ext = basename.slice(dotIndex + 1).toLowerCase();
  return ext;
}

/**
 * Get filename from path
 */
export function getFilename(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || path;
}

/**
 * Check if language is a programming language (vs data/config)
 */
export function isProgrammingLanguage(language: string): boolean {
  const programmingLanguages = new Set([
    'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
    'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r',
    'haskell', 'elixir', 'erlang', 'clojure', 'lisp', 'lua', 'perl',
    'objective-c', 'dart', 'fsharp', 'vbnet', 'groovy', 'shell',
  ]);
  return programmingLanguages.has(language);
}

/**
 * Check if language should be indexed for search
 */
export function shouldIndex(language: string): boolean {
  const skipLanguages = new Set([
    'unknown', 'binary', 'image', 'font', 'lockfile',
  ]);
  return !skipLanguages.has(language);
}
