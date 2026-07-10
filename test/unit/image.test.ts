import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContainerConfig } from "../../src/config/types.js";
import {
  isPullOnly,
  resolveComposeImage,
  shouldBuild,
  shouldPush,
} from "../../src/docker/image.js";

describe("image helpers", () => {
  it("detects pull-only containers", () => {
    const container: ContainerConfig = { id: "traefik", imageRef: "traefik:v3.3" };
    assert.equal(isPullOnly(container), true);
    assert.equal(shouldBuild(container), false);
    assert.equal(shouldPush(container), false);
    assert.equal(resolveComposeImage(container), "traefik:v3.3");
  });

  it("detects built containers", () => {
    const container: ContainerConfig = {
      id: "api",
      image: "my-api",
      context: "services/api",
    };
    assert.equal(isPullOnly(container), false);
    assert.equal(shouldBuild(container), true);
    assert.equal(shouldPush(container), true);
    assert.match(resolveComposeImage(container), /\$\{DOCKER_IMAGE_ROOT\}\/my-api/);
  });

  it("trims whitespace from built image names", () => {
    const container: ContainerConfig = { id: "api", image: " my-api " };
    assert.equal(resolveComposeImage(container), "${DOCKER_IMAGE_ROOT}/my-api:${DOCKER_TAG}");
  });
});
