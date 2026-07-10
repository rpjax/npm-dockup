import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const deployDir = dirname(fileURLToPath(import.meta.url));
const deployScript = join(deployDir, "deploy.mjs");

function runDeploy(cwd, args) {
  return spawnSync(process.execPath, [deployScript, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function withTempConfig(config, fn) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-validate-"));
  writeFileSync(join(dir, "test.deploy.json"), JSON.stringify(config));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("deploy config validation", () => {
  it("rejects buildArgs without build context", () => {
    withTempConfig(
      {
        prod: {
          namespace: "example",
          containers: [
            {
              id: "app",
              image: "example-app",
              buildArgs: [{ name: "FOO", value: "bar" }],
            },
          ],
        },
      },
      (dir) => {
        const result = runDeploy(dir, ["env=prod"]);
        const output = `${result.stdout}\n${result.stderr}`;

        assert.notEqual(result.status, 0);
        assert.match(output, /buildArgs but no build context/);
      },
    );
  });

  it("rejects unresolved interpolation at config time", () => {
    withTempConfig(
      {
        prod: {
          namespace: "example",
          env: [{ name: "API_URL", value: "${MISSING}" }],
          containers: [{ id: "app", image: "example-app" }],
        },
      },
      (dir) => {
        const result = runDeploy(dir, ["env=prod"]);
        const output = `${result.stdout}\n${result.stderr}`;

        assert.notEqual(result.status, 0);
        assert.match(output, /resolution failed/i);
      },
    );
  });
});
