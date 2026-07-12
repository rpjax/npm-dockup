import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ContainerConfig, ResolvedEnvironment } from "../../src/config/types.js";
import { buildContainer } from "../../src/docker/build.js";
import { Logger } from "../../src/logger/index.js";

function isDockerBuildAvailable(): boolean {
  const version = spawnSync("docker", ["version"], { encoding: "utf8" });
  if (version.status !== 0) {
    return false;
  }

  const info = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    encoding: "utf8",
  });
  return info.status === 0 && info.stdout.trim().length > 0;
}

const dockerBuildAvailable = isDockerBuildAvailable();
const skipBuildSpacesTest =
  process.platform === "win32"
    ? "Docker Linux image builds are validated on Linux CI"
    : dockerBuildAvailable
      ? false
      : "Docker daemon is not available";

describe("buildContainer with spaced repo paths", () => {
  it("builds when repo root path contains spaces", { skip: skipBuildSpacesTest }, async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "dockup test space-"));
    const contextDir = join(repoRoot, "context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, "Dockerfile"), "FROM alpine\n");

    const resolved: ResolvedEnvironment = {
      namespace: "dockup-test",
      network: "dockup-test-net",
      tag: "space-test",
      env: [],
      containers: [],
    };

    const container: ContainerConfig = {
      id: "sidecar",
      image: "space-test-image",
      context: "context",
    };

    try {
      const tag = await buildContainer({
        resolved,
        container,
        repoRoot,
        configDir: repoRoot,
        environmentEnv: [],
        log: new Logger({ quiet: true }),
      });

      assert.equal(tag, "dockup-test/space-test-image:space-test");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
