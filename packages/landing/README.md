# DevDesk landing (`@devdesk/landing`)

Public install page for the private beta. It is a **separate** Vite app in the npm workspace — not bundled into the Electron installer.

Product docs: [../../docs/README.md](../../docs/README.md). Download URLs and version: `src/config/site.ts`.

## Commands (from repo root)

```bash
npm run landing:dev
npm run landing:build
npm run landing:start              # production static server (server.mjs)
npm run landing:verify-downloads   # HEAD-check GitHub Release assets
npm run landing:typecheck
npm run landing:lint
```

Keep `APP_VERSION` and artifact `fileName`s in `src/config/site.ts` in lockstep with root `package.json`. Set each download’s `available` to `true` only after that file exists on the GitHub Release.

`VITE_SITE_URL` is the canonical origin for SEO/OG tags (set on the host). It falls back to the GitHub repo URL.

## Deploy notes

The page is meant to be served as static files (plus `server.mjs` if you want a small Node host). Flip download flags **after** `publish-release.yml` has uploaded both installers, then run `landing:verify-downloads`.

Historical design notes: [../../docs/landing-page-plan.md](../../docs/landing-page-plan.md) (implemented; treat as background, not a task list).
