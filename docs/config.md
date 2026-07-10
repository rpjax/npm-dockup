# Configuration

dockup reads exactly one `*.dockup.json` file from the working directory, unless `--config` is passed.

## Discovery rules

| Matches | Result            |
| ------- | ----------------- |
| 0       | Error             |
| 1       | Uses that file    |
| 2+      | Error — ambiguous |

Files like `app.dockup.example.json` are ignored (suffix must end with `.dockup.json`).

## Schema

Formal JSON Schema: [`schema/dockup.schema.json`](../schema/dockup.schema.json)

### VS Code autocomplete

Add to your project's `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["*.dockup.json"],
      "url": "./node_modules/@rodrigopjax/dockup/schema/dockup.schema.json"
    }
  ]
}
```

## Minimal example

See [`examples/minimal.dockup.json`](../examples/minimal.dockup.json).

```json
{
  "prod": {
    "namespace": "myorg",
    "network": "myapp",
    "containers": [
      {
        "id": "api",
        "image": "my-api",
        "context": "services/api"
      }
    ]
  }
}
```

## Environment fields

| Field        | Required | Description                             |
| ------------ | -------- | --------------------------------------- |
| `namespace`  | yes      | Docker image namespace                  |
| `network`    | yes      | Docker Compose network name             |
| `tag`        | no       | Image tag (default: environment key)    |
| `registry`   | no       | Registry host (e.g. `ghcr.io`)          |
| `env`        | no       | Symbol table for `${VAR}` interpolation |
| `containers` | yes      | Services to deploy                      |

## Container fields

| Field        | Description                             |
| ------------ | --------------------------------------- |
| `id`         | Service name                            |
| `image`      | Image name (without registry/namespace) |
| `context`    | Build context path relative to `--root` |
| `dockerfile` | Dockerfile name (default `Dockerfile`)  |
| `env`        | Runtime environment variables           |
| `buildArgs`  | Docker build arguments                  |
| `ports`      | Published ports `{ host, container }`   |
| `expose`     | Internal ports                          |
| `volumes`    | Named or bind mounts                    |
| `dependsOn`  | Service dependencies                    |

## Env interpolation

1. Environment-level `env[]` defines symbols resolved first (supports `${VAR}` chains).
2. `global: true` injects a symbol into every container at runtime.
3. Container `env[]` values interpolate against environment symbols only.
4. `buildArgs` resolve after environment symbols.

## Generated artifacts

```
out/<env>/
  docker-compose.yml
  .env
```

The `.env` file contains:

```
DOCKER_IMAGE_ROOT=<registry/namespace or namespace>
DOCKER_TAG=<tag>
```

Compose services reference `${DOCKER_IMAGE_ROOT}/<image>:${DOCKER_TAG}`.

## Full-stack example

See [`examples/full-stack.dockup.json`](../examples/full-stack.dockup.json) and [`examples/full-stack/](../examples/full-stack/).
