import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repoRoot, "dist/cli/index.js");
const configPath = join(repoRoot, "examples/compose-complete.dockup.json");

function runComposeCompleteE2E(env: string): void {
  const configDir = mkdtempSync(join(tmpdir(), `dockup-e2e-complete-${env}-`));

  try {
    const generate = spawnSync(
      process.execPath,
      [cli, "deploy", "--env", env, "--generate-only", "--config", configPath, "--root", repoRoot],
      { cwd: configDir, encoding: "utf8" },
    );

    assert.equal(generate.status, 0, `generate failed:\n${generate.stdout}\n${generate.stderr}`);

    const composePath = join(configDir, `out/${env}/docker-compose.yml`);
    const envPath = join(configDir, `out/${env}/.env`);

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

    assert.match(validate.stdout, /traefik:v3\.3/);
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
}

describe("dockup e2e compose-complete", () => {
  it("generates and validates compose-complete dev", () => {
    runComposeCompleteE2E("dev");
  });

  it("generates and validates compose-complete prod", () => {
    runComposeCompleteE2E("prod");
  });
});
