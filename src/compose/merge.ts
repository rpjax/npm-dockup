function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge source into target. Arrays are replaced (not concatenated).
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!source) {
    return target;
  }

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      target[key] = deepMerge({ ...targetValue }, sourceValue);
      continue;
    }

    target[key] = sourceValue;
  }

  return target;
}
