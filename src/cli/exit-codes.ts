import type { ErrorPhase } from "../errors/index.js";

export const EXIT = {
  OK: 0,
  CLI_CONFIG: 1,
  DOCKER: 2,
  RUNTIME: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export function exitCodeForPhase(phase: ErrorPhase): ExitCode {
  if (phase === "CLI" || phase === "CONFIG" || phase === "GENERATE") {
    return EXIT.CLI_CONFIG;
  }
  if (phase === "RUNTIME") {
    return EXIT.RUNTIME;
  }
  return EXIT.DOCKER;
}
