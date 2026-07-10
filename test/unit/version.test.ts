import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getVersion } from "../../src/version.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("getVersion", () => {
  it("matches package.json version", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      version: string;
    };
    assert.equal(getVersion(), pkg.version);
  });
});
