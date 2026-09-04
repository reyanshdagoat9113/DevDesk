# Manual clean-install QA

**Current product version:** `0.1.3`
**Last Windows automated session logged below:** `0.1.0` (2026-07-13) — re-run the harness against a fresh `0.1.3` artifact before calling that version signed off.
**Related:** [release.md](./release.md) · [beta-release-checklist.md](./beta-release-checklist.md) · [install.md](./install.md)

This checklist separates automated clean-profile integration evidence from manual actions in the packaged UI.

Supported platforms for private beta: **Windows x64**, **Linux x64**. macOS is out of scope.

**Evidence rule:** `Automated pass` means the harness exercised the main-process or packaged-smoke path. `Manual pass` is a person performing the documented action in the packaged UI. Automated evidence must not be presented as completed interactive QA. Interactive Windows and Linux rows below are still the launch gap.

---

## How to run a session

### Windows

1. Run the automated companions and fresh-artifact harness:
   ```powershell
   npm run verify:win-package
   npm run smoke:engine-packaged
   npm run qa:clean-install:win
   ```
   `qa:clean-install:win` builds a fresh NSIS/unpacked artifact before testing it and rejects artifacts older than 30 minutes.
2. Report path: `release/clean-install-qa-report.json`.
3. For manual sign-off, install the NSIS artifact or launch with a new profile and perform every row in the interactive table:
   ```powershell
   $qaUser = Join-Path $env:TEMP "devdesk-qa-$(Get-Date -Format yyyyMMddHHmmss)"
   & .\release\win-unpacked\DevDesk.exe --user-data-dir=$qaUser
   ```

### Linux

1. Build the deb via `npm run package:linux` on a Linux host.
2. Run `npm run verify:linux-package`.
3. Execute the interactive workflow table using the packaged application.
4. Record results in the Linux section below.

### Automated companions

| Check | Command | Windows (2026-07-13) | Linux |
|-------|---------|----------------------|-------|
| Unpacked package + engine + natives | `verify:win-package` / `verify:linux-package` | **Automated pass** | Pending host |
| Packaged engine index/search/stats | `smoke:engine-packaged` | **Automated pass** | Pending host |
| Clean-profile backend workflow harness | `qa:clean-install:win` | **Automated pass** (11/11) | N/A (Windows script) |
| Full automated gate | `release:gate` | **Automated pass** | CI matrix |

---

## Automated session log — Windows x64 (2026-07-13)

| Field | Value |
|-------|--------|
| Host | Windows 11 (`win32` x64) |
| Installer | `release/DevDesk-0.1.0-win-x64.exe` |
| Installer SHA-256 | `b26c68913161c626a1e2249de6367f7bfd9b8a4457f521bb76621924c405c5be` |
| Unpacked exe | `release/win-unpacked/DevDesk.exe` |
| Unpacked SHA-256 | `e494ddee8ffd0b40e9a5d43db0894ccdae862fda547842624d3ea11e878111ce` |
| Clean userData | Temporary backend profile plus a separate `--user-data-dir` packaged launch |
| Evidence report | `release/clean-install-qa-report.json` and committed `docs/qa-evidence/clean-install-qa-windows-2026-07-13.json` |
| Harness summary | **11 passed, 0 failed, 0 skipped** |

### Automated harness results

| # | Workflow subset | Result | Evidence and boundary |
|---|-----------------|--------|-----------------------|
| 1 | Launch packaged app first time | **Automated pass** | Packaged exe remained alive and created `devdesk.db` under clean `launchUserData`; renderer interactions were not driven |
| 2 | Add / edit / pin / remove project | **Automated pass** | Direct store calls under an Electron mock; packaged UI pending |
| 3 | Create/run command (variables + failing) | **Automated pass** | Resolver, shell execution, and persisted success/failure history; packaged UI pending |
| 4 | Terminal open / resize / close | **Automated pass** | Live `node-pty` session must open, resize, close, and release its process; tabs/search UI pending |
| 5 | Health check + persisted history | **Automated pass** | Main-process health checks and store history; packaged UI pending |
| 6 | Engine index / search / Git | **Automated pass** | Fresh fixture index, search result, and Git branch required; opening a result in the UI pending |
| 7 | Bug with attachment | **Automated pass** | Store record plus copied attachment file; packaged picker/UI pending |
| 8 | Export / import merge + replace | **Automated pass** | Direct store round-trip and database backups; packaged dialogs/UI pending |
| 9 | Tray preference toggle | **Automated pass** | SQLite preference persistence only; live tray icon and quick actions pending |
| 10 | Docker missing state | **Automated pass** | Host daemon-unavailable detection only; DevDesk UI, Docker-present, and WSL paths pending |
| 11 | Restart + persistence | **Automated pass** | A fresh Node process reopened SQLite; packaged restart UI pending |

### Interactive Windows workflow status

| # | Manual packaged-app action | Result |
|---|----------------------------|--------|
| 1 | First launch and renderer interaction | Pending |
| 2 | Project CRUD and pinning | Pending |
| 3 | Command creation, variables, success, and failure; run output and **Open in History** with project context | Pending |
| 4 | Terminal tabs, resize, search, and close | Pending |
| 5 | Health check and history inspection, including search/filter/sort and focused run output | Pending |
| 6 | Engine index, search, open result, and Git insights | Pending |
| 7 | Bug context and attachment picker | Pending |
| 8 | Export/import merge and replace dialogs | Pending |
| 9 | Tray toggle and quick actions | Pending |
| 10 | Docker-present, Docker-missing, and WSL fallback | Pending |
| 11 | Packaged restart and persistence | Pending |
| 12 | WSL project: embedded terminal opens at the selected project path | Pending |

---

## Interactive session log — Linux x64

| Field | Value |
|-------|--------|
| Host | Not available in this session (Windows primary machine) |
| Artifact | Debian package target: `DevDesk-0.1.3-linux-x64.deb` (`package:linux`) |
| Status | **Execution pending on Linux host** |

The Linux interactive workflow uses the same 12 manual actions listed in the Windows table, except the Windows-only WSL project check. All applicable rows remain pending until executed on a representative Linux desktop.

---

## Known limitations

1. **Windows interactive QA remains pending** — the harness is backend integration plus packaged startup smoke, not packaged UI automation.
2. **Linux interactive QA remains pending** — do not claim multi-platform manual QA complete.
3. **Unsigned Windows installer** — SmartScreen may warn.
4. **macOS not shipped.**
5. **Attachment binaries** — export stores metadata only; the harness records the import warning.
6. **Auto-update not enabled.**
7. **Docker coverage is partial** — this host had the client installed but daemon unavailable.
8. **Public-launch bar** — task 15 still requires installer/upgrade/uninstall, interactive platform matrices, provenance, and no pending rows.

### Failures found in the corrected automated session

None when the final evidence report records 11/11 and the command exits successfully.

---

## Sign-off

| Role | Platform | Decision | Date |
|------|----------|----------|------|
| Engineering automated harness + packaged startup | Windows x64 | **Automated evidence complete; interactive pending** | 2026-07-13 |
| Engineering interactive Windows | Windows x64 | **Pending** | — |
| Engineering interactive Linux | Linux x64 | **Pending** | — |
| Public launch | All | **Not yet** (see task 15 and security tasks 7–14) | — |

**Label:** private beta / internal hardening — automated Windows backend and startup evidence recorded; full packaged UI and Linux manual QA remain open.
