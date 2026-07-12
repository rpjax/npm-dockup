import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitLines, summarizePushLine, normalizeDisplayLine } from "../../src/output/normalize.js";

describe("normalize", () => {
  it("strips ansi from split lines", () => {
    const lines = splitLines("\u001b[32mhello\u001b[0m\nworld");
    assert.deepEqual(lines, ["hello", "world"]);
  });

  it("summarizes push waiting lines", () => {
    const summary = summarizePushLine([
      "abc123: Waiting",
      "def456: Waiting",
      "abc123: Pushed",
      "dev: digest: sha256:abc123deadbeef",
    ]);
    assert.match(summary ?? "", /Pushing layers/);
    assert.match(summary ?? "", /sha256:abc123deadbeef/);
  });

  it("drops push waiting lines in display normalization", () => {
    assert.equal(normalizeDisplayLine("abc123: Waiting", { isPush: true }), "");
  });
});
