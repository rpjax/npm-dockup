import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, it } from "node:test";

const contextPath = "C:\\tmp\\dockup test space\\context";
const dockerfilePath = "C:\\tmp\\dockup test space\\context\\Dockerfile";

describe("runCommand", () => {
  it("spawns with shell false and preserves spaced paths", async (t) => {
    const spawnCalls: Array<[string, string[], { shell?: boolean }]> = [];

    const mockChild = new EventEmitter() as ChildProcess;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    const mockSpawn = t.mock.fn((command: string, args: string[], options: { shell?: boolean }) => {
      spawnCalls.push([command, args, options]);
      process.nextTick(() => {
        mockChild.emit("close", 0, null);
      });
      return mockChild;
    });

    const mockTracker = t.mock.module("node:child_process", {
      namedExports: {
        spawn: mockSpawn,
      },
    });

    const { runCommand } = await import("../../src/docker/run-command.js");
    const { Logger } = await import("../../src/logger/index.js");

    await runCommand("docker", ["build", "-t", "test:tag", "-f", dockerfilePath, contextPath], {
      phase: "BUILD",
      cwd: process.cwd(),
      log: new Logger({ quiet: true }),
    });

    assert.equal(spawnCalls.length, 1);
    const [command, args, options] = spawnCalls[0]!;
    assert.equal(command, "docker");
    assert.equal(options.shell, false);
    assert.deepEqual(args, ["build", "-t", "test:tag", "-f", dockerfilePath, contextPath]);

    mockTracker.restore();
  });
});
