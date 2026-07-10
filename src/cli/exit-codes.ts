export const EXIT = {
  OK: 0,
  CLI_CONFIG: 1,
  DOCKER: 2,
  RUNTIME: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
