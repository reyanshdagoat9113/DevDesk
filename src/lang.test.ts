import { describe, it, expect } from 'vitest';
import { detectLanguage, shouldIndex, isProgrammingLanguage } from './lang.js';

describe('lang.ts', () => {
  describe('shouldIndex', () => {
    it('returns true for unknown language (safety net)', () => {
      expect(shouldIndex('unknown')).toBe(true);
    });

    it('returns true for common programming languages', () => {
      expect(shouldIndex('typescript')).toBe(true);
      expect(shouldIndex('javascript')).toBe(true);
      expect(shouldIndex('python')).toBe(true);
      expect(shouldIndex('rust')).toBe(true);
      expect(shouldIndex('json')).toBe(true);
      expect(shouldIndex('markdown')).toBe(true);
      expect(shouldIndex('yaml')).toBe(true);
    });

    it('returns false for binary/image/font/lockfile', () => {
      expect(shouldIndex('binary')).toBe(false);
      expect(shouldIndex('image')).toBe(false);
      expect(shouldIndex('font')).toBe(false);
      expect(shouldIndex('lockfile')).toBe(false);
    });
  });

  describe('detectLanguage - newly added extensions', () => {
    it('detects svg', () => {
      expect(detectLanguage('icon.svg', 'svg')).toBe('svg');
    });

    it('detects graphql', () => {
      expect(detectLanguage('schema.graphql', 'graphql')).toBe('graphql');
      expect(detectLanguage('query.gql', 'gql')).toBe('graphql');
    });

    it('detects prisma', () => {
      expect(detectLanguage('schema.prisma', 'prisma')).toBe('prisma');
    });

    it('detects protobuf', () => {
      expect(detectLanguage('api.proto', 'proto')).toBe('protobuf');
    });

    it('detects config extensions', () => {
      expect(detectLanguage('app.conf', 'conf')).toBe('config');
      expect(detectLanguage('app.config', 'config')).toBe('config');
    });

    it('detects template engines', () => {
      expect(detectLanguage('view.hbs', 'hbs')).toBe('handlebars');
      expect(detectLanguage('view.ejs', 'ejs')).toBe('ejs');
      expect(detectLanguage('view.pug', 'pug')).toBe('pug');
      expect(detectLanguage('view.njk', 'njk')).toBe('nunjucks');
      expect(detectLanguage('view.mustache', 'mustache')).toBe('mustache');
      expect(detectLanguage('view.liquid', 'liquid')).toBe('liquid');
    });

    it('detects json variants', () => {
      expect(detectLanguage('data.json5', 'json5')).toBe('json');
      expect(detectLanguage('tsconfig.jsonc', 'jsonc')).toBe('json');
    });

    it('detects terraform', () => {
      expect(detectLanguage('main.tf', 'tf')).toBe('terraform');
      expect(detectLanguage('vars.tfvars', 'tfvars')).toBe('terraform');
    });

    it('detects lockfiles', () => {
      expect(detectLanguage('yarn.lock', 'lock')).toBe('lockfile');
    });

    it('detects other new types', () => {
      expect(detectLanguage('page.astro', 'astro')).toBe('astro');
      expect(detectLanguage('data.plist', 'plist')).toBe('plist');
      expect(detectLanguage('out.map', 'map')).toBe('sourcemap');
    });
  });

  describe('detectLanguage - newly added filenames', () => {
    it('detects dotfiles as config', () => {
      expect(detectLanguage('.npmrc', null)).toBe('config');
      expect(detectLanguage('.yarnrc', null)).toBe('config');
      expect(detectLanguage('.nvmrc', null)).toBe('config');
      expect(detectLanguage('.node-version', null)).toBe('config');
      expect(detectLanguage('.browserslistrc', null)).toBe('config');
    });

    it('detects linter configs as json', () => {
      expect(detectLanguage('.eslintrc', null)).toBe('json');
      expect(detectLanguage('.prettierrc', null)).toBe('json');
      expect(detectLanguage('.babelrc', null)).toBe('json');
      expect(detectLanguage('.stylelintrc', null)).toBe('json');
    });

    it('detects ignore files', () => {
      expect(detectLanguage('.npmignore', null)).toBe('gitignore');
      expect(detectLanguage('.eslintignore', null)).toBe('gitignore');
      expect(detectLanguage('.prettierignore', null)).toBe('gitignore');
    });
  });

  describe('detectLanguage - existing behavior preserved', () => {
    it('detects typescript', () => {
      expect(detectLanguage('app.ts', 'ts')).toBe('typescript');
      expect(detectLanguage('app.tsx', 'tsx')).toBe('typescript');
    });

    it('detects javascript', () => {
      expect(detectLanguage('app.js', 'js')).toBe('javascript');
      expect(detectLanguage('app.jsx', 'jsx')).toBe('javascript');
    });

    it('detects rust', () => {
      expect(detectLanguage('main.rs', 'rs')).toBe('rust');
    });

    it('returns unknown for truly unrecognized extensions', () => {
      expect(detectLanguage('data.xyz', 'xyz')).toBe('unknown');
      expect(detectLanguage('file.abc123', 'abc123')).toBe('unknown');
    });

    it('handles partial filename matches', () => {
      expect(detectLanguage('README.md', 'md')).toBe('markdown');
      expect(detectLanguage('LICENSE', null)).toBe('text');
    });
  });

  describe('isProgrammingLanguage', () => {
    it('identifies programming languages', () => {
      expect(isProgrammingLanguage('typescript')).toBe(true);
      expect(isProgrammingLanguage('python')).toBe(true);
      expect(isProgrammingLanguage('rust')).toBe(true);
    });

    it('excludes non-programming languages', () => {
      expect(isProgrammingLanguage('json')).toBe(false);
      expect(isProgrammingLanguage('markdown')).toBe(false);
      expect(isProgrammingLanguage('yaml')).toBe(false);
    });
  });
});
