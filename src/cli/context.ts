import { resolve } from "node:path";
import { resolveConfigPaths } from "../config/paths.js";
import { discoverConfigFile } from "../config/discovery.js";
import { loadConfig } from "../config/load.js";
import { fail, ConfigDiscoveryError } from "../errors/index.js";
import type { GlobalOptions } from "./options.js";

export function resolveConfigContext(options: Pick<GlobalOptions, "config" | "root">) {
  const configDir = resolve(process.cwd());
  const repoRoot = resolve(configDir, options.root);

  try {
    const configPath = options.config
      ? resolve(configDir, options.config)
      : discoverConfigFile(configDir);

    return resolveConfigPaths({ configDir, repoRoot, configPath });
  } catch (err) {
    if (err instanceof ConfigDiscoveryError) {
      fail("CONFIG", err.message, { detail: err.detail, hint: err.hint });
    }
    throw err;
  }
}

export function loadValidatedConfig(options: Pick<GlobalOptions, "config" | "root">) {
  const context = resolveConfigContext(options);
  const config = loadConfig(context.configPath);
  return { ...context, config };
}
