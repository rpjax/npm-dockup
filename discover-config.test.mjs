import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ConfigDiscoveryError,
  discoverConfigFile,
  listConfigFiles,
} from "./discover-config.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-config-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("discoverConfigFile", () => {
  it("finds a single *.deploy.json file", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "app.deploy.json"), "{}");
      writeFileSync(join(dir, "app.deploy.example.json"), "{}");

      assert.deepEqual(listConfigFiles(dir), [join(dir, "app.deploy.json")]);
      assert.equal(discoverConfigFile(dir), join(dir, "app.deploy.json"));
    });
  });

  it("throws when no config exists", () => {
    withTempDir((dir) => {
      assert.throws(() => discoverConfigFile(dir), ConfigDiscoveryError);
    });
  });

  it("throws when multiple configs exist", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "a.deploy.json"), "{}");
      writeFileSync(join(dir, "b.deploy.json"), "{}");

      assert.throws(() => discoverConfigFile(dir), (err) => {
        assert.ok(err instanceof ConfigDiscoveryError);
        assert.match(err.detail, /a\.deploy\.json/);
        assert.match(err.detail, /b\.deploy\.json/);
        return true;
      });
    });
  });
});
