# Migration to v1.0.0

This guide covers breaking changes from the legacy JavaScript CLI.

## CLI syntax

| Before (v0.x)                 | After (v1.0)                             |
| ----------------------------- | ---------------------------------------- |
| `dockup env=prod`             | `dockup deploy --env prod`               |
| `dockup env=dev only=backend` | `dockup deploy --env dev --only backend` |
| `dockup help`                 | `dockup --help`                          |

There are **no aliases** for the old `env=` syntax.

## Config file rename

Rename your config file:

```bash
mv myapp.deploy.json myapp.dockup.json
```

Update `.gitignore`:

```gitignore
*.dockup.json
!*.dockup.example.json
```

## Required `network`

v1 requires an explicit `network` per environment. Add it if missing:

```json
{
  "prod": {
    "namespace": "myorg",
    "network": "myapp",
    "containers": []
  }
}
```

## Repository root

Build contexts now resolve from `--root` (default: current directory), not the parent folder.

If your layout is:

```
repo/
  deploy/app.dockup.json
  services/api/
```

Run from `deploy/` with:

```bash
dockup deploy --env prod --root ..
```

Or set `"context": "services/api"` and run from repo root with `--root .`.

## New commands

```bash
dockup validate          # check config without Docker
dockup init myapp        # scaffold config from template
dockup deploy --generate-only --env prod
```

## Registry support

Optional per environment:

```json
{
  "prod": {
    "namespace": "myorg",
    "network": "myapp",
    "registry": "ghcr.io",
    "containers": []
  }
}
```

Generated images: `ghcr.io/myorg/<image>:<tag>`

## JSON Schema

Install `@rodrigopjax/dockup` and enable VS Code schema (see [config.md](./config.md)) for autocomplete and validation.
