# Beta / public-release checklist (maintainers)

Use this before tagging a release or calling the product launch-ready.

Current product version: **0.1.5**. Docs index: [README.md](./README.md).

## Every candidate build

- [ ] Version bumped in `package.json` and a `docs/RELEASE-NOTES-x.y.z.md` added/updated
- [ ] Landing `APP_VERSION` / download filenames in `packages/landing/src/config/site.ts` match
- [ ] `npm run release:gate` green on a clean checkout (or CI green on the release commit)
- [ ] Platform package smoke for each **claimed** OS:
  - [ ] Windows: `npm run verify:win-package` and/or install `DevDesk-*-win-x64.exe`
  - [ ] Linux: `npm run verify:linux-package` and deb install smoke
- [ ] [manual-qa.md](./manual-qa.md) updated for this version (Pass/Fail; no silent skips)
- [ ] Known limitations still accurate in release notes and [install.md](./install.md)
- [ ] No secrets in the repo or packaged artifact

## Private beta bar

- [x] Windows engine IPC path contract
- [x] Native setup scripts for Node vs Electron
- [x] Windows + Linux package targets
- [x] Release gate + CI
- [x] Windows packaged launch + automated QA record
- [x] Docs synchronized (install, data, architecture, user guide, release notes)
- [ ] Linux interactive QA complete
- [ ] Windows interactive QA rows complete
- [ ] Optional: Windows code signing

## Public launch bar (later)

- [ ] All private beta items complete on **every** supported platform
- [ ] Signed Windows installer (and macOS notarization if macOS is claimed)
- [x] Public install page + support path (`packages/landing`; GitHub issues)
- [ ] Security review of IPC and shell execution paths
- [ ] Backup/export attachment story improved or clearly documented (today: metadata only — see [data-locations.md](./data-locations.md))
- [ ] Auto-update strategy decided (or “manual updates only” kept explicit)

## Commands

```bash
npm run rebuild:native:node
npm run release:gate
npm run package:win          # Windows host
npm run package:linux        # Linux host
npm run verify:win-package
npm run verify:linux-package
```
