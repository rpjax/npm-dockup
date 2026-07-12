import pc from "picocolors";
import type { DeployOptions } from "../cli/options.js";
import type { DeployResult } from "../cli/deploy-tasks.js";

export function resolveDeployNextSteps(
  options: DeployOptions,
  result: DeployResult,
): string[] {
  const composePath = result.artifacts[0];
  const envPath = result.artifacts[1];
  const steps: string[] = [];

  if (options.dryRun) {
    steps.push("Remove --dry-run to execute the deploy pipeline.");
    return steps;
  }

  if (options.generateOnly || options.skipBuild || options.skipPush) {
    if (composePath && envPath) {
      steps.push(`Review ${relativePath(composePath)}`);
      steps.push(`Run a full deploy: dockup deploy --env ${options.env}`);
    }
    return steps;
  }

  if (composePath && envPath) {
    steps.push(
      `docker compose -f ${relativePath(composePath)} --env-file ${relativePath(envPath)} up -d`,
    );
    steps.push(
      `Copy out/${options.env}/ to your VPS, then: docker compose pull && docker compose up -d`,
    );
  }

  if (result.registryWarning) {
    steps.unshift(`docker login ${result.registry ?? "docker.io"}`);
  }

  return steps;
}

export function resolveValidateNextSteps(envNames: string[]): string[] {
  const env = envNames[0] ?? "prod";
  return [
    `dockup deploy --env ${env} --generate-only`,
    `dockup deploy --env ${env}`,
  ];
}

export function resolveInitNextSteps(configPath: string): string[] {
  const basename = configPath.split(/[/\\]/).pop() ?? configPath;
  return [
    `Edit ${basename} (namespace, containers, env)`,
    "dockup validate",
    "dockup deploy --env dev --generate-only",
  ];
}

function relativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function printNextSteps(steps: string[], color = true): void {
  if (steps.length === 0) {
    return;
  }
  const title = "── Next steps ──";
  console.log("");
  console.log(color ? pc.bold(title) : title);
  console.log("");
  for (const step of steps) {
    console.log(`  → ${step}`);
  }
  console.log("");
}
