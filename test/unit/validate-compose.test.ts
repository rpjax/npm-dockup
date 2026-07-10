import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { validateConfig } from "../../src/config/validate.js";
import type { DockupConfig } from "../../src/config/types.js";

function withTempConfig(config: DockupConfig, fn: (dir: string, path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "dockup-validate-compose-"));
  const path = join(dir, "test.dockup.json");
  writeFileSync(path, JSON.stringify(config));
  try {
    fn(dir, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertValidateFails(config: DockupConfig, ...patterns: RegExp[]): void {
  withTempConfig(config, (dir, path) => {
    const loaded = JSON.parse(readFileSync(path, "utf8")) as DockupConfig;
    assert.throws(
      () => validateConfig(loaded, path, dir, undefined, "prod"),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return patterns.some((pattern) => pattern.test(message));
      },
    );
  });
}

describe("validate compose semantics", () => {
  it("rejects imageRef with build context", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", imageRef: "traefik:v3.3", context: "services/app" }],
        },
      },
      /imageRef with build context/,
    );
  });

  it("rejects both image and imageRef", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", imageRef: "redis:7" }],
        },
      },
      /both "image" and "imageRef"/,
      /JSON Schema validation/,
    );
  });

  it("rejects service_healthy without target healthcheck", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            { id: "sidecar", image: "sidecar" },
            {
              id: "app",
              image: "app",
              dependsOn: [{ id: "sidecar", condition: "service_healthy" }],
            },
          ],
        },
      },
      /no healthcheck/,
    );
  });

  it("rejects unknown dependsOn target", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", dependsOn: [{ id: "missing" }] }],
        },
      },
      /unknown service/,
    );
  });

  it("rejects self dependsOn", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", dependsOn: [{ id: "app" }] }],
        },
      },
      /cannot depend on itself/,
    );
  });

  it("rejects duplicate dependsOn entries", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            { id: "api", image: "api" },
            { id: "web", image: "web" },
            {
              id: "gateway",
              image: "gateway",
              dependsOn: [{ id: "api" }, { id: "api" }],
            },
          ],
        },
      },
      /duplicate dependsOn/,
    );
  });

  it("rejects unknown network on service", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", networks: ["missing"] }],
        },
      },
      /unknown network/,
    );
  });

  it("rejects duplicate environment network names", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          networks: [{ name: "backend" }, { name: "backend" }],
          containers: [{ id: "app", image: "app" }],
        },
      },
      /Duplicate network name/,
    );
  });

  it("rejects imageRef with buildArgs", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            {
              id: "app",
              imageRef: "redis:7",
              buildArgs: [{ name: "FOO", value: "bar" }],
            },
          ],
        },
      },
      /imageRef with buildArgs/,
    );
  });

  it("rejects volume mount with both name and host", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            {
              id: "app",
              image: "app",
              volumes: [{ name: "data", host: "/host/data", container: "/data" }],
            },
          ],
        },
      },
      /both "name" and "host"/,
      /JSON Schema validation/,
    );
  });

  it("rejects duplicate container id", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            { id: "api", image: "api" },
            { id: "api", image: "api-copy" },
          ],
        },
      },
      /Duplicate container id/,
    );
  });

  it("rejects duplicate environment volume names", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          volumes: [{ name: "data" }, { name: "data" }],
          containers: [{ id: "app", image: "app" }],
        },
      },
      /Duplicate volume name/,
    );
  });

  it("rejects platform without build context", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", platform: "linux/amd64" }],
        },
      },
      /platform\/buildTarget but no build context/,
    );
  });

  it("rejects buildTarget without build context", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", buildTarget: "production" }],
        },
      },
      /platform\/buildTarget but no build context/,
    );
  });

  it("rejects missing envFile path", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", envFile: ["missing.env"] }],
        },
      },
      /envFile not found/,
    );
  });

  it("rejects empty healthcheck test", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [
            {
              id: "app",
              image: "app",
              healthcheck: { test: [] },
            },
          ],
        },
      },
      /healthcheck\.test must be non-empty/,
      /JSON Schema validation/,
    );
  });

  it("rejects invalid label format", () => {
    assertValidateFails(
      {
        prod: {
          namespace: "x",
          network: "net",
          containers: [{ id: "app", image: "app", labels: ["invalid-label"] }],
        },
      },
      /Invalid label/,
    );
  });
});
