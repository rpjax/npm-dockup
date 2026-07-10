import { join } from "node:path";
import type { ContainerConfig, NameValueEntry, ResolvedEnvironment } from "../config/types.js";
import { resolveBuildArgs, resolveEnvironmentEnv } from "../env/resolve.js";
import type { Logger } from "../logger/index.js";
import { hasBuildContext, imageReference } from "./image.js";
import { runCommand } from "./run-command.js";

export async function buildContainer(options: {
  resolved: ResolvedEnvironment;
  container: ContainerConfig;
  repoRoot: string;
  configDir: string;
  environmentEnv: NameValueEntry[];
  log: Logger;
  dryRun?: boolean;
}): Promise<string | null> {
  const { resolved, container, repoRoot, configDir, environmentEnv, log, dryRun } = options;

  if (!hasBuildContext(container)) {
    log.info("BUILD", `Skipping "${container.id}" — no build context.`);
    return null;
  }

  const context = join(repoRoot, container.context!);
  const dockerfileName = container.dockerfile ?? "Dockerfile";
  const dockerfile = join(context, dockerfileName);
  const tag = imageReference(resolved, container, resolved.tag);
  const envSymbols = resolveEnvironmentEnv(environmentEnv);
  const buildArgs = resolveBuildArgs(container.buildArgs ?? [], envSymbols);

  log.section(`Build: ${container.id}`);
  log.info("BUILD", `Image:   ${tag}`);
  log.info("BUILD", `Context: ${context}`);
  if (buildArgs.length) {
    log.info("BUILD", `Build args: ${buildArgs.map((a) => a.name).join(", ")}`);
  }

  const dockerCliArgs = [
    "build",
    ...buildArgs.flatMap((arg) => ["--build-arg", `${arg.name}=${arg.value}`]),
    "-t",
    tag,
    "-f",
    dockerfile,
    context,
  ];

  await runCommand("docker", dockerCliArgs, {
    phase: "BUILD",
    label: `docker build ${container.id}`,
    cwd: configDir,
    dryRun,
    log,
  });

  log.ok("BUILD", `Built ${tag}`);
  return tag;
}

export async function pushContainer(options: {
  resolved: ResolvedEnvironment;
  container: ContainerConfig;
  configDir: string;
  log: Logger;
  dryRun?: boolean;
}): Promise<string | null> {
  const { resolved, container, configDir, log, dryRun } = options;

  if (!hasBuildContext(container)) {
    return null;
  }

  const tag = imageReference(resolved, container, resolved.tag);
  log.section(`Push: ${container.id}`);
  log.info("PUSH", `Image: ${tag}`);

  await runCommand("docker", ["push", tag], {
    phase: "PUSH",
    label: `docker push ${container.id}`,
    cwd: configDir,
    dryRun,
    log,
  });

  log.ok("PUSH", `Pushed ${tag}`);
  return tag;
}
