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
  readonly isJson: boolean;
  readonly isQuiet: boolean;

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
    this.isJson = this.json;
    this.isQuiet = this.quiet;
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
    const timePrefix = this.verbose ? `${this.c(this.timestamp(), pc.dim)} ` : "";
    const line = `${timePrefix}${style(level.padEnd(5))} ${phaseLabel}${message}`;
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

  section(title: string): void {
    if (this.json || this.quiet || this.interactive) {
      return;
    }
    console.log("");
    console.log(this.c(`── ${title} ──`, pc.bold));
  }
}
