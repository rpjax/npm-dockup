import pc from "picocolors";

export type LogLevel = "INFO" | "OK" | "WARN" | "ERROR" | "STEP" | "DEBUG";

export interface LogOptions {
  detail?: string;
  hint?: string;
}

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  json?: boolean;
  interactive?: boolean;
}

export class Logger {
  readonly startedAt = Date.now();
  readonly records: Array<{ level: LogLevel; phase: string; message: string; at: number }> = [];

  private readonly quiet: boolean;
  private readonly verbose: boolean;
  private readonly json: boolean;
  private readonly interactive: boolean;
  private readonly color: boolean;

  constructor(options: LoggerOptions = {}) {
    this.quiet = options.quiet ?? false;
    this.verbose = options.verbose ?? false;
    this.json = options.json ?? false;
    this.interactive = options.interactive ?? false;
    this.color =
      !this.json && pc.isColorSupported && process.stdout.isTTY === true && !process.env.NO_COLOR;
  }

  private c(text: string, style: (value: string) => string): string {
    return this.color ? style(text) : text;
  }

  private timestamp(): string {
    return new Date().toISOString().slice(11, 23);
  }

  private shouldWrite(level: LogLevel): boolean {
    if (this.json) {
      return false;
    }
    if (this.interactive && level !== "ERROR" && level !== "WARN" && level !== "DEBUG") {
      return false;
    }
    if (this.quiet && level !== "ERROR" && level !== "WARN") {
      return false;
    }
    return true;
  }

  write(level: LogLevel, phase: string, message: string, options: LogOptions = {}): void {
    this.records.push({ level, phase, message, at: Date.now() });

    if (!this.shouldWrite(level)) {
      return;
    }

    if (level === "DEBUG" && !this.verbose) {
      return;
    }

    const levelStyles: Record<LogLevel, (value: string) => string> = {
      INFO: pc.cyan,
      OK: pc.green,
      WARN: pc.yellow,
      ERROR: pc.red,
      STEP: pc.magenta,
      DEBUG: pc.dim,
    };

    const style = levelStyles[level] ?? ((value: string) => value);
    const phaseLabel = phase ? `${this.c(`[${phase}]`, pc.bold)} ` : "";
    const line = `${this.c(this.timestamp(), pc.dim)} ${style(level.padEnd(5))} ${phaseLabel}${message}`;
    console.log(line);

    if (options.detail) {
      for (const row of options.detail.split("\n")) {
        console.log(`${this.c("       │ ", pc.dim)}${row}`);
      }
    }
    if (options.hint) {
      console.log(`${this.c(`       ↳ Hint: ${options.hint}`, pc.yellow)}`);
    }
  }

  info(phase: string, message: string, options?: LogOptions): void {
    this.write("INFO", phase, message, options);
  }

  ok(phase: string, message: string, options?: LogOptions): void {
    this.write("OK", phase, message, options);
  }

  warn(phase: string, message: string, options?: LogOptions): void {
    this.write("WARN", phase, message, options);
  }

  error(phase: string, message: string, options?: LogOptions): void {
    this.write("ERROR", phase, message, options);
  }

  step(phase: string, message: string): void {
    this.write("STEP", phase, message);
  }

  debug(phase: string, message: string, options?: LogOptions): void {
    this.write("DEBUG", phase, message, options);
  }

  banner(version?: string): void {
    if (this.json || this.quiet || this.interactive) {
      return;
    }
    console.log("");
    console.log(
      `${this.c("dockup", pc.bold)}  ${this.c(`@rodrigopjax/dockup${version ? ` v${version}` : ""}`, pc.dim)}`,
    );
    console.log(this.c("────────────────────────────────────────", pc.dim));
  }

  section(title: string): void {
    if (this.json || this.quiet || this.interactive) {
      return;
    }
    console.log("");
    console.log(this.c(`── ${title} ──`, pc.bold));
  }

  summary(payload: {
    env: string;
    namespace: string;
    tag: string;
    built: string[];
    pushed: string[];
    artifacts: string[];
    elapsedSec: string;
  }): void {
    if (this.json || this.interactive || this.quiet) {
      return;
    }
    this.section("Summary");
    this.ok("DONE", `Environment: ${payload.env}`);
    this.ok("DONE", `Namespace:   ${payload.namespace}`);
    this.ok("DONE", `Image tag:   ${payload.tag}`);
    if (payload.built.length) {
      this.ok("DONE", `Built:       ${payload.built.join(", ")}`);
    }
    if (payload.pushed.length) {
      this.ok("DONE", `Pushed:      ${payload.pushed.join(", ")}`);
    }
    for (const file of payload.artifacts) {
      this.ok("DONE", `Artifact:    ${file}`);
    }
    this.ok("DONE", `Completed in ${payload.elapsedSec}s`);
    console.log("");
    this.info(
      "DONE",
      `VPS: copy out/${payload.env}/ then run: docker compose pull && docker compose up -d`,
    );
    console.log("");
  }

  deployComplete(payload: { env: string; artifacts: string[]; elapsedSec: string }): void {
    if (this.json || this.quiet) {
      return;
    }
    console.log("");
    this.ok("DONE", `Completed in ${payload.elapsedSec}s — artifacts in out/${payload.env}/`);
    for (const file of payload.artifacts) {
      this.info("DONE", file);
    }
    console.log("");
    this.info(
      "DONE",
      `VPS: copy out/${payload.env}/ then run: docker compose pull && docker compose up -d`,
    );
    console.log("");
  }
}
