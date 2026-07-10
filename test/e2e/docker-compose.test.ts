import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repoRoot, "dist/cli/index.js");

describe("dockup e2e compose validation", () => {
  it("validates full-stack example with docker compose config", () => {
    const configDir = mkdtempSync(join(tmpdir(), "dockup-e2e-"));

    const generate = spawnSync(
      process.execPath,
      [
        cli,
        "deploy",
        "--env",
        "prod",
        "--generate-only",
        "--config",
        join(repoRoot, "examples/full-stack.dockup.json"),
        "--root",
        repoRoot,
      ],
      {
        cwd: configDir,
        encoding: "utf8",
      },
    );

    assert.equal(
      generate.status,
      0,
      `generate failed:\n${generate.stdout}\n${generate.stderr}`,
    );

    const composePath = join(configDir, "out/prod/docker-compose.yml");
    const envPath = join(configDir, "out/prod/.env");

    const validate = spawnSync(
      "docker",
      ["compose", "-f", composePath, "--env-file", envPath, "config"],
      { encoding: "utf8" },
    );

    assert.equal(
      validate.status,
      0,
      `docker compose config failed:\n${validate.stdout}\n${validate.stderr}`,
    );

    rmSync(configDir, { recursive: true, force: true });
  });
});
