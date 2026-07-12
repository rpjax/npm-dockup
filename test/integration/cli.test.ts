import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packageVersion, runDockup } from "../helpers/cli.js";

describe("dockup CLI", () => {
  it("accepts global flags before subcommand", () => {
    const result = runDockup(["--json", "validate", "--config", "examples/minimal.dockup.json"]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean; command: string };
    assert.equal(payload.ok, true);
    assert.equal(payload.command, "validate");
  });

  it("validates a single environment with --env", () => {
    const result = runDockup([
      "validate",
      "--config",
      "examples/full-stack.dockup.json",
      "--root",
      ".",
      "--env",
      "prod",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { environments: string[] };
    assert.deepEqual(payload.environments, ["prod"]);
  });

  it("prints deploy subcommand help with --env", () => {
    const result = runDockup(["deploy", "--help"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /--env/);
  });

  it("prints root help", () => {
    const result = runDockup(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /deploy \[options\]/);
    assert.match(result.stdout, /validate \[options\]/);
  });

  it("prints version from package.json", () => {
    const result = runDockup(["--version"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(packageVersion.replace(/\./g, "\\.")));
  });

  it("emits JSON errors when --json is on the subcommand", () => {
    const result = runDockup(["validate", "--json", "--config", "does-not-exist.dockup.json"]);
    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(result.stdout) as { ok: boolean; phase: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.phase, "CONFIG");
  });

  it("quiet deploy suppresses summary output", () => {
    const result = runDockup([
      "deploy",
      "--env",
      "prod",
      "--generate-only",
      "--config",
      "examples/minimal.dockup.json",
      "--quiet",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Run report|Completed in/);
  });

  it("deploy generate-only prints run report with environment", () => {
    const result = runDockup([
      "deploy",
      "--env",
      "prod",
      "--generate-only",
      "--config",
      "examples/minimal.dockup.json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Run report/);
    assert.match(result.stdout, /Environment\s+prod/);
    assert.match(result.stdout, /Next steps/);
  });

  it("deploy json stdout is a single parseable object with report", () => {
    const result = runDockup([
      "deploy",
      "--env",
      "prod",
      "--generate-only",
      "--config",
      "examples/minimal.dockup.json",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean;
      report: { environment: string };
      nextSteps: string[];
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.report.environment, "prod");
    assert.ok(Array.isArray(payload.nextSteps));
  });
});
