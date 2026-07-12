import pc from "picocolors";
import type { DockupError } from "../errors/index.js";
import { exitCodeForPhase } from "../cli/exit-codes.js";
import { tailText } from "../docker/run-command.js";
import { formatIndentedList } from "./align.js";
import { printSection } from "./session.js";

export interface ErrorPanelOptions {
  err: DockupError;
  startedAt: number;
  color?: boolean;
}

export function printErrorPanel(options: ErrorPanelOptions): void {
  const useColor = options.color ?? defaultColor();
  const c = (text: string, style: (v: string) => string) => (useColor ? style(text) : text);
  const { err } = options;
  const elapsedSec = ((Date.now() - options.startedAt) / 1000).toFixed(1);
  const exitCode = exitCodeForPhase(err.phase);

  printSection("Error", useColor);
  console.log(c(`  ✖  [${err.phase}] ${err.message}`, pc.red));
  console.log("");

  if (err.detail) {
    for (const line of formatIndentedList(err.detail.split("\n"))) {
      console.log(line);
    }
    console.log("");
  }

  if (err.causeText) {
    console.log(formatDetailLine(`Cause: ${err.causeText}`));
    console.log("");
  }

  if (err.hint) {
    console.log(c(`       ↳ Hint: ${err.hint}`, pc.yellow));
    console.log("");
  }

  console.log(`  Elapsed  ${elapsedSec}s`);
  console.log(`  Exit     ${exitCode}`);
  console.log("");
}

function formatDetailLine(text: string): string {
  return `       │ ${text}`;
}

function defaultColor(): boolean {
  return pc.isColorSupported && process.stdout.isTTY === true && !process.env.NO_COLOR;
}

export { tailText };
