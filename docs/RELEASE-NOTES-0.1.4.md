# DevDesk v0.1.4 — Data lifecycle safety

**Label:** Private beta / prerelease
**Docs:** [install.md](./install.md) · [user-guide.md](./user-guide.md) · [release.md](./release.md)

## Maintenance fixes

- Project removal and replace-mode imports now remove unreferenced attachment files after their database transactions complete.
- Project removal now cleans health-check runs and their dependent items.
- New exports use format 2 table headers, so imports map values by column name instead of SQLite column position. Existing format-1 backups remain supported.
- Export/import preview now surfaces the actual quick-export failure reason instead of returning an empty placeholder payload.
- WSL embedded terminals open in the selected project directory.

## Validation

- Automated release gate and the Windows/Linux package-verification workflows run for the tagged source.
- SHA-256 checksum files are published with each installer.

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.4-win-x64.exe` (NSIS) | Unsigned private-beta build |
| Linux x64 | `DevDesk-0.1.4-linux-x64.deb` | Debian package |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed; SmartScreen may warn.
- Auto-update and macOS packaging are not enabled.
- Interactive packaged-app QA remains separate from automated package verification.
