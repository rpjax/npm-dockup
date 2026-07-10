# CI integration

## Validate on every PR

Fast config check without Docker:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
- run: npx @rodrigopjax/dockup validate --config app.dockup.json --root . --json
```

## Deploy from CI

Typical pipeline:

1. `dockup validate` — fail fast on bad config
2. `dockup deploy --env prod --json` — build, push, generate artifacts
3. Upload `out/prod/` as artifact or copy to VPS
4. On VPS: `docker compose pull && docker compose up -d`

### Example GitHub Actions job

```yaml
deploy:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: npm ci
    - run: npx @rodrigopjax/dockup validate --config deploy/app.dockup.json
    - run: npx @rodrigopjax/dockup deploy --env prod --config deploy/app.dockup.json --json
      env:
        DOCKER_AUTH: ${{ secrets.DOCKER_AUTH }}
    - uses: actions/upload-artifact@v4
      with:
        name: compose-prod
        path: deploy/out/prod/
```

Ensure the runner is logged into your registry before deploy:

```yaml
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

## JSON output in pipelines

Use `--json` and parse the `ok` field:

```bash
dockup validate --json | jq -e '.ok'
```

## Granular phases

| Flag              | Use case                         |
| ----------------- | -------------------------------- |
| `--generate-only` | Compose files without build/push |
| `--skip-push`     | Build locally, push separately   |
| `--dry-run`       | Preview docker commands          |
