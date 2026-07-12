import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveVisibility } from "../../src/output/visibility.js";

describe("resolveVisibility", () => {
  it("returns silent for quiet", () => {
    assert.equal(resolveVisibility({ quiet: true }), "silent");
  });

  it("returns silent for json", () => {
    assert.equal(resolveVisibility({ json: true }), "silent");
  });

  it("returns stream when streamLogs is set", () => {
    assert.equal(resolveVisibility({ streamLogs: true }), "stream");
  });

  it("returns peek by default", () => {
    assert.equal(resolveVisibility({}), "peek");
  });

  it("prefers silent over stream when json", () => {
    assert.equal(resolveVisibility({ json: true, streamLogs: true }), "silent");
  });
});

describe("useListr", () => {
  it("disables listr when streamLogs is set", async () => {
    const { useListr } = await import("../../src/cli/options.js");
    assert.equal(useListr({ json: false, quiet: false, streamLogs: true }), false);
    assert.equal(useListr({ json: false, quiet: false, streamLogs: false }), true);
  });
});
