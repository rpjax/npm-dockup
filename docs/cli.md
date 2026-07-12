# CLI reference

> **v2.0 breaking change:** `dependsOn` is now an array of objects (`{ "id": "..." }`). Pull-only services use `imageRef`. See [migration-v2.md](migration-v2.md).

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

## Global flags

| Flag            | Description                                               |
| --------------- | --------------------------------------------------------- |
| `--config, -c`  | Explicit path to `*.dockup.json`                          |
| `--root, -r`    | Repository root for build contexts (default: `.`)         |
| `--json`        | Structured JSON on stdout (no subprocess terminal output) |
| `--quiet, -q`   | Errors and warnings only                                  |
| `--verbose, -v` | Debug logging with timestamps                             |
| `--stream-logs` | Framed full subprocess output                             |
| `--with-logs`   | Include captured subprocess logs in JSON deploy output    |

## `dockup deploy`

Builds images (built services only), pushes to registry, generates `out/<env>/docker-compose.yml` and `.env`, then validates with `docker compose config`. Containers with `imageRef` skip build/push.

| Flag              | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `--env, -e`       | Environment key (required)                                              |
| `--only`          | Build/push only one container id                                        |
| `--skip-build`    | Skip docker build                                                       |
| `--skip-push`     | Skip docker push                                                        |
| `--generate-only` | Generate compose artifacts only                                         |
| `--dry-run`       | Log docker commands without running them; skips `docker compose config` |

Interactive deploy runs show a listr2 task list (Config → Preflight → Build → Push → Generate → Validate) with **peek** subprocess output under active tasks, then a **Run Report** and **Next steps**. With `--stream-logs`, the pipeline runs in linear mode with framed panels instead of Listr. Use `--json` or `--quiet` for machine-readable or minimal output.

### Examples

```bash
dockup deploy --env prod
dockup deploy --env dev --only api
dockup deploy --env prod --generate-only --root .
dockup deploy --env prod --config ./deploy/app.dockup.json --dry-run
dockup deploy --env prod --json --with-logs
dockup deploy --env prod --stream-logs
```

## `dockup validate`

Validates config (JSON Schema + semantic checks + env resolution). Does not require Docker.

```bash
dockup validate
dockup validate --env prod
dockup validate --config ./app.dockup.json --json
dockup --json validate --config ./app.dockup.json
```

| Flag        | Description                             |
| ----------- | --------------------------------------- |
| `--env, -e` | Validate one environment (default: all) |

Successful human-mode runs print a Run Report and next steps.

## `dockup init`

Creates `<name>.dockup.json` from the minimal template.

```bash
dockup init myapp
```

## Exit codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 0    | Success                                  |
| 1    | CLI, config, or compose generation error |
| 2    | Docker command failed (incl. preflight)  |
| 3    | Unexpected runtime error                 |

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
  "elapsedSec": 42.1,
  "report": {
    "elapsedSec": 42.1,
    "environment": "prod",
    "namespace": "myorg",
    "registry": "ghcr.io",
    "tag": "prod",
    "built": ["api"],
    "pushed": ["api"],
    "artifacts": ["out/prod/docker-compose.yml", "out/prod/.env"],
    "images": ["ghcr.io/myorg/my-api:prod"],
    "skipped": { "build": false, "push": false, "generateOnly": false, "dryRun": false }
  },
  "nextSteps": ["docker compose -f out/prod/docker-compose.yml --env-file out/prod/.env up -d"]
}
```

With `--with-logs`, a `logs.processes` array is included (phase, command, stdout, stderr, exitCode, durationMs).

Failure:

```json
{
  "ok": false,
  "phase": "CONFIG",
  "message": "Environment \"prod\" resolution failed: Unresolved symbol \"MISSING\".",
  "hint": null,
  "detail": null,
  "cause": null,
  "elapsedSec": 0.1,
  "exitCode": 1
}
```
