import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEnvironment } from "../config/validate.js";
import type { ComposeArtifacts, DockupConfig } from "../config/types.js";
import type { RunContext } from "../cli/run-context.js";
import { runCommand } from "../docker/run-command.js";
import { buildComposeDocument, buildEnvFileContent, serializeCompose } from "./render.js";
import type { ProcessCapture } from "../output/capture.js";

export function generateComposeArtifacts(options: {
  config: DockupConfig;
  envKey: string;
  configDir: string;
  run: RunContext;
}): ComposeArtifacts {
  const { config, envKey, configDir, run } = options;
  const log = run.log;

  if (!run.interactive) {
    log.section("Generate artifacts");
  }

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

  if (!run.interactive) {
    log.ok("GENERATE", `Wrote ${composePath}`);
    log.ok("GENERATE", `Wrote ${envPath}`);
  }

  return { composePath, envPath, outDir, composeContent };
}

export async function validateComposeArtifacts(options: {
  composePath: string;
  envPath: string;
  configDir: string;
  run: RunContext;
  dryRun?: boolean;
}): Promise<ProcessCapture | undefined> {
  const { composePath, envPath, configDir, run, dryRun } = options;
  const log = run.log;

  if (!run.interactive) {
    log.section("Validate compose");
  }

  if (dryRun) {
    log.info("VALIDATE", "[dry-run] skipping docker compose config");
    return undefined;
  }

  const args = ["compose", "-f", composePath, "--env-file", envPath, "config"];
  const cmdLine = `docker ${args.join(" ")}`;
  const sink = run.coordinator.createSink({
    phase: "VALIDATE",
    label: "docker compose config",
    command: cmdLine,
  });

  const result = await runCommand("docker", args, {
    phase: "VALIDATE",
    label: "docker compose config",
    cwd: configDir,
    dryRun,
    log,
    visibility: run.visibility,
    sink,
  });

  if (!run.interactive) {
    log.ok("VALIDATE", "docker-compose.yml is valid.");
  }

  return result.capture;
}
