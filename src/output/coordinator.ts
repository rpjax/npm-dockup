import type { ErrorPhase } from "../errors/index.js";
import { ProcessCaptureBuffer, type ProcessCapture } from "./capture.js";
import { closePanel, formatSubprocessBlock, openPanel } from "./frame.js";
import { normalizeDisplayLine, stripAnsi, summarizePushLine } from "./normalize.js";
import type { SubprocessVisibility } from "./visibility.js";

const PEEK_LINES = 5;
const PANEL_LINES = 15;
const MIN_UPDATE_MS = 100;

export interface OutputSinkOptions {
  phase: ErrorPhase;
  label: string;
  command: string;
  isPush?: boolean;
}

export class OutputSink {
  private readonly buffer = new ProcessCaptureBuffer();
  private readonly displayLines: string[] = [];
  private pushLines: string[] = [];
  private panelOpen = false;
  private panelTitle = "";
  private lastUpdateAt = 0;
  private lineCarry = "";

  constructor(
    private readonly coordinator: OutputCoordinator,
    private readonly options: OutputSinkOptions,
  ) {}

  get peekText(): string {
    if (this.displayLines.length === 0) {
      return "";
    }
    return formatSubprocessBlock(this.displayLines.slice(-PEEK_LINES), {
      color: this.coordinator.useColor,
    }).join("\n");
  }

  feed(stream: "stdout" | "stderr", chunk: string): void {
    this.buffer.append(stream, chunk);
    this.lineCarry += chunk;
    const rawParts = this.lineCarry.split("\n");
    this.lineCarry = rawParts.pop() ?? "";

    for (const raw of rawParts) {
      const line = stripAnsi(raw).trimEnd();
      if (line) {
        this.ingestLine(line);
      }
    }

    this.flushDisplay(false);
  }

  complete(exitCode: number): ProcessCapture {
    const trailing = stripAnsi(this.lineCarry).trimEnd();
    if (trailing) {
      this.ingestLine(trailing);
      this.lineCarry = "";
    }

    this.flushDisplay(true);
    if (this.coordinator.visibility === "stream" && this.panelOpen) {
      this.coordinator.writeLine(
        closePanel(exitCode === 0 ? "done" : `failed (exit ${exitCode})`, {
          color: this.coordinator.useColor,
        }),
      );
      this.panelOpen = false;
    }
    return this.buffer.toCapture(
      {
        phase: this.options.phase,
        label: this.options.label,
        command: this.options.command,
      },
      exitCode,
    );
  }

  private ingestLine(rawLine: string): void {
    if (this.options.isPush) {
      this.pushLines.push(rawLine);
      const summary = summarizePushLine(this.pushLines);
      if (summary) {
        this.setLastDisplayLine(summary);
      }
      return;
    }

    const line = normalizeDisplayLine(rawLine, { isPush: this.options.isPush });
    if (!line) {
      return;
    }
    this.displayLines.push(line);
    if (this.displayLines.length > PANEL_LINES * 2) {
      this.displayLines.splice(0, this.displayLines.length - PANEL_LINES * 2);
    }
  }

  private setLastDisplayLine(line: string): void {
    if (this.displayLines.length === 0) {
      this.displayLines.push(line);
      return;
    }
    this.displayLines[this.displayLines.length - 1] = line;
  }

  private flushDisplay(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastUpdateAt < MIN_UPDATE_MS) {
      this.coordinator.scheduleFlush(() => this.flushDisplay(true));
      return;
    }
    this.lastUpdateAt = now;

    const lines = this.displayLines.slice(-this.visibleLineCount());
    if (lines.length === 0) {
      return;
    }

    if (this.coordinator.visibility === "peek") {
      this.coordinator.notifyPeek(this);
      return;
    }

    if (this.coordinator.visibility === "stream") {
      if (!this.panelOpen) {
        this.panelTitle = this.options.label;
        this.coordinator.writeLine(
          openPanel(this.panelTitle, { color: this.coordinator.useColor }),
        );
        this.panelOpen = true;
      }
      for (const line of lines.slice(-1)) {
        this.coordinator.writeLine(
          formatSubprocessBlock([line], { color: this.coordinator.useColor })[0] ?? "",
        );
      }
    }
  }

  private visibleLineCount(): number {
    return this.coordinator.visibility === "stream" ? PANEL_LINES : PEEK_LINES;
  }
}

export class OutputCoordinator {
  readonly visibility: SubprocessVisibility;
  readonly useColor: boolean;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private peekHandler: ((sink: OutputSink) => void) | null = null;

  constructor(visibility: SubprocessVisibility, useColor: boolean) {
    this.visibility = visibility;
    this.useColor = useColor;
  }

  onPeek(handler: (sink: OutputSink) => void): void {
    this.peekHandler = handler;
  }

  notifyPeek(sink: OutputSink): void {
    this.peekHandler?.(sink);
  }

  createSink(options: OutputSinkOptions): OutputSink {
    return new OutputSink(this, options);
  }

  writeLine(line: string): void {
    if (this.visibility === "silent") {
      return;
    }
    console.log(line);
  }

  scheduleFlush(callback: () => void): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      callback();
    }, MIN_UPDATE_MS);
  }
}
