# DevDesk documentation

Start here. Docs are split by audience so you can skip what you do not need.

**Product version:** 0.1.2 (private beta)  
**Last reviewed:** 2026-08-22

## If you want to use DevDesk

| Doc | What it covers |
|-----|----------------|
| [../Readme.md](../Readme.md) | What DevDesk is, platforms, status |
| [install.md](./install.md) | Installers, first launch, uninstall |
| [user-guide.md](./user-guide.md) | Workspace, commands, terminals, engine, Git, shortcuts |
| [data-locations.md](./data-locations.md) | Where data lives, backup, export/import |
| [RELEASE-NOTES-0.1.2.md](./RELEASE-NOTES-0.1.2.md) | Current release notes |

## If you want to build or contribute

| Doc | What it covers |
|-----|----------------|
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Setup, PR bar, conventions |
| [../COMMANDS.md](../COMMANDS.md) | npm scripts |
| [native-modules.md](./native-modules.md) | `better-sqlite3` / `node-pty` ABI rebuilds |
| [architecture.md](./architecture.md) | Process model, IPC, packages, security |
| [architecture/module-boundaries.md](./architecture/module-boundaries.md) | Folder ownership rules |
| [data-model.md](./data-model.md) | SQLite entities and export version |
| [ui-libraries.md](./ui-libraries.md) | shadcn/ui + Radix conventions |
| [../packages/engine/README.md](../packages/engine/README.md) | Performance engine package |
| [../packages/engine/ARCHITECTURE.md](../packages/engine/ARCHITECTURE.md) | Engine internals |
| [../packages/landing/README.md](../packages/landing/README.md) | Public install page |

## If you are shipping a build

| Doc | What it covers |
|-----|----------------|
| [release.md](./release.md) | Packaging, CI, GitHub Releases, signing limits |
| [beta-release-checklist.md](./beta-release-checklist.md) | Maintainer pre-tag checklist |
| [manual-qa.md](./manual-qa.md) | Clean-install QA (automated vs interactive) |
| [test-review-ledger.md](./test-review-ledger.md) | Test disposition and coverage policy |

## Status and planning

| Doc | What it covers |
|-----|----------------|
| [../ROADMAP.md](../ROADMAP.md) | Shipped surface and remaining work |
| [../TODO.md](../TODO.md) | Open launch and maintenance items |

Historical feature specs and HTML milestone plans live under [planning/](./planning/) and in the repo-root files `New-features.md` and `Plans-for-features.md`. They are **not** the current task queue.

## Conventions

- Keep user-facing docs aligned with `package.json` version.
- Prefer short tables over long prose.
- When behavior changes (install, data, IPC, packaging), update the matching doc in the same change.
- Do not list completed work as open in `TODO.md` or `ROADMAP.md`.
