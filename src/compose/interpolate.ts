import { interpolate } from "../env/resolve.js";

export function interpolateValue(value: unknown, symbols: Map<string, string>): unknown {
  if (typeof value === "string") {
    return interpolate(value, symbols);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, symbols));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = typeof entry === "string" ? interpolate(entry, symbols) : entry;
    }
    return result;
  }

  return value;
}

export function interpolateStringArray(values: string[], symbols: Map<string, string>): string[] {
  return values.map((value) => interpolate(value, symbols));
}

export function interpolateCommand(
  command: string | string[] | undefined,
  symbols: Map<string, string>,
): string | string[] | undefined {
  if (command === undefined) {
    return undefined;
  }
  if (typeof command === "string") {
    return interpolate(command, symbols);
  }
  return interpolateStringArray(command, symbols);
}

export function interpolateLabels(
  labels: string[] | Record<string, string> | undefined,
  symbols: Map<string, string>,
): Record<string, string> | undefined {
  if (labels === undefined) {
    return undefined;
  }

  if (Array.isArray(labels)) {
    const result: Record<string, string> = {};
    for (const entry of labels) {
      const interpolated = interpolate(entry, symbols);
      const separator = interpolated.indexOf("=");
      if (separator === -1) {
        result[interpolated] = "";
        continue;
      }
      const key = interpolated.slice(0, separator);
      const value = interpolated.slice(separator + 1);
      result[key] = value;
    }
    return result;
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    result[interpolate(key, symbols)] = interpolate(value, symbols);
  }
  return result;
}
