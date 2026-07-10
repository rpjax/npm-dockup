import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EXIT } from "../../src/cli/exit-codes.js";
import { runDockup } from "../helpers/cli.js";

function withTempConfig(config: unknown, fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "dockup-validate-"));
  writeFileSync(join(dir, "test.dockup.json"), JSON.stringify(config));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("dockup validate integration", () => {
  it("rejects buildArgs without build context", () => {
    withTempConfig(
      {
        prod: {
          namespace: "example",
          network: "example-net",
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
        const result = runDockup(["validate"], dir);
        const output = `${result.stdout}\n${result.stderr}`;
        assert.equal(result.status, EXIT.CLI_CONFIG, output);
        assert.match(output, /buildArgs but no build context/);
      },
    );
  });

  it("rejects unresolved interpolation", () => {
    withTempConfig(
      {
        prod: {
          namespace: "example",
          network: "example-net",
          env: [{ name: "API_URL", value: "${MISSING}" }],
          containers: [{ id: "app", image: "example-app" }],
        },
      },
      (dir) => {
        const result = runDockup(["validate"], dir);
        const output = `${result.stdout}\n${result.stderr}`;
        assert.equal(result.status, EXIT.CLI_CONFIG, output);
        assert.match(output, /resolution failed/i);
      },
    );
  });

  it("accepts valid minimal config without docker contexts", () => {
    withTempConfig(
      {
        prod: {
          namespace: "example",
          network: "example-net",
          containers: [{ id: "app", image: "example-app" }],
        },
      },
      (dir) => {
        const result = runDockup(["validate", "--json"], dir);
        assert.equal(result.status, EXIT.OK);
        const payload = JSON.parse(result.stdout) as { ok: boolean };
        assert.equal(payload.ok, true);
      },
    );
  });
});
