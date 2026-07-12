import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSubprocessLine,
  openPanel,
  closePanel,
  SUBPROCESS_INDENT,
} from "../../src/output/frame.js";

describe("frame", () => {
  it("prefixes subprocess lines with indent", () => {
    const line = formatSubprocessLine("#14 DONE", { color: false });
    assert.match(line, new RegExp(`^${SUBPROCESS_INDENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(line, /#14 DONE/);
  });

  it("formats panel open and close", () => {
    assert.equal(openPanel("docker build api", { color: false }), "── docker build api ──");
    assert.equal(closePanel("done (4.9s)", { color: false }), "── done (4.9s) ──");
  });
});
