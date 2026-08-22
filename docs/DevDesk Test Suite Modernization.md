# DevDesk Test Suite Modernization

> Planning document. **Current dispositions and coverage floors:** [test-review-ledger.md](./test-review-ledger.md).  
> **How to run tests:** [../COMMANDS.md](../COMMANDS.md) · [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Summary

Modernize DevDesk's automated test suite so it reflects the current product, protects its highest-risk behavior, and provides credible evidence for private-beta release decisions. Every existing test and meaningful production surface will be reviewed, but new coverage will be prioritized by risk and behavior rather than test count or blanket coverage percentages.

## Context and problem

DevDesk has evolved substantially since much of its test suite was written. The current suites still contain useful behavioral and compatibility checks, but coverage is concentrated in a small set of comparatively thin surfaces while core workflows remain lightly tested or untested.

The principal confidence gaps affect command execution and automation, terminal and container lifecycles, privileged IPC boundaries, destructive persistence and import flows, attachments, Git operations, engine indexing and search, renderer orchestration, native modules, and packaged-runtime behavior. Some existing tests are repetitive, tautological, copy-focused, or preserve unreachable placeholders, while important Rust tests are not part of the normal release gate.

The audit also surfaced likely security, data-loss, and correctness defects. A test-only cleanup that records these failures without addressing the critical ones would leave the suite green-looking but untrustworthy.

## Why this matters now

DevDesk is feature-complete for its current private-beta scope, so release confidence increasingly depends on regression protection and honest validation rather than further feature breadth. The suite must distinguish real product guarantees from mocked behavior, package-layout checks, backend smoke tests, and pending interactive QA.

Without modernization, routine changes can silently break local data, process lifecycles, renderer synchronization, engine results, or privileged desktop operations. Runtime and native-dependency inconsistencies can also make local, CI, and packaged results exercise different software contracts.

## Affected systems and stakeholders


| Area                           | Why it is affected                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| DevDesk users                  | Reliability of local data, shell execution, terminals, containers, Git workflows, and imports |
| Renderer                       | Application orchestration, event subscriptions, state synchronization, and core workflows     |
| Electron desktop               | IPC security, persistence, filesystem access, native modules, and lifecycle cleanup           |
| Engine                         | Indexing, search, Rust worker protocol, child-process integration, and packaged resolution    |
| Maintainers and release owners | Trustworthy regression signals, reproducible environments, and honest release gates           |


## Scope

- Review and give an explicit disposition to every existing automated test and every meaningful production surface.
- Retain and strengthen tests that protect behavior, compatibility, migrations, confinement, timeouts, or real integrations.
- Remove or consolidate obsolete, unreachable, tautological, duplicated, and copy-only tests where they do not protect a genuine contract.
- Add deep behavioral coverage for security-sensitive, destructive, stateful, asynchronous, and process-boundary workflows.
- Add missing Rust enforcement, renderer and desktop integration coverage, real engine child-process contracts, and functional packaged native smokes.
- Align the supported runtime and native-dependency contract so local development, CI, tests, and packaged production exercise consistent dependencies.
- Fix critical security, data-loss, and correctness defects exposed by the new tests. Unrelated improvements and non-critical feature work remain outside this initiative.
- Establish a practical coverage baseline and ratchet it over time, with stronger expectations for critical modules than for low-risk presentation code.

## Scope boundaries

- Success is not defined by maximizing test count, requiring one shallow test per component, or pursuing 100% global coverage.
- Low-risk presentation details do not need exhaustive direct tests when higher-level behavior already protects the contract.
- Unimplemented product capabilities, such as placeholder health checks, are not added merely to make tests pass unless separately approved.
- Interactive packaged-app QA on Windows and Linux remains a distinct manual release requirement. Automated component, integration, process, native, and package smokes do not replace it.
- Detailed architecture, test seams, coverage thresholds, runtime-version selection, sequencing, and CI topology will be settled in the technical plan.

## Initiative outcome

The resulting suite should make failures meaningful: critical workflows are protected across success, validation or cancellation, backend failure, race and cleanup paths; obsolete tests no longer create false confidence; discovered critical defects have regression coverage; and the release gate accurately states what was exercised and what still requires manual verification.