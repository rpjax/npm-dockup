/* eslint-disable no-control-regex -- ANSI escape stripping */
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function trimLine(text: string): string {
  return stripAnsi(text).trimEnd();
}

export function splitLines(text: string): string[] {
  return stripAnsi(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

const WAITING_PATTERN = /^[\w]+:\s*Waiting\s*$/i;
const PUSHED_PATTERN = /^([\w]+:\s*)?(Pushed|Layer already exists)/i;
const DIGEST_PATTERN = /digest:\s*(sha256:[a-f0-9]+)/i;

export interface PushProgress {
  summary: string;
  uploaded: number;
  total: number;
}

export function summarizePushLine(lines: string[]): string | null {
  let waiting = 0;
  let uploaded = 0;
  let digest = "";

  for (const line of lines) {
    if (WAITING_PATTERN.test(line)) {
      waiting += 1;
    }
    if (PUSHED_PATTERN.test(line)) {
      uploaded += 1;
    }
    const digestMatch = DIGEST_PATTERN.exec(line);
    if (digestMatch?.[1]) {
      digest = digestMatch[1];
    }
  }

  const total = Math.max(waiting + uploaded, uploaded, 1);
  if (uploaded === 0 && waiting === 0) {
    return digest ? `Pushed · ${digest}` : null;
  }

  const progress = `Pushing layers… ${uploaded}/${total}`;
  return digest ? `${progress} · ${digest}` : progress;
}

export function normalizeDisplayLine(line: string, context?: { isPush?: boolean }): string {
  const cleaned = trimLine(line);
  if (!cleaned) {
    return "";
  }
  if (context?.isPush && WAITING_PATTERN.test(cleaned)) {
    return "";
  }
  return cleaned;
}
