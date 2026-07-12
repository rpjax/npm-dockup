import pc from "picocolors";

export interface SessionHeaderOptions {
  version: string;
  command: string;
  env?: string;
  configBasename?: string;
  flags?: string[];
  color?: boolean;
}

export function printSessionHeader(options: SessionHeaderOptions): void {
  const useColor = options.color ?? defaultColor();
  const c = (text: string, style: (v: string) => string) => (useColor ? style(text) : text);

  const metaParts = [options.command];
  if (options.env) {
    metaParts.push(`env ${options.env}`);
  }
  if (options.configBasename) {
    metaParts.push(options.configBasename);
  }
  if (options.flags?.length) {
    metaParts.push(options.flags.join(" · "));
  }

  console.log("");
  console.log(`${c("dockup", pc.bold)}  ${c(`v${options.version}`, pc.dim)}`);
  console.log(c(metaParts.join("  ·  "), pc.dim));
  console.log(c("────────────────────────────────────────", pc.dim));
  console.log("");
}

function defaultColor(): boolean {
  return pc.isColorSupported && process.stdout.isTTY === true && !process.env.NO_COLOR;
}

export function printSection(title: string, color = defaultColor()): void {
  const text = `── ${title} ──`;
  console.log("");
  console.log(color ? pc.bold(text) : text);
  console.log("");
}
