import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDeployNextSteps,
  resolveValidateNextSteps,
  resolveInitNextSteps,
} from "../../src/ux/next-steps.js";
import type { DeployResult } from "../../src/cli/deploy-tasks.js";
import type { DeployOptions } from "../../src/cli/options.js";

const baseOptions: DeployOptions = {
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

const baseResult: DeployResult = {
  built: ["api"],
  pushed: ["api"],
  artifacts: ["out/dev/docker-compose.yml", "out/dev/.env"],
  images: ["myorg/api:dev"],
  namespace: "myorg",
  tag: "dev",
  registryWarning: false,
  processes: [],
  containerCount: 1,
};

describe("next steps", () => {
  it("suggests dry-run follow up", () => {
    const steps = resolveDeployNextSteps({ ...baseOptions, dryRun: true }, baseResult);
    assert.match(steps[0] ?? "", /dry-run/i);
  });

  it("suggests generate-only review", () => {
    const steps = resolveDeployNextSteps({ ...baseOptions, generateOnly: true }, baseResult);
    assert.match(steps.join(" "), /generate-only|full deploy/i);
  });

  it("suggests validate deploy flow", () => {
    const steps = resolveValidateNextSteps(["prod"]);
    assert.match(steps[0] ?? "", /generate-only/);
  });

  it("suggests init workflow", () => {
    const steps = resolveInitNextSteps("myapp.dockup.json");
    assert.match(steps.join(" "), /validate/);
  });
});
