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

| Field        | Required | Description                                            |
| ------------ | -------- | ------------------------------------------------------ |
| `namespace`  | yes      | Docker image namespace for built images                |
| `network`    | yes      | Default Docker Compose network name                    |
| `tag`        | no       | Image tag (default: environment key)                   |
| `registry`   | no       | Registry host (e.g. `ghcr.io`)                         |
| `env`        | no       | Symbol table for `${VAR}` interpolation                |
| `networks`   | no       | Extra network definitions (see below)                  |
| `volumes`    | no       | Named volume definitions (see below)                   |
| `compose`    | no       | Root escape hatch — deep-merged into generated compose |
| `containers` | yes      | Non-empty array of service definitions                 |

### `networks[]` (environment)

```json
"networks": [
  { "name": "backend", "driver": "bridge", "internal": true },
  { "name": "existing_net", "external": true }
]
```

Services attach via `network` (default) or per-container `networks`.

### `volumes[]` (environment)

```json
"volumes": [
  { "name": "pgdata", "driver": "local" },
  { "name": "shared_data", "external": true }
]
```

Named mounts reference these via `volumes[].name`.

### `compose` (environment)

Arbitrary Compose document fields merged after generation (e.g. top-level `x-` extensions):

```json
"compose": {
  "name": "my-stack"
}
```

## Container fields

Each container requires **`image`** (built) **or** `imageRef` (pull-only).

### Image and build

| Field         | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `id`          | Service name (unique within environment)                                   |
| `image`       | Short image name → `${DOCKER_IMAGE_ROOT}/<image>:${DOCKER_TAG}` in compose |
| `imageRef`    | Literal image reference; skips build/push; cannot combine with `context`   |
| `context`     | Build context path relative to `--root`                                    |
| `dockerfile`  | Dockerfile name (default `Dockerfile`)                                     |
| `platform`    | `docker build --platform` (e.g. `linux/amd64`)                             |
| `buildTarget` | `docker build --target`                                                    |
| `buildArgs`   | Build-time variables; requires `context`                                   |

### Runtime

| Field         | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `command`     | Override container command (string or array); interpolates `${VAR}`          |
| `entrypoint`  | Override entrypoint (string or array); interpolates `${VAR}`                 |
| `labels`      | `["key=value"]` or `{ "key": "value" }`; values interpolate                  |
| `healthcheck` | `{ test, interval?, timeout?, retries?, startPeriod? }`; `test` interpolates |
| `restart`     | Restart policy (default generated: `unless-stopped`)                         |
| `profiles`    | Compose profiles                                                             |
| `init`        | Run init process                                                             |
| `user`        | User name or UID                                                             |
| `workingDir`  | Working directory inside container                                           |
| `privileged`  | Privileged mode                                                              |

### Capabilities and resources

| Field          | Compose mapping |
| -------------- | --------------- |
| `capAdd`       | `cap_add`       |
| `capDrop`      | `cap_drop`      |
| `shmSize`      | `shm_size`      |
| `memLimit`     | `mem_limit`     |
| `memswapLimit` | `memswap_limit` |
| `cpus`         | `cpus`          |
| `cpuShares`    | `cpu_shares`    |
| `pidsLimit`    | `pids_limit`    |

### Networking

| Field        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `ports`      | `[{ "host": 8080, "container": 80 }]`                              |
| `expose`     | Internal ports                                                     |
| `networks`   | `["default_net"]` or `[{ "name": "backend", "aliases": ["api"] }]` |
| `hostname`   | Container hostname                                                 |
| `domainname` | Container domain name                                              |
| `extraHosts` | `[{ "host": "api.local", "ip": "10.0.0.1" }]`; `host` interpolates |

### Storage and environment

| Field       | Description                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| `volumes`   | Named (`name`+`container`) or bind (`host`+`container`); optional `readOnly` |
| `env`       | Runtime variables; values interpolate against environment symbols            |
| `envFile`   | Paths to env files (relative to config directory; validated on disk)         |
| `dependsOn` | `[{ "id": "db", "condition": "service_healthy" }]`                           |

### Escape hatch

| Field     | Description                                                |
| --------- | ---------------------------------------------------------- |
| `compose` | Arbitrary service fields deep-merged over generated output |

## `dependsOn` conditions

```json
"dependsOn": [
  { "id": "sidecar" },
  { "id": "db", "condition": "service_healthy" }
]
```

| Condition                        | Requirement                        |
| -------------------------------- | ---------------------------------- |
| `service_started`                | Default when omitted               |
| `service_healthy`                | Target must define `healthcheck`   |
| `service_completed_successfully` | For one-shot dependency containers |

## `healthcheck` example

```json
"healthcheck": {
  "test": ["CMD", "curl", "-f", "http://localhost:${PORT}/health"],
  "interval": "10s",
  "timeout": "3s",
  "retries": 3,
  "startPeriod": "30s"
}
```

## `labels` example

```json
"labels": {
  "traefik.enable": "true",
  "traefik.http.routers.app.rule": "Host(`${APP_HOST}`)"
}
```

## `imageRef` example (Traefik)

```json
{
  "id": "traefik",
  "imageRef": "traefik:v3.3",
  "command": ["--api.insecure=true", "--providers.docker=true"],
  "ports": [{ "host": 80, "container": 80 }]
}
```

## Env interpolation

1. Environment-level `env[]` defines symbols resolved first (supports `${VAR}` chains).
2. `global: true` injects a symbol into every container at runtime.
3. Container `env[]` values interpolate against environment symbols only.
4. `buildArgs` resolve after environment symbols.
5. Compose-oriented fields (`command`, `entrypoint`, `labels`, `healthcheck.test`, `extraHosts.host`, `imageRef`) interpolate at render time.
6. Built `image` templates (`${DOCKER_IMAGE_ROOT}/...`) are **not** interpolated at render — compose resolves them via `.env`.

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

Built services reference `${DOCKER_IMAGE_ROOT}/<image>:${DOCKER_TAG}`. Pull-only `imageRef` services use literal image strings.

## Examples

| File                                                                                | Purpose                    |
| ----------------------------------------------------------------------------------- | -------------------------- |
| [`examples/minimal.dockup.json`](../examples/minimal.dockup.json)                   | `dockup init` template     |
| [`examples/full-stack.dockup.json`](../examples/full-stack.dockup.json)             | Multi-service build + deps |
| [`examples/compose-complete.dockup.json`](../examples/compose-complete.dockup.json) | Tier 1+2 showcase          |

## Validation highlights

- `image` or `imageRef` required per container, not both
- `imageRef` + `context` or `buildArgs` → error
- `platform` / `buildTarget` require `context`
- `dependsOn[].id` must reference an existing container (no self-reference or duplicates)
- `service_healthy` requires target `healthcheck`
- Service `networks[]` must reference default `network` or `environment.networks[].name`
- Volume mounts use `name` or `host`, not both; declare `environment.volumes` for `external`/`driver` options
- Unique names in `environment.networks[]` and `environment.volumes[]`
- `envFile` paths must exist relative to config directory
- Bind-mount `host` paths are not validated on disk (only `envFile` and `context` are checked)

## Migration

Upgrading from v1.x? See [migration-v2.md](migration-v2.md).
