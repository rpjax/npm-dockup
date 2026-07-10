import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interpolateCommand,
  interpolateLabels,
  interpolateValue,
} from "../../src/compose/interpolate.js";

describe("interpolate helpers", () => {
  const symbols = new Map([
    ["HOST", "api.example.com"],
    ["DOMAIN", "app.example.com"],
  ]);

  it("interpolates command strings and arrays", () => {
    assert.equal(interpolateCommand("--host=${HOST}", symbols), "--host=api.example.com");
    assert.deepEqual(interpolateCommand(["--host=${HOST}", "run"], symbols), [
      "--host=api.example.com",
      "run",
    ]);
  });

  it("interpolates label arrays and objects", () => {
    assert.deepEqual(
      interpolateLabels(["traefik.http.routers.app.rule=Host(`${DOMAIN}`)"], symbols),
      { "traefik.http.routers.app.rule": "Host(`app.example.com`)" },
    );
    assert.deepEqual(interpolateLabels({ host: "${HOST}" }, symbols), {
      host: "api.example.com",
    });
  });

  it("interpolates healthcheck test values", () => {
    assert.deepEqual(interpolateValue(["CMD", "curl", "${HOST}"], symbols), [
      "CMD",
      "curl",
      "api.example.com",
    ]);
  });
});
