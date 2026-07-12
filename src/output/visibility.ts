export type SubprocessVisibility = "silent" | "peek" | "stream";

export interface VisibilityOptions {
  quiet?: boolean;
  json?: boolean;
  streamLogs?: boolean;
}

export function resolveVisibility(options: VisibilityOptions): SubprocessVisibility {
  if (options.quiet || options.json) {
    return "silent";
  }
  if (options.streamLogs) {
    return "stream";
  }
  return "peek";
}
