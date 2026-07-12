import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ContainerConfig, ResolvedEnvironment } from "../../src/config/types.js";
import { buildContainer } from "../../src/docker/build.js";
import { Logger } from "../../src/logger/index.js";

const dockerAvailable = spawnSync("docker", ["version"], { encoding: "utf8" }).status === 0;

describe("buildContainer with spaced repo paths", () => {
  it(
    "builds when repo root path contains spaces",
    { skip: dockerAvailable ? false : "Docker is not available" },
    async () => {
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
    },
  );
});
