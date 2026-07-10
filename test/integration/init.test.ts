import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runDockup } from "../helpers/cli.js";

describe("dockup init integration", () => {
  it("creates a config file from the minimal template", () => {
    const dir = mkdtempSync(join(tmpdir(), "dockup-init-"));
    try {
      const result = runDockup(["init", "myapp"], dir);
      assert.equal(result.status, 0, result.stderr);
      const target = join(dir, "myapp.dockup.json");
      assert.equal(existsSync(target), true);
      const config = JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>;
      assert.ok(config.prod);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits JSON on success", () => {
    const dir = mkdtempSync(join(tmpdir(), "dockup-init-json-"));
    try {
      const result = runDockup(["init", "svc", "--json"], dir);
      assert.equal(result.status, 0, result.stderr);
      const payload = JSON.parse(result.stdout) as { ok: boolean; command: string; path: string };
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "init");
      assert.match(payload.path, /svc\.dockup\.json$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate config with exit code 1", () => {
    const dir = mkdtempSync(join(tmpdir(), "dockup-init-dup-"));
    try {
      const first = runDockup(["init", "app"], dir);
      assert.equal(first.status, 0, first.stderr);

      const second = runDockup(["init", "app"], dir);
      assert.equal(second.status, 1, second.stderr);
      assert.match(`${second.stdout}\n${second.stderr}`, /already exists/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
