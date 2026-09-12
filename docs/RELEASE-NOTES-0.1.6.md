# DevDesk v0.1.6 — Maintenance findings and two follow-up fixes

**Label:** Private beta / prerelease
**Docs:** [install.md](./install.md) · [user-guide.md](./user-guide.md) · [release.md](./release.md)

## Highlights

- Completes the remaining v0.1.2 maintenance findings (security hardening, command-edit parity, and polish).
- Command edit now commits a project change as soon as a project is selected, so Save no longer keeps the previous project when a subdirectory is not chosen.
- Engine index open checks the on-disk schema version before applying current schema SQL, so a newer-schema database fails with a re-index message instead of a raw SQLite error.

## Also in this line

- Production CSP, renderer sandbox, navigation whitelist, and trusted-sender IPC on all invoke channels.
- Command project, working directory, and description can be edited or cleared.
- File-search index TTL, terminal exit flush, Ctrl+K in inputs, Docker/WSL fallback, tray run-last, ConPTY, and unmount guards.

## Validation

- Typecheck, lint, architecture lint, renderer, engine, desktop, and engine-IPC tests passed on the merged source.
- Windows and Linux installers and SHA-256 checksum files are published with this prerelease.

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.6-win-x64.exe` (NSIS) | Unsigned private-beta build |
| Linux x64 | `DevDesk-0.1.6-linux-x64.deb` | Debian package |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed; SmartScreen may warn.
- Auto-update and macOS packaging are not enabled.
- Interactive packaged-app QA remains separate from automated package verification.
