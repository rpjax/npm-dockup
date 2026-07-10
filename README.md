# Deploy

Generic Docker deploy tool. Run from a directory that contains exactly one `*.deploy.json` config file.

Root keys in the config are environment names; each env defines `namespace`, `network`, optional `tag`, optional `env[]`, and `containers[]`.

## Setup

```bash
cd deploy
cp nexus.deploy.example.json nexus.deploy.json
```

Edit environments and containers. App secrets stay in each project (`appsettings.*`, `.env.*`). TLS terminates only at `webserver`.

## Run

```bash
cd deploy
node deploy.mjs env=prod
node deploy.mjs env=dev only=backend
node deploy.mjs help
```

Phases:

1. **Preflight** — working directory, Docker daemon, Hub credentials
2. **Config** — discover, load, and validate `*.deploy.json`
3. **Build** — `docker build` with per-container `buildArgs`
4. **Push** — `docker push <namespace>/<image>:<tag>`
5. **Generate** — `out/<env>/docker-compose.yml` + `.env`
6. **Validate** — `docker compose config`

On failure, the log shows the phase, command, exit code, and the last lines of output.

## Config discovery

The tool looks for `*.deploy.json` in the current working directory:

| Matches | Result |
|---------|--------|
| 0 | Error — no config found |
| 1 | Uses that file |
| 2+ | Error — ambiguous, lists all matches |

Example files: `nexus.deploy.json` (used), `nexus.deploy.example.json` (template, not matched).

## Config schema

```json
{
  "prod": {
    "namespace": "myorg",
    "network": "myapp",
    "tag": "prod",
    "env": [
      { "name": "BACKEND_HOST", "value": "api.example.com" },
      { "name": "API_BASE_URL", "value": "https://${BACKEND_HOST}" }
    ],
    "containers": [
      {
        "id": "api",
        "image": "my-api",
        "context": "My.Api",
        "env": [{ "name": "AppHost__BaseUrl", "value": "${API_BASE_URL}" }],
        "buildArgs": [{ "name": "SOME_BUILD_ARG", "value": "${API_BASE_URL}" }]
      }
    ]
  }
}
```

| Field | Description |
|-------|-------------|
| `namespace` | Docker Hub namespace for images |
| `network` | Docker network name (default `nexus`) |
| `tag` | Image tag (default: environment key name) |
| `env[]` | Environment symbols for `${VAR}` interpolation |
| `env[].global` | If `true`, inject into every container's compose `environment:` (default `false`) |
| `containers[].env[]` | Runtime env for that container (explicit; may interpolate environment symbols) |
| `containers[].buildArgs[]` | Docker build args for that container |
| `ports[]` | `host:container` on the VPS |
| `expose[]` | internal Docker network only |
| `volumes[]` with `name` | named volume |
| `volumes[]` with `host` | bind mount |
| `dependsOn[]` | `depends_on:` |

### Env resolution

1. `env` at environment level defines symbols resolved first (supports `${VAR}` chains, no cycles).
2. `global: true` on an environment entry injects it into all containers at runtime.
3. `container.env` declares what each container receives; values interpolate against environment symbols only.
4. `buildArgs` resolve after environment symbols; they are not referenceable elsewhere.

## Tests

```bash
node --test deploy/*.test.mjs
```

## VPS

```bash
scp -r out/prod/ user@vps:/opt/myapp
ssh user@vps
cd /opt/myapp
docker compose pull
docker compose up -d
```

## Project env files (local dev)

| Project | Per-env config |
|---------|----------------|
| API | `appsettings.json`, `appsettings.Development.json` |
| Frontend | `.env.development`, `.env.production` |
| Webserver | routing via `container.env` in `*.deploy.json` |
