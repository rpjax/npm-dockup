import pc from "picocolors";

export const SUBPROCESS_INDENT = "       │ ";

export interface FrameOptions {
  color?: boolean;
}

export function formatSubprocessLine(line: string, options: FrameOptions = {}): string {
  const useColor = options.color ?? false;
  const prefix = useColor ? pc.dim(SUBPROCESS_INDENT) : SUBPROCESS_INDENT;
  const body = useColor ? pc.dim(line) : line;
  return `${prefix}${body}`;
}

export function formatSubprocessBlock(lines: string[], options: FrameOptions = {}): string[] {
  return lines.map((line) => formatSubprocessLine(line, options));
}

export function openPanel(title: string, options: FrameOptions = {}): string {
  const useColor = options.color ?? false;
  const text = `── ${title} ──`;
  return useColor ? pc.bold(text) : text;
}

export function closePanel(status: string, options: FrameOptions = {}): string {
  const useColor = options.color ?? false;
  const text = `── ${status} ──`;
  return useColor ? pc.dim(text) : text;
}
