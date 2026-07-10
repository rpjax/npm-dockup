import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildComposeDocument,
  buildEnvFileContent,
  serializeCompose,
} from "../../src/compose/render.js";
import { getEnvironment } from "../../src/config/validate.js";
import type { DockupConfig } from "../../src/config/types.js";
import { resolveEnvironmentEnv } from "../../src/env/resolve.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(
  readFileSync(join(repoRoot, "examples/full-stack.dockup.json"), "utf8"),
) as DockupConfig;

describe("full-stack example prod compose", () => {
  const resolved = getEnvironment(config, "prod");
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);
  const yaml = serializeCompose(doc);

  it("renders all services", () => {
    const services = doc.services as Record<string, unknown>;
    assert.ok(services.gateway);
    assert.ok(services.api);
    assert.ok(services.web);
  });

  it("uses DOCKER_IMAGE_ROOT in image references", () => {
    assert.match(yaml, /\$\{DOCKER_IMAGE_ROOT\}\/my-gateway:\$\{DOCKER_TAG\}/);
  });

  it("includes ghcr.io registry in env file root", () => {
    const envFile = buildEnvFileContent(resolved, "prod");
    assert.match(envFile, /DOCKER_IMAGE_ROOT=ghcr\.io\/myorg/);
    assert.match(envFile, /DOCKER_TAG=prod/);
  });

  it("matches expected snapshot", () => {
    const expected = readFileSync(
      join(repoRoot, "test/fixtures/expected/full-stack-prod.compose.yml"),
      "utf8",
    );
    assert.equal(yaml, expected);
  });
});

describe("full-stack example dev resolution", () => {
  const resolved = getEnvironment(config, "dev");

  it("resolves API URL", () => {
    const symbols = resolveEnvironmentEnv(resolved.env);
    assert.equal(symbols.get("API_BASE_URL"), "http://api.localhost");
  });
});
