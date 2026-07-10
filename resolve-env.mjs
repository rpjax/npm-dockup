const REF_SOURCE = "\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}";

function refPattern() {
  return new RegExp(REF_SOURCE, "g");
}

export class ResolveError extends Error {
  constructor(message, { type, cycle } = {}) {
    super(message);
    this.name = "ResolveError";
    this.type = type;
    this.cycle = cycle;
  }
}

export function extractReferences(value) {
  const refs = [];
  const text = String(value ?? "");
  for (const match of text.matchAll(refPattern())) {
    refs.push(match[1]);
  }
  return refs;
}

export function interpolate(value, symbols) {
  return String(value ?? "").replace(refPattern(), (_, name) => {
    if (!symbols.has(name)) {
      throw new ResolveError(`Unresolved symbol "${name}".`, { type: "missing" });
    }
    return symbols.get(name);
  });
}

export function resolveEnvironmentEnv(entries = []) {
  const entryMap = new Map();
  for (const entry of entries) {
    entryMap.set(entry.name, entry);
  }

  const resolved = new Map();
  const visiting = new Set();

  function resolveName(name, stack = []) {
    if (resolved.has(name)) {
      return resolved.get(name);
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
    const entry = entryMap.get(name);
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

export function resolveContainerEnv(containerEnv = [], envSymbols) {
  return containerEnv.map((entry) => ({
    name: entry.name,
    value: interpolate(entry.value, envSymbols),
  }));
}

export function composeRuntimeEnv(environmentEnv = [], containerEnv = [], envSymbols) {
  const runtime = new Map();

  for (const entry of environmentEnv) {
    if (entry.global === true) {
      runtime.set(entry.name, envSymbols.get(entry.name));
    }
  }

  for (const entry of resolveContainerEnv(containerEnv, envSymbols)) {
    runtime.set(entry.name, entry.value);
  }

  return [...runtime.entries()].map(([name, value]) => ({ name, value }));
}

export function resolveBuildArgs(buildArgs = [], envSymbols) {
  return buildArgs.map((arg) => ({
    name: arg.name,
    value: interpolate(arg.value, envSymbols),
  }));
}
