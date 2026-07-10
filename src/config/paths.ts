import { resolve } from "node:path";

export interface ConfigPaths {
  configDir: string;
  repoRoot: string;
  configPath: string;
}

export function resolveConfigPaths(input: ConfigPaths): ConfigPaths {
  return {
    configDir: resolve(input.configDir),
    repoRoot: resolve(input.repoRoot),
    configPath: resolve(input.configPath),
  };
}
