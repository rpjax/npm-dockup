# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-07-12

### Added

- **Hosted subprocess output:** peek mode (default) shows the last few framed lines via Listr; no raw Docker flood on stdout
- **`--stream-logs`:** framed panel streaming for full subprocess output (replaces v2.0 inherit behavior)
- **`--with-logs`:** include captured subprocess output in JSON deploy responses
- **Run Report:** unified end-of-run summary for deploy, validate, and init (environment, built/pushed, artifacts, images)
- **Next steps:** contextual follow-up commands after each successful command
- **Session header:** compact command context at the start of interactive runs
- JSON success payloads now include `report` and `nextSteps`; JSON errors include `elapsedSec` and `exitCode`

### Changed

- Deploy interactive mode now shows the same rich Run Report as linear mode (no more minimal `deployComplete`)
- Logger timestamps only appear with `--verbose`
- `--json` stdout is guaranteed clean (subprocess output captured, not printed)

### Fixed

- Docker build/push logs no longer break Listr2 layout on Windows terminals
- `--stream-logs` no longer interleaves panel output with Listr (uses linear pipeline)
- Subprocess lines split across stdout chunks are reassembled correctly
- Dry-run preflight summary no longer claims daemon OK when checks were skipped

## [2.0.2] - 2026-07-11

### Fixed

- Windows: `docker build`, `docker push`, and `docker compose` no longer break when repo paths contain spaces (`spawn` now uses `shell: false` instead of delegating to `cmd.exe`)

## [2.0.1] - 2026-07-10

### Changed

- Complete README: package contents, shipped examples catalog, full field reference, dependsOn & healthcheck guide
- npm package ships `docs/` and `CHANGELOG.md` alongside examples and schema

## [2.0.0] - 2026-07-10

### Added

- **Compose-complete model:** `imageRef`, `command`, `entrypoint`, `labels`, `healthcheck`, `dependsOn` with conditions
- Container capabilities: `capAdd`, `capDrop`, `shmSize`, `privileged`, `user`, `workingDir`, `init`, `profiles`, `restart`
- Resource limits: `memLimit`, `memswapLimit`, `cpus`, `cpuShares`, `pidsLimit`
- Multi-network support: environment `networks[]`, per-service `networks`, `extraHosts`, `hostname`, `domainname`
- Volume options: `readOnly` mounts, environment `volumes[]` with `external`/`driver`
- `envFile` paths per container
- Build options: `platform`, `buildTarget`
- Escape hatch: `compose` object at service and environment level (deep-merge)
- Example: `examples/compose-complete.dockup.json` (Traefik + sidecar + app pattern)
- Docs: `docs/migration-v2.md`

### Changed

- **Breaking:** `dependsOn` is now `[{ "id": "...", "condition": "..." }]` (no string shorthand)
- **Breaking:** `image` or `imageRef` required per container (`image` and `imageRef` are mutually exclusive)
- Pull-only services use `imageRef` and skip build/push

### Removed

- v1 `dependsOn: ["api"]` string array syntax

## [1.1.0] - 2026-07-10

### Added

- Commander-based CLI parsing with native subcommand help (`dockup deploy --help`, etc.)
- listr2 task pipeline for interactive `deploy` output
- picocolors for terminal styling in the logger

### Changed

- Deploy default output shows a visual task list instead of step-by-step log lines
- Internal CLI structure: `program.ts`, `options.ts`, `context.ts`, `deploy-tasks.ts`

### Removed

- Manual argument parser (`parser.ts`) and static help (`help.ts`)

No breaking CLI syntax changes.

### Fixed

- Global flag merge in error paths (`--json` on subcommands)
- Quiet deploy summary leak
- Duplicate failure output after listr2 task errors
- `init` help no longer advertises unused `--config` / `--root`

## [1.0.0] - 2026-07-10

### Added

- TypeScript CLI with subcommands: `deploy`, `validate`, `init`
- Modern flags: `--env`, `--config`, `--root`, `--only`, `--skip-build`, `--skip-push`, `--generate-only`, `--dry-run`, `--json`
- Config format `*.dockup.json` with JSON Schema validation
- Multi-registry support via optional `registry` per environment
- Compose generation using YAML library
- GitHub Actions CI and tag-based npm publish workflow
- Documentation in `docs/`

### Changed

- **Breaking:** replaced `env=prod` syntax with `dockup deploy --env prod`
- **Breaking:** renamed config suffix from `*.deploy.json` to `*.dockup.json`
- **Breaking:** `network` is now required (no default)
- **Breaking:** build contexts resolve from `--root` (default `.`) instead of parent directory

### Removed

- Legacy JavaScript monolith (`deploy.mjs`, `dockup.mjs`)
- Project-specific Nexus example config

[2.0.1]: https://github.com/rpjax/npm-dockup/releases/tag/v2.0.1
[2.0.0]: https://github.com/rpjax/npm-dockup/releases/tag/v2.0.0
[1.1.0]: https://github.com/rpjax/npm-dockup/releases/tag/v1.1.0
[1.0.0]: https://github.com/rpjax/npm-dockup/releases/tag/v1.0.0
