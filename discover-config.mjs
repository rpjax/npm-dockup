import { readdirSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_SUFFIX = ".deploy.json";

export class ConfigDiscoveryError extends Error {
  constructor(message, { detail, hint } = {}) {
    super(message);
    this.name = "ConfigDiscoveryError";
    this.detail = detail;
    this.hint = hint;
  }
}

export function listConfigFiles(cwd) {
  return readdirSync(cwd)
    .filter((name) => name.endsWith(CONFIG_SUFFIX))
    .map((name) => join(cwd, name));
}

export function discoverConfigFile(cwd) {
  const matches = listConfigFiles(cwd);

  if (matches.length === 0) {
    throw new ConfigDiscoveryError(`No *${CONFIG_SUFFIX} config found.`, {
      detail: `Directory: ${cwd}`,
      hint: "Copy an example config to a file ending in .deploy.json",
    });
  }

  if (matches.length > 1) {
    throw new ConfigDiscoveryError(`Ambiguous config: multiple *${CONFIG_SUFFIX} files found.`, {
      detail: matches.join("\n"),
      hint: `Keep only one *${CONFIG_SUFFIX} in the working directory.`,
    });
  }

  return matches[0];
}
