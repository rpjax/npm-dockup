import { join } from "node:path";
import type { ContainerConfig, NameValueEntry, ResolvedEnvironment } from "../config/types.js";
import { resolveBuildArgs, resolveEnvironmentEnv } from "../env/resolve.js";
import type { RunContext } from "../cli/run-context.js";
import { imageReference, shouldBuild, shouldPush } from "./image.js";
import { runCommand } from "./run-command.js";
import type { ProcessCapture } from "../output/capture.js";

export function buildDockerCliArgs(options: {
  container: ContainerConfig;
  tag: string;
  dockerfile: string;
  context: string;
  buildArgs: Array<{ name: string; value: string }>;
  plainProgress?: boolean;
}): string[] {
  const { container, tag, dockerfile, context, buildArgs, plainProgress } = options;

  return [
    "build",
    ...(plainProgress ? ["--progress=plain"] : []),
    ...buildArgs.flatMap((arg) => ["--build-arg", `${arg.name}=${arg.value}`]),
    ...(container.platform ? ["--platform", container.platform] : []),
    ...(container.buildTarget ? ["--target", container.buildTarget] : []),
    "-t",
    tag,
    "-f",
    dockerfile,
    context,
  ];
}

export interface BuildPushResult {
  tag: string | null;
  capture?: ProcessCapture;
}

export async function buildContainer(options: {
  resolved: ResolvedEnvironment;
  container: ContainerConfig;
  repoRoot: string;
  configDir: string;
  environmentEnv: NameValueEntry[];
  run: RunContext;
  dryRun?: boolean;
}): Promise<BuildPushResult> {
  const { resolved, container, repoRoot, configDir, environmentEnv, run, dryRun } = options;
  const log = run.log;

  if (!shouldBuild(container)) {
    if (container.imageRef?.trim()) {
      log.info("BUILD", `Skipping "${container.id}" — pull-only imageRef.`);
    } else {
      log.info("BUILD", `Skipping "${container.id}" — no build context.`);
    }
    return { tag: null };
  }

  const context = join(repoRoot, container.context!);
  const dockerfileName = container.dockerfile ?? "Dockerfile";
  const dockerfile = join(context, dockerfileName);
  const tag = imageReference(resolved, container, resolved.tag);
  const envSymbols = resolveEnvironmentEnv(environmentEnv);
  const buildArgs = resolveBuildArgs(container.buildArgs ?? [], envSymbols);

  if (!run.interactive) {
    log.section(`Build: ${container.id}`);
    log.info("BUILD", `Image:   ${tag}`);
    log.info("BUILD", `Context: ${context}`);
    if (buildArgs.length) {
      log.info("BUILD", `Build args: ${buildArgs.map((a) => a.name).join(", ")}`);
    }
  }

  const dockerCliArgs = buildDockerCliArgs({
    container,
    tag,
    dockerfile,
    context,
    buildArgs,
    plainProgress: run.visibility === "peek" || run.visibility === "stream",
  });

  const cmdLine = ["docker", ...dockerCliArgs].join(" ");
  const sink = run.coordinator.createSink({
    phase: "BUILD",
    label: `docker build ${container.id}`,
    command: cmdLine,
  });

  const result = await runCommand("docker", dockerCliArgs, {
    phase: "BUILD",
    label: `docker build ${container.id}`,
    cwd: configDir,
    dryRun,
    log,
    visibility: run.visibility,
    sink,
  });

  if (!run.interactive) {
    log.ok("BUILD", `Built ${tag}`);
  }

  return { tag, capture: result.capture };
}

export async function pushContainer(options: {
  resolved: ResolvedEnvironment;
  container: ContainerConfig;
  configDir: string;
  run: RunContext;
  dryRun?: boolean;
}): Promise<BuildPushResult> {
  const { resolved, container, configDir, run, dryRun } = options;
  const log = run.log;

  if (!shouldPush(container)) {
    return { tag: null };
  }

  const tag = imageReference(resolved, container, resolved.tag);

  if (!run.interactive) {
    log.section(`Push: ${container.id}`);
    log.info("PUSH", `Image: ${tag}`);
  }

  const cmdLine = `docker push ${tag}`;
  const sink = run.coordinator.createSink({
    phase: "PUSH",
    label: `docker push ${container.id}`,
    command: cmdLine,
    isPush: true,
  });

  const result = await runCommand("docker", ["push", tag], {
    phase: "PUSH",
    label: `docker push ${container.id}`,
    cwd: configDir,
    dryRun,
    log,
    visibility: run.visibility,
    sink,
    isPush: true,
  });

  if (!run.interactive) {
    log.ok("PUSH", `Pushed ${tag}`);
  }

  return { tag, capture: result.capture };
}
