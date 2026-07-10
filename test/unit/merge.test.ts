import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepMerge } from "../../src/compose/merge.js";

describe("deepMerge", () => {
  it("merges nested objects", () => {
    const target = { a: { b: 1, c: 2 }, d: 3 };
    const result = deepMerge(target, { a: { c: 9 }, e: 4 });
    assert.deepEqual(result, { a: { b: 1, c: 9 }, d: 3, e: 4 });
  });

  it("replaces arrays instead of concatenating", () => {
    const target = { ports: ["80:80"] };
    const result = deepMerge(target, { ports: ["443:443"] });
    assert.deepEqual(result.ports, ["443:443"]);
  });

  it("overwrites scalar values", () => {
    const target = { restart: "unless-stopped" };
    const result = deepMerge(target, { restart: "no" });
    assert.equal(result.restart, "no");
  });
});
