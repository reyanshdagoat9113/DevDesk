# DevDesk Landing Page Plan

Status: in progress — Phases 0–3 done; Phase 2 screenshots + Phase 4 polish remaining
Owner: repo maintainer (`reyanshdagoat9113`)
Target: public install page for the v0.1.0 private beta

## 1. Context

Findings from the repo survey that shape this plan, with the current state of each after the Phase 0
implementation pass:

- **~~Greenfield~~ → scaffolded.** There was no `site/`, `web/`, or `landing/` directory and no docs-site
  config. `packages/landing` now exists as a standalone Vite + React 19 + Tailwind 3 workspace member
  with its own `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `components.json`, and
  `tsconfig.json`. There is still no CI deploy workflow (Railway deploy-on-push replaces it).
- **Copy already exists.** `Readme.md:8` — "A local-first Electron desktop app for developers that
  combines a Project Manager, Command Vault, Docker controls, terminals, and local code search into
  one workspace." Shorter variants live in `package.json` (`description`, `build.linux.synopsis`).
  This one-liner and the trust line are now held in `packages/landing/src/config/site.ts` (`siteMeta`).
- **Brand is intentionally monochrome.** `apps/renderer/index.css` defines a warm off-white light
  theme (`--background: 40 20% 97%`) and a pure-black dark theme (`--background: 0 0% 0%`), with
  `--radius: 0.75rem`, glassmorphism (`.glass`, `.glass-card`), subtle glows, and `fade-in` /
  `slide-up` animations. The only chromatic token is destructive red. Both token blocks and those
  utilities are copied verbatim into `packages/landing/src/index.css`, which carries a comment marking
  them as copies to re-sync rather than edit.
- **Assets are raster-only.** `apps/renderer/assets/devdesk-logo-top-left-transparent.png`,
  `apps/renderer/assets/devdesk-logo-options.png`, `build/icon.png`, `build/icon.ico`. There is still no
  SVG logo and **no committed product screenshots** (Phase 2). `.gitignore` excluded `*Screenshot*.png`
  globally; it now negates `packages/landing/public/screenshots/**` and `.../public/media/**` so landing
  collateral is committable, and `packages/landing/public/screenshots/` exists with the expected
  filenames listed.
- **Distribution is undefined.** `docs/install.md:18` still says to download the installer "from the
  release channel used by your team". Packages are built locally
  (`npm run package:win` / `package:linux`) into `release/`, and there is no GitHub Releases
  automation. The page no longer *blocks* on this: every artifact URL comes from
  `packages/landing/src/config/site.ts`, gated by a `releasePublished` flag, and
  `npm run landing:verify-downloads` HEAD-checks each asset.
- **A public `v0.1.0` release already exists** on `reyanshdagoat9113/DevDesk`, but it carries only
  `DevDesk-0.1.0-win-x64.exe` (~132 MB) and its blockmap. Both Linux artifacts are missing, so
  `landing:verify-downloads` currently reports 2/3 unreachable and exits 1, and `releasePublished`
  stays `false`. See risk 2 for the resolution options.
- **Workspace fit confirmed.** Root `package.json` declares `workspaces: ["packages/*"]`, so
  `packages/landing` is picked up automatically (`npm install` resolved it in place, adding one package).
  The root `tailwind.config.js`, `vite.config.ts` (`root: 'apps/renderer'`), and `tsconfig.json`
  (`include: ["apps/renderer"]`) are renderer-scoped, so the site carries its own build configuration
  and is invoked through `landing:*` root scripts. `scripts/check-architecture.mjs` only walks
  `apps/desktop` and `apps/renderer/app`, so it does not see the new package — verified: output is
  unchanged pre-existing warnings.
- **Launch requirement.** `docs/beta-release-checklist.md:31` lists an unchecked item: "Public install
  page + support contact path". This page satisfies it; `siteMeta.supportUrl` points at GitHub issues.

## 2. Phase 0 — Decisions (settled and implemented)

| # | Decision | Choice |
| - | -------- | ------ |
| 1 | Primary CTA | **Real download.** Publish `DevDesk-0.1.0-win-x64.exe`, `-linux-x64.AppImage`, and `.deb` to GitHub Releases on `reyanshdagoat9113/DevDesk`; the download cards link to those asset URLs. |
| 2 | Stack | **Vite + React 19 + Tailwind 3 + shadcn**, matching the renderer so tokens, `cn()`, lucide icons, and shadcn wrappers transfer directly. |
| 3 | Hosting | **Railway.** Static build served from the repo by a Node process (`packages/landing/server.mjs`) configured in `packages/landing/railway.json`. |
| 4 | Accent colour | **Monochrome plus one restrained accent:** a single blue reserved for CTAs, links, and focus rings — `--accent-brand: 224 76% 45%` (light) / `217 91% 62%` (dark), exposed to Tailwind as `brand` / `brand-foreground`. |

### 2.1 Implementation of the Phase 0 follow-on work

Decision 1 — release publishing:

- Artifact names are derived from `build.artifactName`
  (`${productName}-${version}-${os}-${arch}.${ext}`) and match `docs/install.md` exactly.
- `packages/landing/src/config/site.ts` is the single source of truth for owner/repo, `APP_VERSION`,
  `RELEASE_TAG`, per-platform artifacts, system requirements, and the honest caveats from
  `docs/install.md:80-85` (unsigned Windows build / SmartScreen, no auto-update, no macOS, Docker
  installed separately). `macAvailable` is `false` because `build.mac.target` is empty.
- `releasePublished` starts `false`; download UI must render an unavailable state until the assets are
  live. `npm run landing:verify-downloads` HEAD-checks every asset URL and exits non-zero if any is
  missing, so flipping the flag is a verified step rather than a guess.
- Manual upload is acceptable for 0.1.0; a release workflow remains a later improvement.
- Root `package.json` now declares `homepage`, `repository`, and `bugs` so the release and support
  links have a canonical origin.

Decision 3 — Railway:

- No GitHub Pages workflow. Railway service settings: **root directory** `packages/landing`,
  build command `npm run build`, start command `npm start`.
- `packages/landing/server.mjs` is a zero-dependency static server that binds
  `process.env.PORT` (default 4173) on `0.0.0.0`, serves `dist/`, sets long-lived immutable caching for
  `/assets/*` and `must-revalidate` for everything else, falls back to `index.html` for unknown *routes*
  (but returns a real 404 for missing files with an extension, so broken images fire `onError`),
  refuses path traversal, and exposes `/healthz`.
- `packages/landing/railway.json` pins the Nixpacks builder, both commands, the `/healthz` healthcheck,
  and an `ON_FAILURE` restart policy.
- Verified locally: `PORT=4899 node server.mjs` returned 200 for `/`, `/healthz`, and the hashed CSS
  asset with `immutable` caching; an encoded `../package.json` request fell back to `index.html`
  without leaking the file.

Decision 4 — accent hue:

- Chosen once, defined in a clearly separated block in `packages/landing/src/index.css` immediately
  after the copied app tokens, so token parity with the app stays auditable:
  `--accent-brand: 224 76% 45%` / `--accent-brand-foreground: 0 0% 100%` in `:root`, and
  `217 91% 62%` / `222 47% 8%` in `.dark`.
- Contrast checked: light fill 7.3:1 against white text and 6.8:1 as link text on the warm off-white
  background; dark fill 6.2:1 against pure black and 5.6:1 against its near-black foreground.
- Usage is constrained to the `bg-brand` / `text-brand` colours and a `.focus-brand` ring utility;
  everything else stays on the app's monochrome tokens.

Verification run for this pass: `npm run landing:typecheck`, `npm run landing:lint`,
`npm run landing:build` (clean, ~230 kB JS / 11 kB CSS), `npm run lint:architecture` (unchanged), and
the static-server checks above.

## 3. Phase 1 — Scaffold (`packages/landing`)

- [x] Create workspace member `@devdesk/landing` (naming precedent: `@devdesk/ipc-contracts`).
- [x] Give it its own `vite.config.ts` (dev 5190 / preview 5191, `@` → `src`), `tailwind.config.js`,
      `postcss.config.js`, `components.json`, and `tsconfig.json` so it does not collide with the
      renderer-scoped root configs.
- [x] Copy the `:root` and `.dark` token blocks verbatim from `apps/renderer/index.css`, plus `.glass`,
      `.glass-card`, `.text-gradient`, `.glow`, `.glow-sm`, `.hover-glow`, and the `fade-in` /
      `slide-up` keyframes, for visual parity with the app.
- [x] Add a site-only `--accent-brand` (and `--accent-brand-foreground`) token per decision 4, used only
      by CTAs, links, and focus rings, in a separate block so parity stays auditable.
- [x] Reuse `lucide-react` icons and the `cn()` helper copied to `packages/landing/src/lib/utils.ts`.
- [x] Install only the shadcn primitives the page needs: Button, Card, Badge, Tabs, Accordion, in
      `src/components/ui` with a barrel `index.ts`. Card, Badge, and Tabs are copied from
      `apps/renderer/app/components/ui` verbatim; Button adds a site-only `brand` variant (and an `xl`
      size) and points `link` at the accent; Accordion is new (the app has none) and follows the same
      shadcn shape, with `accordion-up` / `accordion-down` keyframes added to the site's Tailwind config
      since `tailwindcss-animate` is not used. `@radix-ui/react-accordion` was added as the one new
      dependency; slot and tabs were already present at the root.
      `eslint.config.js` now also exempts `src/components/ui/**/*.tsx` from `react-refresh`, matching the
      existing exemption for the app's generated wrappers.
- [x] Wire root scripts: `landing:dev`, `landing:build`, `landing:start`, `landing:lint`,
      `landing:typecheck`, `landing:verify-downloads`.
- [x] Integration scope decided: the site is linted and typechecked through its own `landing:*` scripts
      and is deliberately **outside** `npm run lint`, `npm run typecheck`, and
      `scripts/release-gate.mjs` — it is not part of the app release, and pulling it into the root
      `tsconfig.json` would drag site sources into the Electron typecheck graph. Verified
      `scripts/check-architecture.mjs` does not walk `packages/`, so the new package is not flagged.
- Current `src/App.tsx` is a scaffold shell (theme toggle, tagline, gated CTA, artifact list) that
  exists only to prove tokens, accent, and download config wiring. Phase 3 replaces it.

## 4. Phase 2 — Assets

- [x] **SVG logo traced** from `devdesk-logo-top-left-transparent.png` / `build/icon.png`: the "D" built
      from a top bar, a bottom bar with a corner stub, and a right curve, plus the terminal prompt
      chevron and the green cursor block (`#33d02b`, sampled from the icon).
      - `src/components/Logo.tsx` exports `LogoMark` (strokes use `currentColor`, so **one file covers
        light and dark**) and `Wordmark` (mark plus "DevDesk" set in the site's own type, optionally in
        the product icon tile). Setting the wordmark in live text instead of baked letterform outlines
        keeps it selectable, accessible, and theme-aware.
      - `public/logo-mark.svg` mirrors the component for `<img>`/favicon use;
        `public/logo-mark-tile.svg` is the app-icon-parity tile (mark on `#0b1128`, with the
        white → steel-blue gradient sampled from the raster icon).
      - `viewBox` is `26 24 208 208` so the mark is optically centred rather than sitting in the corner
        of a 0–256 box. Verified in a browser at both 32 px and full size, and in both themes.
