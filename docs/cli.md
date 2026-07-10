# CLI reference

Commander powers argument parsing and built-in help. Use `--help` on the root command or any subcommand:

```bash
dockup --help
dockup deploy --help
dockup validate --help
dockup init --help
```

## Commands

```bash
dockup deploy --env <name> [options]
dockup validate [options]
dockup init [name]
dockup --version
dockup --help
```

## `dockup deploy`

Builds images, pushes to registry, generates `out/<env>/docker-compose.yml` and `.env`, then validates with `docker compose config`.

| Flag              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `--env, -e`       | Environment key (required)                        |
| `--config, -c`    | Explicit path to `*.dockup.json`                  |
| `--root, -r`      | Repository root for build contexts (default: `.`) |
| `--only`          | Build/push only one container id                  |
| `--skip-build`    | Skip docker build                                 |
| `--skip-push`     | Skip docker push                                  |
| `--generate-only` | Generate compose artifacts only                   |
| `--dry-run`       | Log docker commands without running them          |
| `--json`          | Structured JSON output                            |
| `--quiet, -q`     | Errors only                                       |
| `--verbose, -v`   | Debug logging                                     |

Interactive deploy runs show a listr2 task list (Config → Preflight → Build → Push → Generate → Validate). Use `--json` or `--quiet` for machine-readable or minimal output without the task list.

### Examples

```bash
dockup deploy --env prod
dockup deploy --env dev --only api
dockup deploy --env prod --generate-only --root .
dockup deploy --env prod --config ./deploy/app.dockup.json --dry-run
```

## `dockup validate`

Validates config (JSON Schema + semantic checks + env resolution). Does not require Docker.

```bash
dockup validate
dockup validate --env prod
dockup validate --config ./app.dockup.json --json
dockup --json validate --config ./app.dockup.json
```

| Flag           | Description                                       |
| -------------- | ------------------------------------------------- |
| `--env, -e`    | Validate one environment (default: all)           |
| `--config, -c` | Explicit path to `*.dockup.json`                  |
| `--root, -r`   | Repository root for build contexts (default: `.`) |
| `--json`       | Structured JSON output                            |
| `--quiet, -q`  | Errors and warnings only                          |
| `--verbose, -v`| Debug logging                                     |

## `dockup init`

Creates `<name>.dockup.json` from the minimal template.

```bash
dockup init myapp
```

## Exit codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | Success                                      |
| 1    | CLI, config, or compose generation error     |
| 2    | Docker command failed (incl. preflight)      |
| 3    | Unexpected runtime error                     |

Exit code `1` covers phases such as `CLI`, `CONFIG`, and `GENERATE`. Exit code `2` covers `PREFLIGHT`, `BUILD`, `PUSH`, and `VALIDATE`.

## JSON output

Success (`deploy`):

```json
{
  "ok": true,
  "command": "deploy",
  "env": "prod",
  "namespace": "myorg",
  "registry": "ghcr.io",
  "tag": "prod",
  "built": ["api"],
  "pushed": ["api"],
  "artifacts": ["out/prod/docker-compose.yml", "out/prod/.env"],
  "elapsedSec": 42.1
}
```

Failure:

```json
{
  "ok": false,
  "phase": "CONFIG",
  "message": "Environment \"prod\" resolution failed: Unresolved symbol \"MISSING\".",
  "hint": null,
  "detail": null,
  "cause": null
}
```
