# DevDesk v0.1.2 — Cross-platform packaging and workspace refinements

**Label:** Private beta / prerelease

## Highlights

- Refined project, automation, and performance-engine surfaces for a more consistent workspace.
- Reorganized Performance Engine index and search controls, and improved indexing scope and Git-performance handling.
- Hardened packaged engine startup, index, and verification paths on both Windows and Linux; Linux probe and package verification run under Xvfb in CI.
- Added tag-driven GitHub Release automation that builds, verifies, checksums, and publishes the Windows x64 installer and Linux x64 Debian package together.

## Validation

- Release-gate CI on Windows and Linux.
- Windows NSIS build plus unpacked-package verification.
- Linux Debian build plus unpacked-package verification under Xvfb.
- SHA-256 checksum generated for every published installer.

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.2-win-x64.exe` (NSIS) | Unsigned private-beta build |
| Linux x64 | `DevDesk-0.1.2-linux-x64.deb` | Debian package |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed; SmartScreen may warn.
- Auto-update and macOS packaging are not enabled.
- Linux interactive QA remains a separate release requirement.