- [x] **Favicons and a 1200x630 OG image** generated from `build/icon.png` by
      `packages/landing/scripts/generate-assets.mjs` (`npm run landing:assets`), which reuses the jimp +
      png-to-ico toolchain already in `scripts/generate-app-icons.mjs` rather than extending it — the app
      icon script writes app/runtime copies, this one writes web collateral.
      Outputs: `favicon.ico` (16/32/48 multi-size, 15 kB), `favicon-32/192/512.png`,
      `apple-touch-icon.png` (180), `og-image.png` (1200x630, icon plus title, tagline, and trust line).
      `public/site.webmanifest` and the `<head>` links in `index.html` are wired to them.
- [x] **Asset verification**: `npm run landing:verify-assets` checks that every generated file and both
      logo SVGs exist, that `og-image.png` is exactly 1200x630, and that each screenshot in the manifest
      exists at exactly 1600x1000. It reports and exits 0 by default; `-- --strict` exits 1 (use it in the
      pre-ship check once screenshots exist).
- [ ] **Capture 5–7 product screenshots** at a fixed 1600x1000 window size: Projects, Command Vault,
      Terminal, Containers, Engine search, Git workspace. **Blocked on a human**: this needs the app
      running with real, presentable data (no private paths, tokens, or repo names), which is a judgement
      call, not something to synthesise. Everything around it is ready:
      - `src/config/screenshots.ts` is the manifest — id, file name, `src`, required alt text, and the
        exact view to capture for each of the seven shots (six app tabs + git), with `projects`
        flagged as the hero image.
      - `scripts/capture-screenshot.ps1` does the mechanical part on Windows: finds the DevDesk window
        (matching process name *and* title, so an editor with "DevDesk" in its title cannot be captured by
        mistake), resizes it so the **client** area is exactly 1600x1000, focuses it, waits for the UI to
        settle, and writes `public/screenshots/<id>.png`.
      - Procedure: `npm run dev`, open the target tab, then
        `powershell -File packages/landing/scripts/capture-screenshot.ps1 -Id projects` (repeat per id),
        then `npm run landing:verify-assets`. Requires 100% display scaling and a screen larger than
        1600x1000; the script warns if the window was clamped.
