import type { ErrorPhase } from "../errors/index.js";

export const CAPTURE_BYTE_LIMIT = 512 * 1024;

export interface ProcessCaptureMeta {
  phase: ErrorPhase;
  label: string;
  command: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
}

export interface ProcessCapture extends ProcessCaptureMeta {
  stdout: string;
  stderr: string;
}

export class ProcessCaptureBuffer {
  private stdoutBuf = "";
  private stderrBuf = "";
  private stdoutTruncated = false;
  private stderrTruncated = false;
  readonly startedAt = Date.now();

  append(stream: "stdout" | "stderr", chunk: string): void {
    if (stream === "stdout") {
      this.stdoutBuf = appendCapped(this.stdoutBuf, chunk, CAPTURE_BYTE_LIMIT, (t) => {
        this.stdoutTruncated = t;
      });
      return;
    }
    this.stderrBuf = appendCapped(this.stderrBuf, chunk, CAPTURE_BYTE_LIMIT, (t) => {
      this.stderrTruncated = t;
    });
  }

  get stdout(): string {
    return this.stdoutBuf;
  }

  get stderr(): string {
    return this.stderrBuf;
  }

  get truncated(): boolean {
    return this.stdoutTruncated || this.stderrTruncated;
  }

  toCapture(meta: Omit<ProcessCaptureMeta, "exitCode" | "durationMs" | "truncated">, exitCode: number): ProcessCapture {
    return {
      ...meta,
      exitCode,
      durationMs: Date.now() - this.startedAt,
      truncated: this.truncated,
      stdout: this.stdoutBuf,
      stderr: this.stderrBuf,
    };
  }
}

function appendCapped(
  current: string,
  chunk: string,
  limit: number,
  onTruncated: (value: boolean) => void,
): string {
  if (current.length >= limit) {
    onTruncated(true);
    return current;
  }
  const next = current + chunk;
  if (next.length <= limit) {
    return next;
  }
  onTruncated(true);
  return next.slice(0, limit);
}
