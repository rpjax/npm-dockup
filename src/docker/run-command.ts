import { spawn } from "node:child_process";
import { DockupError, type ErrorPhase } from "../errors/index.js";
import type { Logger } from "../logger/index.js";
import type { ProcessCapture } from "../output/capture.js";
import type { OutputSink } from "../output/coordinator.js";
import { splitLines } from "../output/normalize.js";
import type { SubprocessVisibility } from "../output/visibility.js";

export const TAIL_LINES = 24;

export function tailText(text: string | undefined, lines = TAIL_LINES): string {
  if (!text?.trim()) {
    return "";
  }
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  command: string;
  capture?: ProcessCapture;
}

export interface RunCommandOptions {
  phase: ErrorPhase;
  label?: string;
  cwd: string;
  dryRun?: boolean;
  log: Logger;
  visibility?: SubprocessVisibility;
  sink?: OutputSink;
  isPush?: boolean;
}

export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<RunCommandResult> {
  const cmdLine = [command, ...args].join(" ");
  options.log.step(options.phase, options.label ?? cmdLine);

  if (options.dryRun) {
    options.log.info(options.phase, `[dry-run] ${cmdLine}`);
    return Promise.resolve({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
      command: cmdLine,
    });
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      shell: false,
      env: process.env,
      cwd: options.cwd,
    });

    let stdout = "";
    let stderr = "";

    const feed = (stream: "stdout" | "stderr", chunk: Buffer) => {
      const text = chunk.toString();
      if (stream === "stdout") {
        stdout += text;
      } else {
        stderr += text;
      }
      if (options.sink) {
        options.sink.feed(stream, text);
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => feed("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer) => feed("stderr", chunk));

    child.on("error", (err: NodeJS.ErrnoException) => {
      rejectPromise(
        new DockupError(options.phase, `Failed to start command: ${cmdLine}`, {
          cause: err,
          detail: err.code === "ENOENT" ? `Is "${command}" installed and on PATH?` : undefined,
        }),
      );
    });

    child.on("close", (code, signal) => {
      const exitCode = code ?? 1;
      const durationMs = Date.now() - startedAt;
      const capture = options.sink?.complete(exitCode);

      if (code === 0) {
        resolvePromise({
          stdout,
          stderr,
          exitCode: 0,
          durationMs,
          command: cmdLine,
          capture,
        });
        return;
      }

      const tail = tailText(stderr || stdout);
      rejectPromise(
        new DockupError(options.phase, `Command failed (${options.label ?? command}).`, {
          detail: [
            `Command: ${cmdLine}`,
            `Exit code: ${code ?? "unknown"}`,
            signal ? `Signal: ${signal}` : null,
            tail ? `Last output:\n${tail}` : "No output captured.",
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      );
    });
  });
}

export function feedLinesToSink(sink: OutputSink, text: string, stream: "stdout" | "stderr"): void {
  if (!text) {
    return;
  }
  for (const line of splitLines(text)) {
    sink.feed(stream, `${line}\n`);
  }
}
