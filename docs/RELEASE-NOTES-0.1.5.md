# DevDesk v0.1.5 — Lifecycle and streaming safety

**Label:** Private beta / prerelease
**Docs:** [install.md](./install.md) · [user-guide.md](./user-guide.md) · [release.md](./release.md)

## Maintenance fixes

- DevDesk now acquires a single-instance lock so duplicate launches focus the existing app instead of starting a second runtime.
- Closing the main window on Windows or Linux hides it to the enabled system tray; the tray Quit action still exits the app cleanly.
- Quitting stops active command-vault process trees and Docker log-follow streams, with a bounded cleanup wait.
- Docker log subscriptions now stop when their renderer is destroyed, crashes, or performs a full main-frame navigation.
- Broadcast delivery now skips destroyed windows and web contents.

## Validation

- The release gate passed for the merged source across Windows and Linux, including native tests, Rust tests, coverage, and packaged-app smoke checks.
- Windows and Linux installers and SHA-256 checksum files are published with this prerelease.

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.5-win-x64.exe` (NSIS) | Unsigned private-beta build |
| Linux x64 | `DevDesk-0.1.5-linux-x64.deb` | Debian package |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed; SmartScreen may warn.
- Auto-update and macOS packaging are not enabled.
- Interactive packaged-app QA remains separate from automated package verification.