- [ ] Optional but high value for a desktop tool: a 20–30s screen-recorded hero loop (mp4 + webm), stored
      under `public/media/` (already allowed by the `.gitignore` negation).

## 5. Phase 3 — Page structure (implemented)

Single scrolling page composed in `src/App.tsx`. Section components live under `src/sections/`;
copy and feature lists live under `src/config/content.ts` so the page cannot claim something the
app does not do. Copy is derived from `Readme.md`, `apps/renderer/app/lib/appShell.ts`, and
`docs/install.md`.

1. [x] **Nav** (`sections/Nav.tsx`) — sticky glass header: `Wordmark`, Features / Download / Docs
      anchors, GitHub icon, theme toggle. Docs opens the install guide on GitHub.
2. [x] **Hero** (`sections/Hero.tsx`) — version + platform + MIT badges; headline and local-first
      sub-line; dual CTA (primary download when any artifact is `available`, otherwise scroll-to-
      download); hero screenshot via `Screenshot` (eager).
3. [x] **Trust strip** (`sections/TrustStrip.tsx`) — Local-first / No account / No telemetry /
      MIT licensed, each with a one-line detail.
4. [x] **Feature sections** (`sections/Features.tsx`) — seven alternating text/screenshot rows
      mirroring the app nav (Projects, Commands, Engine, Containers, Terminal, History) plus the
      git workspace, each using the same lucide icon as the app.
