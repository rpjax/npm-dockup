import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ResolveError,
  composeRuntimeEnv,
  extractReferences,
  interpolate,
  resolveBuildArgs,
  resolveContainerEnv,
  resolveEnvironmentEnv,
} from "./resolve-env.mjs";

describe("resolveEnvironmentEnv", () => {
  it("resolves literals and chains", () => {
    const symbols = resolveEnvironmentEnv([
      { name: "BACKEND_HOST", value: "api.example.com" },
      { name: "API_BASE_URL", value: "https://${BACKEND_HOST}" },
    ]);

    assert.equal(symbols.get("BACKEND_HOST"), "api.example.com");
    assert.equal(symbols.get("API_BASE_URL"), "https://api.example.com");
  });

  it("throws on missing symbol", () => {
    assert.throws(
      () =>
        resolveEnvironmentEnv([{ name: "API_BASE_URL", value: "https://${MISSING}" }]),
      (err) => err instanceof ResolveError && err.type === "missing",
    );
  });

  it("keeps interpolating after extractReferences uses the same pattern", () => {
    const value = "https://${BACKEND_HOST}/v1";
    extractReferences(value);
    const symbols = resolveEnvironmentEnv([{ name: "BACKEND_HOST", value: "api.example.com" }]);
    assert.equal(interpolate(value, symbols), "https://api.example.com/v1");
  });

  it("throws on circular dependency", () => {
    assert.throws(
      () =>
        resolveEnvironmentEnv([
          { name: "A", value: "${B}" },
          { name: "B", value: "${A}" },
        ]),
      (err) => err instanceof ResolveError && err.type === "cycle",
    );
  });
});

describe("resolveContainerEnv", () => {
  it("interpolates against environment symbols", () => {
    const envSymbols = resolveEnvironmentEnv([
      { name: "FRONTEND_HOST", value: "app.example.com" },
    ]);

    const containerEnv = resolveContainerEnv(
      [{ name: "FRONTEND_HOST", value: "${FRONTEND_HOST}" }],
      envSymbols,
    );

    assert.deepEqual(containerEnv, [{ name: "FRONTEND_HOST", value: "app.example.com" }]);
  });
});

describe("composeRuntimeEnv", () => {
  const environmentEnv = [
    { name: "SHARED", value: "shared-value", global: true },
    { name: "PRIVATE", value: "private-value", global: false },
    { name: "BACKEND_HOST", value: "api.example.com" },
  ];
  const envSymbols = resolveEnvironmentEnv(environmentEnv);

  it("injects global env into all containers", () => {
    const runtime = composeRuntimeEnv(environmentEnv, [], envSymbols);
    assert.deepEqual(runtime, [{ name: "SHARED", value: "shared-value" }]);
  });

  it("does not inject non-global environment symbols", () => {
    const runtime = composeRuntimeEnv(
      environmentEnv,
      [{ name: "FRONTEND_HOST", value: "${BACKEND_HOST}" }],
      envSymbols,
    );

    assert.deepEqual(runtime, [
      { name: "SHARED", value: "shared-value" },
      { name: "FRONTEND_HOST", value: "api.example.com" },
    ]);
  });

  it("lets container env override global", () => {
    const runtime = composeRuntimeEnv(
      environmentEnv,
      [{ name: "SHARED", value: "override" }],
      envSymbols,
    );

    assert.deepEqual(runtime, [{ name: "SHARED", value: "override" }]);
  });
});

describe("resolveBuildArgs", () => {
  it("resolves against environment symbols only", () => {
    const envSymbols = resolveEnvironmentEnv([
      { name: "API_BASE_URL", value: "https://api.example.com" },
    ]);

    const buildArgs = resolveBuildArgs(
      [{ name: "VITE_API_BASE_URL", value: "${API_BASE_URL}" }],
      envSymbols,
    );

    assert.deepEqual(buildArgs, [
      { name: "VITE_API_BASE_URL", value: "https://api.example.com" },
    ]);
  });

  it("throws when buildArg references unknown symbol", () => {
    const envSymbols = resolveEnvironmentEnv([]);

    assert.throws(
      () => resolveBuildArgs([{ name: "FOO", value: "${UNKNOWN}" }], envSymbols),
      (err) => err instanceof ResolveError && err.type === "missing",
    );
  });
});
