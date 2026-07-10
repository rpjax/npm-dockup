import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEnvironment } from "../config/validate.js";
import type { ComposeArtifacts, DockupConfig } from "../config/types.js";
import type { Logger } from "../logger/index.js";
import { runCommand } from "../docker/run-command.js";
import { buildComposeDocument, buildEnvFileContent, serializeCompose } from "./render.js";

export function generateComposeArtifacts(options: {
  config: DockupConfig;
  envKey: string;
  configDir: string;
  log: Logger;
}): ComposeArtifacts {
  const { config, envKey, configDir, log } = options;

  log.section("Generate artifacts");

  const resolved = getEnvironment(config, envKey);
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);
  const composeContent = serializeCompose(doc);
  const envFile = buildEnvFileContent(resolved, envKey);

  const outDir = join(configDir, "out", envKey);
  mkdirSync(outDir, { recursive: true });

  const composePath = join(outDir, "docker-compose.yml");
  const envPath = join(outDir, ".env");

  writeFileSync(composePath, composeContent, "utf8");
  writeFileSync(envPath, envFile, "utf8");

  log.ok("GENERATE", `Wrote ${composePath}`);
  log.ok("GENERATE", `Wrote ${envPath}`);

  return { composePath, envPath, outDir, composeContent };
}

export async function validateComposeArtifacts(options: {
  composePath: string;
  envPath: string;
  configDir: string;
  log: Logger;
  dryRun?: boolean;
}): Promise<void> {
  const { composePath, envPath, configDir, log, dryRun } = options;

  log.section("Validate compose");

  if (dryRun) {
    log.info("VALIDATE", "[dry-run] skipping docker compose config");
    return;
  }

  await runCommand("docker", ["compose", "-f", composePath, "--env-file", envPath, "config"], {
    phase: "VALIDATE",
    label: "docker compose config",
    inherit: false,
    cwd: configDir,
    log,
  });

  log.ok("VALIDATE", "docker-compose.yml is valid.");
}
