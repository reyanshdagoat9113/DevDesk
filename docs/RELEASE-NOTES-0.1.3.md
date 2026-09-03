# DevDesk v0.1.3 — Platform launcher reliability

**Label:** Private beta / prerelease
**Docs:** [install.md](./install.md) · [user-guide.md](./user-guide.md) · [release.md](./release.md)

## Maintenance fixes

- Linux editor and terminal launches now honor the selected preference instead of always falling back to VS Code and the system terminal.
- Added Linux launcher candidates for Cursor, WebStorm, IntelliJ IDEA, Sublime Text, GNOME Terminal, and Konsole, with ordered fallbacks when a preferred command is unavailable.
- Custom editor and terminal commands now quote project and file paths for the active shell dialect, including paths containing spaces and shell metacharacters.
- Windows PowerShell and Command Prompt launch paths use literal-safe quoting.
- Windows detached launches retry through the shell when an executable is available through a shell shim but direct process spawning reports `ENOENT`.
- Centralized detached-process launching and added focused regression coverage for launcher selection, fallback ordering, and shell quoting.

## Validation

- Full release-gate CI on Windows and Linux with Node.js 22 and 24 lanes.
- Windows and Linux packaged-app smoke verification.
- Native Rust engine tests and packaged-engine IPC verification.
- SHA-256 checksum generated for every published installer.

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.3-win-x64.exe` (NSIS) | Unsigned private-beta build |
| Linux x64 | `DevDesk-0.1.3-linux-x64.deb` | Debian package |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed; SmartScreen may warn.
- Auto-update and macOS packaging are not enabled.
- Interactive packaged-app QA remains separate from automated package verification.
