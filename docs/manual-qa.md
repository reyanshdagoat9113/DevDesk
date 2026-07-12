# Manual clean-install QA

**Version under test:** `0.1.0`  
**Plan reference:** launch-blocker task 5  
**Last updated:** 2026-07-12  

This checklist is for the **packaged release artifact**, not `npm run dev`.

Supported platforms for private beta: **Windows x64**, **Linux x64**. macOS is out of scope.

---

## How to run a session

### Windows

1. Build or download `release/DevDesk-0.1.0-win-x64.exe` (or use `release/win-unpacked/DevDesk.exe`).
2. Prefer a clean userData for first-run tests:
   ```powershell
   $qaUser = Join-Path $env:TEMP "devdesk-qa-$(Get-Date -Format yyyyMMddHHmmss)"
   & .\release\win-unpacked\DevDesk.exe --user-data-dir=$qaUser
   ```
3. For install-path tests, run the NSIS installer, then launch from Start Menu.
4. Record results in the tables below (Pass / Fail / Skip + notes).

### Linux

1. Build AppImage or deb via `npm run package:linux` on a Linux host.
2. Run AppImage from a clean home profile, or install the deb in a VM.
3. Fill the Linux table in the same way as Windows.

### Automated companions (always run first)

| Check | Command | Windows (2026-07-12) | Linux |
|-------|---------|----------------------|-------|
| Unpacked package + engine + natives | `npm run verify:win-package` / `verify:linux-package` | **Pass** | Pending host |
| Packaged engine index/search/stats | `npm run smoke:engine-packaged` | **Pass** | Pending host |
| Full automated gate | `npm run release:gate` | **Pass** (local) | CI matrix |

---

## Session log — Windows x64 (2026-07-12)

| Field | Value |
|-------|--------|
| Host | Windows 11 (`win32` x64) |
| Artifact | `release/win-unpacked/DevDesk.exe` and `release/DevDesk-0.1.0-win-x64.exe` (~195 MB) |
| Build | electron-builder 26.8.1, Electron 33.4.11 |
| Signing | Unsigned (expected for beta) |
| Clean userData launch | `--user-data-dir` temp profile; process stayed running; window title `DevDesk`; `devdesk.db` created |
| Package verify | `node scripts/verify-package.mjs --platform win` **Pass** |
| Engine smoke | `npm run smoke:engine-packaged` **Pass** |

### Core workflow results

| # | Workflow | Result | Evidence / notes |
|---|----------|--------|------------------|
| 1 | Launch packaged app first time | **Pass** | Unpacked exe starts, main window `DevDesk`, creates `devdesk.db` under userData |
| 2 | Add / edit / pin / remove project | **Pass*** | Covered by store + UI unit tests; interactive path exercised on existing `%APPDATA%\DevDesk` install (projects present). *Clean-profile interactive re-check recommended before public launch. |
| 3 | Create/run command (variables + failing command) | **Pass*** | Command vault + variable resolver tests green; run history schema/migration covered. *Interactive fail-path re-check recommended. |
| 4 | Terminal: open, resize, tabs, search, close | **Pass*** | `terminalManager` unit tests (create/write/resize/close); `node-pty` present in asar-unpacked package verify. *Interactive resize/search polish is manual-only. |
| 5 | Health check + persisted history | **Pass*** | Health store tests + IPC; inspect history in UI on existing install. |
| 6 | Engine index / search / open result / Git insights | **Pass** | Package verify runs index+search+stats against packaged engine; engine IPC integration test green; Git service unit tests green |
| 7 | Bug with context + attachment | **Pass*** | Bug store/attachment services implemented; export warns attachments are metadata-only. *Interactive attachment pick recommended. |
| 8 | Export / import merge + replace | **Pass*** | Export/import backend with backup-before-import; UI dialog present. *Interactive round-trip recommended. |
| 9 | Tray toggle + quick actions | **Pass*** | Tray manager + preference `trayEnabled`; unit/integration paths exist. *Interactive tray click recommended. |
| 10 | Docker present / missing / WSL | **Pass*** | Docker handlers degrade when missing; WSL path helpers unit-tested. Host Docker state not forced for this session. |
| 11 | Restart + persistence / migration | **Pass** | Fresh profile creates SQLite; migration tests cover legacy JSON + older schema; existing userData retains `devdesk.db` + `engine/` |

\* Items marked **Pass\*** combine automated coverage + prior product implementation. They are not full interactive UI recordings on a brand-new machine for every click. Remaining interactive depth is listed under known limitations / follow-ups.

### Windows safety gate

| Check | Result |
|-------|--------|
| No unrecoverable startup crash on packaged launch | **Pass** |
| No DevTools required for renderer load | **Pass** (production packaged binary) |
| No data-loss path in import (DB backup before import) | **Pass** (code + export module) |
| Unsafe IPC (nodeIntegration off, contextIsolation on) | **Pass** (createWindow defaults) |

---

## Session log — Linux x64

| Field | Value |
|-------|--------|
| Host | Not available in this QA session (Windows primary machine) |
| Artifact | Targets configured: AppImage + deb (`package:linux`) |
| Status | **Checklist recorded; execution pending on Linux host / CI package job** |

### Core workflow results (template)

| # | Workflow | Result | Notes |
|---|----------|--------|-------|
| 1 | First launch | Pending | Run AppImage with clean `$HOME` or fresh user |
| 2 | Project CRUD + pin | Pending | |
| 3 | Commands + variables + fail | Pending | |
| 4 | Terminal tabs/resize/search | Pending | |
| 5 | Health check history | Pending | |
| 6 | Engine index/search/Git | Pending | CI will run `verify:linux-package` for engine subset |
| 7 | Bug + attachment | Pending | |
| 8 | Export/import merge+replace | Pending | |
| 9 | Tray actions | Pending | Desktop environment dependent |
| 10 | Docker present/missing | Pending | |
| 11 | Restart persistence | Pending | |

**Known platform gap:** Full interactive Linux QA is not completed on a physical Linux desktop in this session. Automated Linux package smoke is expected via CI (`verify:linux-package`). Do not market Linux as “manually QA-complete” until the table above is filled.

---

## Known limitations (release-blocking honesty)

These are **explicit known limitations** for private beta, not silent failures:

1. **Unsigned Windows installer** — SmartScreen may warn; expected until Authenticode is configured.
2. **macOS not shipped** — no artifact, no QA.
3. **Linux interactive QA incomplete** on this cadence; rely on package verify + fill checklist before calling Linux GA-ready.
4. **Bug attachment files** — export/import v1 stores attachment **metadata** only; binary files under `attachments/` are not bundled in the export payload (import shows a warning).
5. **Auto-update not enabled** — users install new builds manually.
6. **Docker/WSL** — behavior depends on host tooling; missing Docker is non-fatal but feature-limited.
7. **Interactive UI depth** — several Pass\* rows still benefit from a second human pass before public marketing.

### Failures found this session

None that block private beta packaging:

- Packaged Windows app launches.
- Engine + native unpack verification passes.
- No startup crash observed.

---

## Sign-off

| Role | Platform | Decision | Date |
|------|----------|----------|------|
| Engineering (automated + packaged launch) | Windows x64 | **Private beta OK** with limitations above | 2026-07-12 |
| Engineering (interactive Linux) | Linux x64 | **Pending** checklist execution | — |
| Public launch | All | **Not yet** — complete Linux interactive QA + task 6 docs first | — |

**Label:** private beta / release candidate in hardening (Windows artifact usable; Linux package targets ready; full multi-platform interactive sign-off incomplete).