5. [x] **Secondary feature grid** (`sections/SecondaryFeatures.tsx`) — Health checks, Bugs with
      context snapshots, Export/Import, Tray, LLM context export, Cmd/Ctrl+K command palette.
6. [x] **How it works** (`sections/HowItWorks.tsx`) — three steps: install, add projects, run
      commands.
7. [x] **Download** (`sections/Download.tsx`) — per-platform cards with the exact artifact names,
      system requirements, and the honest caveats from `docs/install.md:80-85`. Availability is
      **per-artifact** (`available` on each entry in `src/config/site.ts`) so Windows can ship
      while Linux is still building. Banner only shows when nothing is live.
8. [x] **Non-goals and FAQ** (`sections/Honesty.tsx`) — non-goals from `Readme.md:109-111` as an
      honesty list; FAQ accordion covers privacy, data location, Docker/WSL, unsigned Windows
      installer, macOS timeline, and no auto-update.
9. [x] **Footer** (`sections/Footer.tsx`) — product / project / support columns, licence, support
      contact path (`siteMeta.supportUrl` → GitHub issues).

Supporting pieces for the page:

- `src/components/Screenshot.tsx` — 16:10 frame with labelled fallback when the PNG is missing
  (so layout is identical before and after capture). Server returns a real 404 for missing files
  with extensions (not SPA HTML), so `onError` fires reliably.
