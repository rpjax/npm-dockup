import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeployJsonReport } from "../../src/ux/run-report.js";
import type { DeployResult } from "../../src/cli/deploy-tasks.js";
import type { DeployOptions } from "../../src/cli/options.js";

describe("buildDeployJsonReport", () => {
  it("includes built, pushed, and images", () => {
    const options: DeployOptions = {
      env: "dev",
      root: ".",
      json: false,
      quiet: false,
      verbose: false,
      streamLogs: false,
      withLogs: false,
      skipBuild: false,
      skipPush: false,
      generateOnly: false,
      dryRun: false,
    };

    const result: DeployResult = {
      built: ["api"],
      pushed: ["api"],
      artifacts: ["out/dev/docker-compose.yml", "out/dev/.env"],
      images: ["myorg/my-api:dev"],
      namespace: "myorg",
      tag: "dev",
      registry: "docker.io",
      registryWarning: false,
      processes: [],
      containerCount: 1,
    };

    const report = buildDeployJsonReport(options, result, 12.3);
    assert.equal(report.environment, "dev");
    assert.deepEqual(report.built, ["api"]);
    assert.deepEqual(report.images, ["myorg/my-api:dev"]);
    assert.equal(report.elapsedSec, 12.3);
  });
});
