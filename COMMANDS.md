# Commands

## Development
- `npm run dev` - Build main/preload, start Vite dev server, then launch Electron.
- `npm run dev:renderer` - Start Vite only.

## Build
- `npm run build` - Build main, preload, and renderer bundles.
- `npm run build:main` - Compile Electron main process TypeScript.
- `npm run build:preload` - Compile preload TypeScript.
- `npm run build:renderer` - Vite production build (outputs to `dist/renderer`).

## Quality
- `npm run lint` - ESLint for `apps/**/*.ts` and `apps/**/*.tsx`.
- `npm run typecheck` - TypeScript typecheck only.
