import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OutputCoordinator } from "../../src/output/coordinator.js";

describe("OutputSink line buffering", () => {
  it("reassembles lines split across chunks", () => {
    const coordinator = new OutputCoordinator("peek", false);
    let lastPeek = "";
    coordinator.onPeek((sink) => {
      lastPeek = sink.peekText;
    });

    const sink = coordinator.createSink({
      phase: "BUILD",
      label: "docker build api",
      command: "docker build api",
    });

    sink.feed("stdout", "#14 [build 6/6] RUN dotnet pub");
    sink.feed("stdout", "lish\n#14 DONE 4.9s\n");
    sink.complete(0);

    assert.match(lastPeek, /dotnet publish/);
    assert.match(lastPeek, /DONE 4.9s/);
  });
});
