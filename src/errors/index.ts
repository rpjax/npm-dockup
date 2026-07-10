export type ErrorPhase =
  "CLI" | "CONFIG" | "PREFLIGHT" | "BUILD" | "PUSH" | "GENERATE" | "VALIDATE" | "RUNTIME";

export interface DockupErrorOptions {
  cause?: unknown;
  hint?: string;
  detail?: string;
}

export class DockupError extends Error {
  readonly phase: ErrorPhase;
  readonly hint?: string;
  readonly detail?: string;
  readonly causeText?: string;

  constructor(phase: ErrorPhase, message: string, options: DockupErrorOptions = {}) {
    super(message);
    this.name = "DockupError";
    this.phase = phase;
    this.hint = options.hint;
    this.detail = options.detail;
    this.causeText =
      options.cause instanceof Error
        ? options.cause.message
        : options.cause !== undefined
          ? String(options.cause)
          : undefined;
  }
}

export class ConfigDiscoveryError extends Error {
  readonly detail?: string;
  readonly hint?: string;

  constructor(message: string, options: { detail?: string; hint?: string } = {}) {
    super(message);
    this.name = "ConfigDiscoveryError";
    this.detail = options.detail;
    this.hint = options.hint;
  }
}

export class ResolveError extends Error {
  readonly type?: "missing" | "cycle";
  readonly cycle?: string[];

  constructor(message: string, options: { type?: "missing" | "cycle"; cycle?: string[] } = {}) {
    super(message);
    this.name = "ResolveError";
    this.type = options.type;
    this.cycle = options.cycle;
  }
}

export function fail(phase: ErrorPhase, message: string, options: DockupErrorOptions = {}): never {
  throw new DockupError(phase, message, options);
}
