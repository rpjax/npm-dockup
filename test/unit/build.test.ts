import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContainerConfig } from "../../src/config/types.js";
import { buildDockerCliArgs } from "../../src/docker/build.js";

const base = {
  tag: "myorg/my-api:prod",
  dockerfile: "/repo/services/api/Dockerfile",
  context: "/repo/services/api",
  buildArgs: [{ name: "NODE_ENV", value: "production" }],
};

describe("buildDockerCliArgs", () => {
  it("includes build args, tag, dockerfile, and context", () => {
    const container: ContainerConfig = {
      id: "api",
      image: "my-api",
      context: "services/api",
    };

    const args = buildDockerCliArgs({ container, ...base });

    assert.deepEqual(args, [
      "build",
      "--build-arg",
      "NODE_ENV=production",
      "-t",
      "myorg/my-api:prod",
      "-f",
      "/repo/services/api/Dockerfile",
      "/repo/services/api",
    ]);
  });

  it("adds platform and buildTarget when set", () => {
    const container: ContainerConfig = {
      id: "api",
      image: "my-api",
      context: "services/api",
      platform: "linux/amd64",
      buildTarget: "production",
    };

    const args = buildDockerCliArgs({ container, ...base, buildArgs: [] });

    assert.deepEqual(args, [
      "build",
      "--platform",
      "linux/amd64",
      "--target",
      "production",
      "-t",
      "myorg/my-api:prod",
      "-f",
      "/repo/services/api/Dockerfile",
      "/repo/services/api",
    ]);
  });
});
