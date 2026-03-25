import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  getExtension,
  getFilename,
  isProgrammingLanguage,
  shouldIndex,
} from './lang.js';

describe('lang', () => {
  describe('detectLanguage', () => {
    describe('by extension', () => {
      it('detects JavaScript variants', () => {
        expect(detectLanguage('app.js', 'js')).toBe('javascript');
        expect(detectLanguage('app.mjs', 'mjs')).toBe('javascript');
        expect(detectLanguage('app.cjs', 'cjs')).toBe('javascript');
        expect(detectLanguage('App.jsx', 'jsx')).toBe('javascript');
      });

      it('detects TypeScript variants', () => {
        expect(detectLanguage('app.ts', 'ts')).toBe('typescript');
        expect(detectLanguage('App.tsx', 'tsx')).toBe('typescript');
        expect(detectLanguage('app.mts', 'mts')).toBe('typescript');
      });

      it('detects web languages', () => {
        expect(detectLanguage('index.html', 'html')).toBe('html');
        expect(detectLanguage('style.css', 'css')).toBe('css');
        expect(detectLanguage('style.scss', 'scss')).toBe('scss');
        expect(detectLanguage('App.vue', 'vue')).toBe('vue');
        expect(detectLanguage('App.svelte', 'svelte')).toBe('svelte');
      });

      it('detects systems languages', () => {
        expect(detectLanguage('main.rs', 'rs')).toBe('rust');
        expect(detectLanguage('main.go', 'go')).toBe('go');
        expect(detectLanguage('main.c', 'c')).toBe('c');
        expect(detectLanguage('main.cpp', 'cpp')).toBe('cpp');
      });

      it('detects JVM languages', () => {
        expect(detectLanguage('Main.java', 'java')).toBe('java');
        expect(detectLanguage('Main.kt', 'kt')).toBe('kotlin');
        expect(detectLanguage('Main.scala', 'scala')).toBe('scala');
      });

      it('detects scripting languages', () => {
        expect(detectLanguage('script.py', 'py')).toBe('python');
        expect(detectLanguage('script.rb', 'rb')).toBe('ruby');
        expect(detectLanguage('script.sh', 'sh')).toBe('shell');
        expect(detectLanguage('script.ps1', 'ps1')).toBe('powershell');
      });

      it('detects data/config formats', () => {
        expect(detectLanguage('package.json', 'json')).toBe('json');
        expect(detectLanguage('config.yaml', 'yaml')).toBe('yaml');
        expect(detectLanguage('config.toml', 'toml')).toBe('toml');
        expect(detectLanguage('Cargo.toml', 'toml')).toBe('toml');
      });

      it('detects documentation', () => {
        expect(detectLanguage('README.md', 'md')).toBe('markdown');
        expect(detectLanguage('README.MD', 'MD')).toBe('markdown');
        expect(detectLanguage('GUIDE.mdx', 'mdx')).toBe('mdx');
      });

      it('is case-insensitive for extensions', () => {
        expect(detectLanguage('app.TS', 'TS')).toBe('typescript');
        expect(detectLanguage('app.RS', 'RS')).toBe('rust');
        expect(detectLanguage('app.PY', 'PY')).toBe('python');
      });

      it('returns unknown for unrecognized extensions', () => {
        expect(detectLanguage('file.xyz', 'xyz')).toBe('unknown');
        expect(detectLanguage('file.unknown', 'unknown')).toBe('unknown');
      });

      it('returns unknown for null extension', () => {
        expect(detectLanguage('Makefile', null)).toBe('makefile'); // Filename match
        expect(detectLanguage('unknownfile', null)).toBe('unknown');
      });
    });

    describe('by filename', () => {
      it('detects Makefile', () => {
        expect(detectLanguage('Makefile', null)).toBe('makefile');
        expect(detectLanguage('makefile', null)).toBe('makefile');
        expect(detectLanguage('MAKEFILE', null)).toBe('makefile');
      });

      it('detects Dockerfile', () => {
        expect(detectLanguage('Dockerfile', null)).toBe('dockerfile');
        expect(detectLanguage('dockerfile', null)).toBe('dockerfile');
      });

      it('detects Jenkinsfile', () => {
        expect(detectLanguage('Jenkinsfile', null)).toBe('groovy');
      });

      it('detects special Ruby files', () => {
        expect(detectLanguage('Gemfile', null)).toBe('ruby');
        expect(detectLanguage('Rakefile', null)).toBe('ruby');
        expect(detectLanguage('Brewfile', null)).toBe('ruby');
      });

      it('detects Cargo files', () => {
        // Cargo.toml has extension 'toml'
        expect(detectLanguage('Cargo.toml', 'toml')).toBe('toml');
      });

      it('detects README', () => {
        expect(detectLanguage('README', null)).toBe('markdown');
        expect(detectLanguage('readme', null)).toBe('markdown');
        expect(detectLanguage('README.md', 'md')).toBe('markdown');
      });

      it('detects LICENSE', () => {
        expect(detectLanguage('LICENSE', null)).toBe('text');
        expect(detectLanguage('license', null)).toBe('text');
      });

      it('detects CHANGELOG', () => {
        expect(detectLanguage('CHANGELOG', null)).toBe('markdown');
        expect(detectLanguage('Changelog', null)).toBe('markdown');
      });

      it('detects CONTRIBUTING', () => {
        expect(detectLanguage('CONTRIBUTING', null)).toBe('markdown');
        expect(detectLanguage('Contributing', null)).toBe('markdown');
      });
    });

    describe('dotfiles', () => {
      it('detects .gitignore', () => {
        // .gitignore is matched by startsWith('.gitignore') check
        expect(detectLanguage('.gitignore', null)).toBe('gitignore');
      });

      it('detects .env', () => {
        expect(detectLanguage('.env', null)).toBe('env');
        expect(detectLanguage('.env.local', null)).toBe('env'); // startsWith('.env')
      });

      it('detects .editorconfig', () => {
        expect(detectLanguage('.editorconfig', null)).toBe('editorconfig');
      });
    });
  });

  describe('getExtension', () => {
    it('extracts simple extensions', () => {
      expect(getExtension('file.ts')).toBe('ts');
      expect(getExtension('file.js')).toBe('js');
      expect(getExtension('file.rs')).toBe('rs');
    });

    it('handles paths with directories', () => {
      expect(getExtension('src/components/App.tsx')).toBe('tsx');
      expect(getExtension('/home/user/project/file.py')).toBe('py');
      expect(getExtension('C:\\project\\file.cs')).toBe('cs');
    });

    it('handles double extensions', () => {
      expect(getExtension('file.d.ts')).toBe('ts');
      expect(getExtension('file.spec.js')).toBe('js');
    });

    it('returns null for files without extension', () => {
      expect(getExtension('Makefile')).toBeNull();
      expect(getExtension('Dockerfile')).toBeNull();
      expect(getExtension('README')).toBeNull();
    });

    it('handles dotfiles', () => {
      // Dotfiles have dotIndex = 0, so return null
      expect(getExtension('.gitignore')).toBeNull();
      expect(getExtension('.env')).toBeNull();
    });

    it('returns lowercase extension', () => {
      expect(getExtension('file.TS')).toBe('ts');
      expect(getExtension('file.JS')).toBe('js');
    });
  });

  describe('getFilename', () => {
    it('extracts filename from Unix paths', () => {
      expect(getFilename('src/components/App.tsx')).toBe('App.tsx');
      expect(getFilename('/home/user/file.txt')).toBe('file.txt');
    });

    it('returns input when no path separators', () => {
      expect(getFilename('file.txt')).toBe('file.txt');
    });
  });

  describe('isProgrammingLanguage', () => {
    it('returns true for programming languages', () => {
      expect(isProgrammingLanguage('javascript')).toBe(true);
      expect(isProgrammingLanguage('typescript')).toBe(true);
      expect(isProgrammingLanguage('python')).toBe(true);
      expect(isProgrammingLanguage('rust')).toBe(true);
      expect(isProgrammingLanguage('go')).toBe(true);
      expect(isProgrammingLanguage('java')).toBe(true);
      expect(isProgrammingLanguage('c')).toBe(true);
      expect(isProgrammingLanguage('cpp')).toBe(true);
    });

    it('returns false for data/config formats', () => {
      expect(isProgrammingLanguage('json')).toBe(false);
      expect(isProgrammingLanguage('yaml')).toBe(false);
      expect(isProgrammingLanguage('toml')).toBe(false);
      expect(isProgrammingLanguage('markdown')).toBe(false);
      expect(isProgrammingLanguage('text')).toBe(false);
    });

    it('returns false for unknown', () => {
      expect(isProgrammingLanguage('unknown')).toBe(false);
    });
  });

  describe('shouldIndex', () => {
    it('returns true for indexable languages', () => {
      expect(shouldIndex('javascript')).toBe(true);
      expect(shouldIndex('typescript')).toBe(true);
      expect(shouldIndex('python')).toBe(true);
      expect(shouldIndex('json')).toBe(true);
      expect(shouldIndex('yaml')).toBe(true);
      expect(shouldIndex('markdown')).toBe(true);
    });

    it('returns false for non-indexable types', () => {
      expect(shouldIndex('unknown')).toBe(false);
      expect(shouldIndex('binary')).toBe(false);
      expect(shouldIndex('image')).toBe(false);
      expect(shouldIndex('font')).toBe(false);
      expect(shouldIndex('lockfile')).toBe(false);
    });
  });
});
