import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  composeRuntimeEnv,
  resolveBuildArgs,
  resolveEnvironmentEnv,
} from "./resolve-env.mjs";

const deployDir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(join(deployDir, "nexus.deploy.example.json"), "utf8"),
);

function containerEnv(configEnv, container) {
  const envSymbols = resolveEnvironmentEnv(configEnv);
  return composeRuntimeEnv(configEnv, container.env ?? [], envSymbols);
}

describe("nexus.deploy.example.json prod", () => {
  const prod = config.prod;
  const envSymbols = resolveEnvironmentEnv(prod.env);

  it("resolves shared API URL", () => {
    assert.equal(envSymbols.get("API_BASE_URL"), "https://api.nexus.websete.org");
  });

  it("keeps frontend runtime env empty", () => {
    const frontend = prod.containers.find((c) => c.id === "frontend");
    const runtime = composeRuntimeEnv(prod.env, frontend.env ?? [], envSymbols);
    assert.deepEqual(runtime, []);
  });

  it("injects backend ASPNETCORE_ENVIRONMENT only on backend", () => {
    const backend = prod.containers.find((c) => c.id === "backend");
    const runtime = composeRuntimeEnv(prod.env, backend.env ?? [], envSymbols);
    assert.deepEqual(runtime, [{ name: "ASPNETCORE_ENVIRONMENT", value: "Production" }]);
  });

  it("resolves frontend build args", () => {
    const frontend = prod.containers.find((c) => c.id === "frontend");
    const buildArgs = resolveBuildArgs(frontend.buildArgs ?? [], envSymbols);
    assert.deepEqual(buildArgs, [
      { name: "VITE_API_BASE_URL", value: "https://api.nexus.websete.org" },
    ]);
  });

  it("resolves webserver runtime hosts from environment symbols", () => {
    const webserver = prod.containers.find((c) => c.id === "webserver");
    const runtime = containerEnv(prod.env, webserver);
    const byName = Object.fromEntries(runtime.map((entry) => [entry.name, entry.value]));

    assert.equal(byName.FRONTEND_HOST, "nexus.websete.org");
    assert.equal(byName.BACKEND_HOST, "api.nexus.websete.org");
    assert.equal(byName.FRONTEND_UPSTREAM, "http://frontend:80");
  });
});

describe("nexus.deploy.example.json dev", () => {
  const dev = config.dev;
  const envSymbols = resolveEnvironmentEnv(dev.env);

  it("resolves dev API URL", () => {
    assert.equal(envSymbols.get("API_BASE_URL"), "https://api.nexus.websete.localhost");
  });

  it("sets Development on backend only", () => {
    const backend = dev.containers.find((c) => c.id === "backend");
    const runtime = composeRuntimeEnv(dev.env, backend.env ?? [], envSymbols);
    assert.deepEqual(runtime, [{ name: "ASPNETCORE_ENVIRONMENT", value: "Development" }]);
  });
});
