# DevDesk v0.1.2 — Cross-platform packaging and workspace refinements

**Label:** Private beta / prerelease  
**Docs:** [install.md](./install.md) · [user-guide.md](./user-guide.md) · [release.md](./release.md)

## Maintenance refresh (installers rebuilt from `main`)

- Renderer runtime errors no longer replace the whole workspace; bootstrap failures stay on a static screen, and later errors use a React error boundary plus a banner.
- Stop now kills the command process tree (Windows `taskkill /T`, POSIX process group), not only the shell wrapper.
- Command run output is capped (first 64 KiB + last 512 KiB) before it is stored.
- History and bug lists paginate without shipping full output bodies at startup; unknown command variables fail closed instead of running as literal `{{…}}` text.

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
