import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { discoverConfigFile, listConfigFiles, CONFIG_SUFFIX } from "../../src/config/discovery.js";
import { ConfigDiscoveryError } from "../../src/errors/index.js";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "dockup-config-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("discoverConfigFile", () => {
  it("finds a single *.dockup.json file", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "app.dockup.json"), "{}");
      writeFileSync(join(dir, "app.dockup.example.json"), "{}");

      assert.deepEqual(listConfigFiles(dir), [join(dir, "app.dockup.json")]);
      assert.equal(discoverConfigFile(dir), join(dir, "app.dockup.json"));
    });
  });

  it("throws when no config exists", () => {
    withTempDir((dir) => {
      assert.throws(() => discoverConfigFile(dir), ConfigDiscoveryError);
    });
  });

  it("throws when multiple configs exist", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "a.dockup.json"), "{}");
      writeFileSync(join(dir, "b.dockup.json"), "{}");

      assert.throws(
        () => discoverConfigFile(dir),
        (err: unknown) => {
          assert.ok(err instanceof ConfigDiscoveryError);
          assert.match((err as ConfigDiscoveryError).detail ?? "", /a\.dockup\.json/);
          assert.match((err as ConfigDiscoveryError).detail ?? "", /b\.dockup\.json/);
          return true;
        },
      );
    });
  });

  it("uses CONFIG_SUFFIX .dockup.json", () => {
    assert.equal(CONFIG_SUFFIX, ".dockup.json");
  });
});
