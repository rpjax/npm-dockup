import { ResolveError } from "../errors/index.js";

const REF_SOURCE = String.raw`\$\{([A-Za-z_][A-Za-z0-9_]*)\}`;

function refPattern(): RegExp {
  return new RegExp(REF_SOURCE, "g");
}

export function extractReferences(value: unknown): string[] {
  const refs: string[] = [];
  const text = String(value ?? "");
  for (const match of text.matchAll(refPattern())) {
    refs.push(match[1]!);
  }
  return refs;
}

export function interpolate(value: unknown, symbols: Map<string, string>): string {
  return String(value ?? "").replace(refPattern(), (_, name: string) => {
    if (!symbols.has(name)) {
      throw new ResolveError(`Unresolved symbol "${name}".`, { type: "missing" });
    }
    return symbols.get(name)!;
  });
}

interface EnvEntry {
  name: string;
  value: string | number | boolean;
  global?: boolean;
}

export function resolveEnvironmentEnv(entries: EnvEntry[] = []): Map<string, string> {
  const entryMap = new Map<string, EnvEntry>();
  for (const entry of entries) {
    entryMap.set(entry.name, entry);
  }

  const resolved = new Map<string, string>();
  const visiting = new Set<string>();

  function resolveName(name: string, stack: string[] = []): string {
    if (resolved.has(name)) {
      return resolved.get(name)!;
    }

    if (visiting.has(name)) {
      const cycleStart = stack.indexOf(name);
      const cycle = [...stack.slice(cycleStart), name];
      throw new ResolveError(`Circular dependency: ${cycle.join(" → ")}`, {
        type: "cycle",
        cycle,
      });
    }

    if (!entryMap.has(name)) {
      throw new ResolveError(`Unresolved symbol "${name}".`, { type: "missing" });
    }

    visiting.add(name);
    const entry = entryMap.get(name)!;
    for (const ref of extractReferences(entry.value)) {
      resolveName(ref, [...stack, name]);
    }
    visiting.delete(name);

    const value = interpolate(entry.value, resolved);
    resolved.set(name, value);
    return value;
  }

  for (const entry of entries) {
    resolveName(entry.name);
  }

  return resolved;
}

export function resolveContainerEnv(
  containerEnv: EnvEntry[] = [],
  envSymbols: Map<string, string>,
): Array<{ name: string; value: string }> {
  return containerEnv.map((entry) => ({
    name: entry.name,
    value: interpolate(entry.value, envSymbols),
  }));
}

export function composeRuntimeEnv(
  environmentEnv: EnvEntry[] = [],
  containerEnv: EnvEntry[] = [],
  envSymbols: Map<string, string>,
): Array<{ name: string; value: string }> {
  const runtime = new Map<string, string>();

  for (const entry of environmentEnv) {
    if (entry.global === true) {
      runtime.set(entry.name, envSymbols.get(entry.name) ?? "");
    }
  }

  for (const entry of resolveContainerEnv(containerEnv, envSymbols)) {
    runtime.set(entry.name, entry.value);
  }

  return [...runtime.entries()].map(([name, value]) => ({ name, value }));
}

export function resolveBuildArgs(
  buildArgs: EnvEntry[] = [],
  envSymbols: Map<string, string>,
): Array<{ name: string; value: string }> {
  return buildArgs.map((arg) => ({
    name: arg.name,
    value: interpolate(arg.value, envSymbols),
  }));
}
