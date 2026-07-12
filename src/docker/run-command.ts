import { spawn } from "node:child_process";
import { DockupError, type ErrorPhase } from "../errors/index.js";
import type { Logger } from "../logger/index.js";

const TAIL_LINES = 24;

function tailText(text: string | undefined, lines = TAIL_LINES): string {
  if (!text?.trim()) {
    return "";
  }
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

export interface RunCommandOptions {
  phase: ErrorPhase;
  label?: string;
  inherit?: boolean;
  cwd: string;
  dryRun?: boolean;
  log: Logger;
}

export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<{ stdout: string; stderr: string }> {
  const cmdLine = [command, ...args].join(" ");
  options.log.step(options.phase, options.label ?? cmdLine);

  if (options.dryRun) {
    options.log.info(options.phase, `[dry-run] ${cmdLine}`);
    return Promise.resolve({ stdout: "", stderr: "" });
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      shell: false,
      env: process.env,
      cwd: options.cwd,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (options.inherit !== false) {
        process.stdout.write(chunk);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (options.inherit !== false) {
        process.stderr.write(chunk);
      }
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      rejectPromise(
        new DockupError(options.phase, `Failed to start command: ${cmdLine}`, {
          cause: err,
          detail: err.code === "ENOENT" ? `Is "${command}" installed and on PATH?` : undefined,
        }),
      );
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
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
