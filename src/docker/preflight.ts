import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ResolvedEnvironment } from "../config/types.js";
import type { RunContext } from "../cli/run-context.js";
import { imageRoot } from "./image.js";
import { runCommand } from "./run-command.js";
import type { ProcessCapture } from "../output/capture.js";

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

export interface PreflightResult {
  dockerVersion?: string;
  daemonVersion?: string;
  registryAuth: boolean;
  registryWarning: boolean;
  captures: ProcessCapture[];
}

export async function preflight(options: {
  resolved: ResolvedEnvironment;
  configPath: string;
  configDir: string;
  repoRoot: string;
  run: RunContext;
  dryRun?: boolean;
}): Promise<PreflightResult> {
  const { resolved, configPath, configDir, repoRoot, run, dryRun } = options;
  const log = run.log;
  const captures: ProcessCapture[] = [];

  if (!run.interactive) {
    log.section("Preflight");
  }

  const versionCmd = "docker version";
  const versionSink = run.coordinator.createSink({
    phase: "PREFLIGHT",
    label: "Docker client/server",
    command: versionCmd,
  });

  const versionResult = await runCommand("docker", ["version"], {
    phase: "PREFLIGHT",
    label: "Docker client/server",
    cwd: configDir,
    dryRun,
    log,
    visibility: run.visibility,
    sink: versionSink,
  });
  if (versionResult.capture) {
    captures.push(versionResult.capture);
  }

  const clientMatch = /Version:\s+(\S+)/.exec(versionResult.stdout);
  const dockerVersion = clientMatch?.[1];

  const infoCmd = "docker info --format {{.ServerVersion}}";
  const infoSink = run.coordinator.createSink({
    phase: "PREFLIGHT",
    label: "Docker daemon",
    command: infoCmd,
  });

  const info = await runCommand("docker", ["info", "--format", "{{.ServerVersion}}"], {
    phase: "PREFLIGHT",
    label: "Docker daemon",
    cwd: configDir,
    dryRun,
    log,
    visibility: run.visibility,
    sink: infoSink,
  });
  if (info.capture) {
    captures.push(info.capture);
  }

  const daemonVersion = info.stdout.trim();

  if (!run.interactive) {
    log.ok("PREFLIGHT", "Docker is available.");
    log.ok("PREFLIGHT", `Docker daemon reachable (server ${daemonVersion}).`);
  }

  const dockerConfig = join(homedir(), ".docker", "config.json");
  const registryLabel = resolved.registry ?? "docker.io";
  const imagePrefix = imageRoot(resolved);
  let registryAuth = false;
  let registryWarning = false;

  if (!existsSync(dockerConfig)) {
    registryWarning = true;
    if (!run.interactive) {
      log.warn("PREFLIGHT", "Docker config not found — push may fail if you are not logged in.", {
        detail: `Expected: ${dockerConfig}`,
      });
    }
  } else {
    try {
      const cfg = JSON.parse(readFileSync(dockerConfig, "utf8")) as {
        auths?: Record<string, unknown>;
      };
      const auths = cfg.auths ?? {};
      if (hasRegistryAuth(auths, resolved.registry)) {
        registryAuth = true;
        if (!run.interactive) {
          log.ok("PREFLIGHT", `Registry credentials found for ${registryLabel}.`);
        }
      } else {
        registryWarning = true;
        if (!run.interactive) {
          log.warn("PREFLIGHT", `No credentials found for registry ${registryLabel}.`, {
            detail: `Push target: ${imagePrefix}`,
            hint: resolved.registry
              ? `Run: docker login ${resolved.registry}`
              : "Run: docker login",
          });
        }
      }
    } catch {
      registryWarning = true;
      if (!run.interactive) {
        log.warn("PREFLIGHT", "Could not parse Docker config — skipping registry auth check.");
      }
    }
  }

  if (!run.interactive) {
    log.ok("PREFLIGHT", `Working directory: ${configDir}`);
    log.ok("PREFLIGHT", `Config file:       ${configPath}`);
    log.ok("PREFLIGHT", `Repository root:   ${repoRoot}`);
  }

  return {
    dockerVersion,
    daemonVersion,
    registryAuth,
    registryWarning,
    captures,
  };
}

export function formatPreflightSummary(result: PreflightResult, dryRun = false): string {
  if (dryRun) {
    return `dry-run · ${result.registryAuth ? "registry auth OK" : "registry auth missing"}`;
  }

  const parts: string[] = [];
  if (result.dockerVersion) {
    parts.push(`Docker ${result.dockerVersion}`);
  }
  if (result.daemonVersion) {
    parts.push(`daemon ${result.daemonVersion}`);
  } else {
    parts.push("daemon OK");
  }
  parts.push(result.registryAuth ? "registry auth OK" : "registry auth missing");
  return parts.join(" · ");
}
