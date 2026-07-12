import type { Logger } from "../logger/index.js";
import { OutputCoordinator } from "../output/coordinator.js";
import { resolveVisibility, type SubprocessVisibility } from "../output/visibility.js";
import type { GlobalOptions } from "./options.js";

export interface RunContext {
  log: Logger;
  visibility: SubprocessVisibility;
  coordinator: OutputCoordinator;
  interactive: boolean;
  streamLogs: boolean;
  withLogs: boolean;
}

export function createRunContext(
  global: Pick<GlobalOptions, "json" | "quiet" | "streamLogs" | "withLogs">,
  log: Logger,
  interactive: boolean,
): RunContext {
  const visibility = resolveVisibility(global);
  const useColor =
    !global.json &&
    process.stdout.isTTY === true &&
    !process.env.NO_COLOR &&
    process.env.FORCE_COLOR !== "0";

  return {
    log,
    visibility,
    coordinator: new OutputCoordinator(visibility, useColor),
    interactive,
    streamLogs: Boolean(global.streamLogs),
    withLogs: Boolean(global.withLogs),
  };
}