- `src/hooks/useTheme.ts` — dark default, persisted toggle.
- Desktop-first styling with basic `md:` breakpoints already applied; the full 390/768/1440 pass
  is Phase 4.

## 6. Phase 4 — Polish and ship

- Responsive pass at 390 / 768 / 1440. Dark mode default with a toggle. Respect
  `prefers-reduced-motion`.
- SEO: title and description, Open Graph and Twitter cards, `sitemap.xml`, `robots.txt`, JSON-LD
  `SoftwareApplication`.
- Accessibility: full keyboard navigation, alt text on every screenshot, contrast check on
  `--muted-foreground` in both themes.
- Performance: Lighthouse >= 95, lazy-loaded screenshots, self-hosted fonts (JetBrains Mono for code
  fragments).
- **Railway deployment**: the build/start contract is already committed (`railway.json` + `server.mjs`).
  Remaining work is service creation: point a Railway service at this repo with root directory
  `packages/landing`, confirm it picks up `railway.json`, enable deploy-on-push to `main`, and attach a
  custom domain once one is chosen.
- Publish the GitHub Release for 0.1.0 with the three installer artifacts, run
  `npm run landing:verify-downloads`, then set `releasePublished = true` in `src/config/site.ts`.
- ~~Add `homepage` and `repository` fields to the root `package.json`.~~ Done (plus `bugs`).
- Update `docs/install.md:18` to point at the published page, and tick the public install page item in
  `docs/beta-release-checklist.md`.

## 7. Sequencing

| Step | Output | Status |
| ---- | ------ | ------ |
| 0 | Phase 0 decisions answered and their follow-on work implemented | done |
| 1 | Scaffold builds; tokens match the app | done |
| 2 | SVG logo and screenshots committed | logo, favicons, and OG image done; screenshot capture pending (needs the app running with real data) |
| 3 | Full page, desktop-only styling | done |
| 4 | Responsive, SEO, accessibility, Railway deploy | pending (Railway config + server ready; dark default + reduced-motion already in) |

## 8. Risks

- **Screenshots are the critical path** and the only Phase 2 item still open. Roughly 60% of the page is
  imagery, and Phase 3 layout cannot be finalised without real images. *Partly mitigated:* dimensions are
  fixed at 1600x1000 in `src/config/screenshots.ts`, `.gitignore` negates
  `packages/landing/public/screenshots/**` and `.../public/media/**`, capture is scripted
  (`scripts/capture-screenshot.ps1`), and `landing:verify-assets` enforces presence and size. What remains
  is a human running the app with presentable data.
- **GitHub Release must exist before the download section is truthful.** *Mitigated:* every URL
  derives from `packages/landing/src/config/site.ts` with a **per-artifact** `available` flag, so
  Windows can ship while Linux still shows "Not published yet". `npm run landing:verify-downloads`
  fails only when a claimed-available asset is missing, and reminds you to flip the flag when a
  previously-unavailable asset comes online.
- **Railway serves static output via a running process**, unlike Pages/Vercel. *Mitigated:*
  `server.mjs` binds `process.env.PORT` on `0.0.0.0`, `railway.json` pins the build/start commands and a
  `/healthz` check, and both were verified locally.
- **Token drift.** The site copies the app's token blocks rather than importing them, so app theme
  changes must be re-copied by hand. `packages/landing/src/index.css` carries a header comment saying so.
- ~~**Accent hue selection.**~~ Settled in decision 4 and contrast-checked in both themes.
