import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ResolvedEnvironment } from "../config/types.js";
import type { Logger } from "../logger/index.js";
import { imageRoot } from "./image.js";
import { runCommand } from "./run-command.js";

function registryAuthKeys(registry?: string): string[] {
  if (!registry) {
    return ["https://index.docker.io/v1/", "docker.io"];
  }
  const normalized = registry.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return [normalized, `https://${normalized}/`, registry];
}

function hasRegistryAuth(auths: Record<string, unknown>, registry?: string): boolean {
  const keys = Object.keys(auths);
  const targets = registryAuthKeys(registry);
  return keys.some((key) =>
    targets.some((target) => key.includes(target.replace(/^https?:\/\//, ""))),
  );
}

export async function preflight(options: {
  resolved: ResolvedEnvironment;
  configPath: string;
  configDir: string;
  repoRoot: string;
  log: Logger;
  dryRun?: boolean;
}): Promise<void> {
  const { resolved, configPath, configDir, repoRoot, log, dryRun } = options;

  log.section("Preflight");

  await runCommand("docker", ["version"], {
    phase: "PREFLIGHT",
    label: "Docker client/server",
    cwd: configDir,
    dryRun,
    log,
  });
  log.ok("PREFLIGHT", "Docker is available.");

  const info = await runCommand("docker", ["info", "--format", "{{.ServerVersion}}"], {
    phase: "PREFLIGHT",
    label: "Docker daemon",
    inherit: false,
    cwd: configDir,
    dryRun,
    log,
  });
  log.ok("PREFLIGHT", `Docker daemon reachable (server ${info.stdout.trim()}).`);

  const dockerConfig = join(homedir(), ".docker", "config.json");
  const registryLabel = resolved.registry ?? "docker.io";
  const imagePrefix = imageRoot(resolved);

  if (!existsSync(dockerConfig)) {
    log.warn("PREFLIGHT", "Docker config not found — push may fail if you are not logged in.", {
      detail: `Expected: ${dockerConfig}`,
    });
  } else {
    try {
      const cfg = JSON.parse(readFileSync(dockerConfig, "utf8")) as {
        auths?: Record<string, unknown>;
      };
      const auths = cfg.auths ?? {};
      if (hasRegistryAuth(auths, resolved.registry)) {
        log.ok("PREFLIGHT", `Registry credentials found for ${registryLabel}.`);
      } else {
        log.warn("PREFLIGHT", `No credentials found for registry ${registryLabel}.`, {
          detail: `Push target: ${imagePrefix}`,
          hint: resolved.registry ? `Run: docker login ${resolved.registry}` : "Run: docker login",
        });
      }
    } catch {
      log.warn("PREFLIGHT", "Could not parse Docker config — skipping registry auth check.");
    }
  }

  log.ok("PREFLIGHT", `Working directory: ${configDir}`);
  log.ok("PREFLIGHT", `Config file:       ${configPath}`);
  log.ok("PREFLIGHT", `Repository root:   ${repoRoot}`);
}
