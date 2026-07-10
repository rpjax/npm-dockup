import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ConfigDiscoveryError } from "../errors/index.js";

export const CONFIG_SUFFIX = ".dockup.json";

export function listConfigFiles(cwd: string): string[] {
  return readdirSync(cwd)
    .filter((name) => name.endsWith(CONFIG_SUFFIX))
    .map((name) => join(cwd, name));
}

export function discoverConfigFile(cwd: string): string {
  const matches = listConfigFiles(cwd);

  if (matches.length === 0) {
    throw new ConfigDiscoveryError(`No *${CONFIG_SUFFIX} config found.`, {
      detail: `Directory: ${cwd}`,
      hint: "Run: dockup init — or copy examples/minimal.dockup.json",
    });
  }

  if (matches.length > 1) {
    throw new ConfigDiscoveryError(`Ambiguous config: multiple *${CONFIG_SUFFIX} files found.`, {
      detail: matches.join("\n"),
      hint: `Keep only one *${CONFIG_SUFFIX} in the working directory, or pass --config.`,
    });
  }

  return matches[0]!;
}
