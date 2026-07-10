import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXIT } from "../../src/cli/exit-codes.js";
import { exitCodeForPhase, mergeCommanderGlobal } from "../../src/cli/program.js";

describe("mergeCommanderGlobal", () => {
  it("prefers subcommand config and root", () => {
    const merged = mergeCommanderGlobal(
      { config: "root.json", root: "/root", json: true },
      { config: "local.json", root: "/local" },
    );
    assert.equal(merged.config, "local.json");
    assert.equal(merged.root, "/local");
    assert.equal(merged.json, true);
  });

  it("ORs boolean flags from root and subcommand", () => {
    const merged = mergeCommanderGlobal({ quiet: true }, { json: true });
    assert.equal(merged.quiet, true);
    assert.equal(merged.json, true);
  });
});

describe("exitCodeForPhase", () => {
  it("maps config-like phases to exit 1", () => {
    assert.equal(exitCodeForPhase("CLI"), EXIT.CLI_CONFIG);
    assert.equal(exitCodeForPhase("CONFIG"), EXIT.CLI_CONFIG);
    assert.equal(exitCodeForPhase("GENERATE"), EXIT.CLI_CONFIG);
  });

  it("maps docker phases to exit 2", () => {
    assert.equal(exitCodeForPhase("PREFLIGHT"), EXIT.DOCKER);
    assert.equal(exitCodeForPhase("BUILD"), EXIT.DOCKER);
    assert.equal(exitCodeForPhase("VALIDATE"), EXIT.DOCKER);
  });
});
