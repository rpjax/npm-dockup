# Migration from v1.x to v2.0

dockup **2.0.0** is a breaking release. There is no runtime compatibility shim — update your `*.dockup.json` files and regenerate compose artifacts.

## Quick checklist

1. Change `dependsOn: ["api"]` → `dependsOn: [{ "id": "api" }]`
2. For pull-only images (Traefik, Postgres, Redis), use `imageRef` instead of `image` without `context`
3. Add `healthcheck` to any service referenced with `condition: "service_healthy"`
4. Re-run `dockup validate` and `dockup deploy --generate-only`
5. Volume mounts use `name` (named volume) or `host` (bind mount), never both

## `dependsOn` syntax

**v1.x (removed):**

```json
"dependsOn": ["api", "db"]
```

**v2.0:**

```json
"dependsOn": [
  { "id": "api" },
  { "id": "db", "condition": "service_healthy" }
]
```

| `condition`                      | Meaning                                |
| -------------------------------- | -------------------------------------- |
| _(omitted)_                      | `service_started` (Compose default)    |
| `service_started`                | Wait until container starts            |
| `service_healthy`                | Wait until target `healthcheck` passes |
| `service_completed_successfully` | Wait for one-shot container exit 0     |

`service_healthy` requires a `healthcheck` block on the **target** container.

## Image modes

### Built images (unchanged concept)

```json
{
  "id": "api",
  "image": "my-api",
  "context": "services/api"
}
```

Compose output: `${DOCKER_IMAGE_ROOT}/my-api:${DOCKER_TAG}` — dockup builds and pushes.

### Pull-only images (new)

```json
{
  "id": "traefik",
  "imageRef": "traefik:v3.3",
  "ports": [{ "host": 80, "container": 80 }]
}
```

- No `context`, no `buildArgs`
- Literal image in compose (no `${DOCKER_IMAGE_ROOT}`)
- Build and push phases skip this container

You cannot set both `imageRef` and `context`, or both `image` and `imageRef`.

## New optional fields (v2)

These are additive — existing minimal configs keep working after `dependsOn` updates.

| Level       | New fields                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Environment | `networks[]`, `volumes[]`, `compose`                                                                                                                                                       |
| Container   | `command`, `entrypoint`, `labels`, `healthcheck`, `restart`, `envFile`, `capAdd`, `capDrop`, `shmSize`, resource limits, `networks`, `extraHosts`, `platform`, `buildTarget`, `compose`, … |

See [config.md](config.md) for the full field reference.

## Example upgrade

**v1.1 `full-stack` fragment:**

```json
"dependsOn": ["api"]
```

**v2.0:**

```json
"dependsOn": [{ "id": "api" }]
```

## Canonical v2 example

[`examples/compose-complete.dockup.json`](../examples/compose-complete.dockup.json) demonstrates:

- Traefik with `imageRef` and `command`
- App with build context, interpolated `labels`, `dependsOn` + `service_healthy`
- Sidecar with `capAdd`, `shmSize`, `healthcheck`
- Environment `networks` and per-service `compose` escape hatch

## Further reading

- [Configuration reference](config.md)
- [CHANGELOG 2.0.0](../CHANGELOG.md)
- [Migration from v0.x](migration-v1.md) (legacy `*.deploy.json`)
