# Beta / public-release checklist (maintainers)

Use this short list before tagging a release or calling the product launch-ready.

## Every candidate build

- [ ] Version bumped in `package.json` (and release notes file added/updated)
- [ ] `npm run release:gate` green on a clean checkout (or CI green on the release commit)
- [ ] Platform package smoke for each **claimed** OS:
  - [ ] Windows: `npm run verify:win-package` and/or install `DevDesk-*-win-x64.exe`
  - [ ] Linux: `npm run verify:linux-package` and AppImage/deb smoke
- [ ] [manual-qa.md](./manual-qa.md) updated for this version (fill Pass/Fail; no silent skips)
- [ ] Known limitations still accurate in [RELEASE-NOTES](./RELEASE-NOTES-0.1.0.md) / install docs
- [ ] No secrets in the repo or packaged artifact

## Private beta bar (current)

- [x] Windows engine IPC path contract green  
- [x] Native setup scripts reliable for Node vs Electron  
- [x] Windows + Linux package targets configured  
- [x] Release gate + CI workflow present  
- [x] Windows packaged launch + QA record  
- [ ] Linux interactive QA complete  
- [ ] Docs synchronized (install, data, release notes) — this PR set  
- [ ] Optional: Windows code signing  

## Public launch bar (later)

- [ ] All private beta items complete on **every** supported platform  
- [ ] Signed Windows installer (and macOS notarization if mac is claimed)  
- [x] Public install page + support contact path (`packages/landing`; support via GitHub issues)  
- [ ] Security review of IPC surface and shell execution paths  
- [ ] Backup/export attachment story improved or clearly documented for users  
- [ ] Auto-update strategy decided (or explicitly “manual updates only”)  

## Commands cheat sheet

```bash
npm run rebuild:native:node
npm run release:gate
npm run package:win          # Windows host
npm run package:linux        # Linux host
npm run verify:win-package
npm run verify:linux-package
```

Docs index: [install.md](./install.md) · [release.md](./release.md) · [native-modules.md](./native-modules.md) · [data-locations.md](./data-locations.md) · [manual-qa.md](./manual-qa.md)
