import { Listr } from "listr2";
import { validateConfig, getEnvironment } from "../config/validate.js";
import { fail } from "../errors/index.js";
import type { ContainerConfig } from "../config/types.js";
import { preflight, formatPreflightSummary } from "../docker/preflight.js";
import { buildContainer, pushContainer } from "../docker/build.js";
import { shouldBuild } from "../docker/image.js";
import { generateComposeArtifacts, validateComposeArtifacts } from "../compose/generate.js";
import type { DeployOptions } from "./options.js";
import { useListr } from "./options.js";
import { loadValidatedConfig } from "./context.js";
import type { RunContext } from "./run-context.js";
import type { ProcessCapture } from "../output/capture.js";

export interface DeployResult {
  built: string[];
  pushed: string[];
  artifacts: string[];
  images: string[];
  namespace: string;
  tag: string;
  registry?: string;
  registryWarning: boolean;
  processes: ProcessCapture[];
  containerCount: number;
}

function pushCapture(state: DeployResult, capture?: ProcessCapture): void {
  if (capture) {
    state.processes.push(capture);
  }
}

export async function runDeployTasks(
  options: DeployOptions,
  run: RunContext,
): Promise<DeployResult> {
  const { configPath, repoRoot, config, configDir } = loadValidatedConfig(options);
  const resolved = getEnvironment(config, options.env);
  const log = run.log;

  let buildTargets: ContainerConfig[] = resolved.containers;
  if (options.only) {
    buildTargets = resolved.containers.filter((container) => container.id === options.only);
    if (buildTargets.length === 0) {
      const available = resolved.containers.map((c) => c.id).join(", ");
      fail("CLI", `No container with id "${options.only}" in "${options.env}".`, {
        detail: `Available container ids: ${available}`,
      });
    }
  }

  const state: DeployResult = {
    built: [],
    pushed: [],
    artifacts: [],
    images: [],
    namespace: resolved.namespace,
    tag: resolved.tag,
    registry: resolved.registry,
    registryWarning: false,
    processes: [],
    containerCount: buildTargets.length,
  };

  const runLinear = async (): Promise<void> => {
    validateConfig(config, configPath, repoRoot, log, options.env);

    log.info("INIT", `Environment: ${options.env}`);
    log.info("INIT", `Namespace:   ${resolved.namespace}`);
    log.info("INIT", `Image tag:   ${resolved.tag}`);
    if (resolved.registry) {
      log.info("INIT", `Registry:    ${resolved.registry}`);
    }
    log.info("INIT", `Targets:     ${buildTargets.map((c) => c.id).join(", ")}`);

    const preflightResult = await preflight({
      resolved,
      configPath,
      configDir,
      repoRoot,
      run,
      dryRun: options.dryRun,
    });
    state.registryWarning = preflightResult.registryWarning;
    state.processes.push(...preflightResult.captures);

    if (!options.skipBuild) {
      for (const container of buildTargets) {
        const built = await buildContainer({
          resolved,
          container,
          repoRoot,
          configDir,
          environmentEnv: resolved.env,
          run,
          dryRun: options.dryRun,
        });
        if (built.tag) {
          state.built.push(container.id);
          state.images.push(built.tag);
        }
        pushCapture(state, built.capture);
      }
    } else {
      log.info("BUILD", "Skipping build phase (--skip-build).");
    }

    if (!options.skipPush) {
      for (const container of buildTargets) {
        const pushed = await pushContainer({
          resolved,
          container,
          configDir,
          run,
          dryRun: options.dryRun,
        });
        if (pushed.tag) {
          state.pushed.push(container.id);
          if (!state.images.includes(pushed.tag)) {
            state.images.push(pushed.tag);
          }
        }
        pushCapture(state, pushed.capture);
      }
    } else {
      log.info("PUSH", "Skipping push phase (--skip-push).");
    }

    const artifacts = generateComposeArtifacts({
      config,
      envKey: options.env,
      configDir,
      run,
    });

    const validateCapture = await validateComposeArtifacts({
      composePath: artifacts.composePath,
      envPath: artifacts.envPath,
      configDir,
      run,
      dryRun: options.dryRun,
    });
    pushCapture(state, validateCapture);

    state.artifacts = [artifacts.composePath, artifacts.envPath];
  };

  if (!useListr(options)) {
    await runLinear();
    return state;
  }

  let activePeekHandler: ((text: string) => void) | null = null;
  run.coordinator.onPeek((sink) => {
    activePeekHandler?.(sink.peekText);
  });

  const tasks = new Listr(
    [
      {
        title: "Config",
        task: async (_ctx, task) => {
          validateConfig(config, configPath, repoRoot, undefined, options.env);
          task.title = `Config (${buildTargets.length} containers · ${resolved.namespace})`;
        },
      },
      {
        title: "Preflight",
        task: async (_ctx, task) => {
          activePeekHandler = (text) => {
            task.output = text;
          };
          const preflightResult = await preflight({
            resolved,
            configPath,
            configDir,
            repoRoot,
            run,
            dryRun: options.dryRun,
          });
          state.registryWarning = preflightResult.registryWarning;
          state.processes.push(...preflightResult.captures);
          activePeekHandler = null;
          task.title = `Preflight (${formatPreflightSummary(preflightResult, options.dryRun)})`;
          if (preflightResult.registryWarning) {
            task.title += " ⚠";
          }
        },
      },
      {
        title: "Build",
        enabled: () => !options.skipBuild && buildTargets.some((c) => shouldBuild(c)),
        task: (_ctx, task) =>
          task.newListr(
            buildTargets
              .filter((c) => shouldBuild(c))
              .map((container) => ({
                title: container.id,
                task: async (_c, subtask) => {
                  activePeekHandler = (text) => {
                    subtask.output = text;
                  };
                  const built = await buildContainer({
                    resolved,
                    container,
                    repoRoot,
                    configDir,
                    environmentEnv: resolved.env,
                    run,
                    dryRun: options.dryRun,
                  });
                  activePeekHandler = null;
                  if (built.tag) {
                    state.built.push(container.id);
                    state.images.push(built.tag);
                    subtask.title = `${container.id} (${built.tag.split(":").pop()})`;
                  }
                  pushCapture(state, built.capture);
                },
              })),
            { concurrent: false },
          ),
      },
      {
        title: "Push",
        enabled: () => !options.skipPush && buildTargets.some((c) => shouldBuild(c)),
        task: (_ctx, task) =>
          task.newListr(
            buildTargets
              .filter((c) => shouldBuild(c))
              .map((container) => ({
                title: container.id,
                task: async (_c, subtask) => {
                  activePeekHandler = (text) => {
                    subtask.output = text;
                  };
                  const pushed = await pushContainer({
                    resolved,
                    container,
                    configDir,
                    run,
                    dryRun: options.dryRun,
                  });
                  activePeekHandler = null;
                  if (pushed.tag) {
                    state.pushed.push(container.id);
                    if (!state.images.includes(pushed.tag)) {
                      state.images.push(pushed.tag);
                    }
                  }
                  pushCapture(state, pushed.capture);
                },
              })),
            { concurrent: false },
          ),
      },
      {
        title: "Generate",
        task: async () => {
          const artifacts = generateComposeArtifacts({
            config,
            envKey: options.env,
            configDir,
            run,
          });
          state.artifacts = [artifacts.composePath, artifacts.envPath];
        },
      },
      {
        title: "Validate compose",
        task: async (_ctx, task) => {
          const composePath = state.artifacts[0];
          const envPath = state.artifacts[1];
          if (!composePath || !envPath) {
            fail("GENERATE", "Compose artifacts were not generated.");
          }
          activePeekHandler = (text) => {
            task.output = text;
          };
          const validateCapture = await validateComposeArtifacts({
            composePath,
            envPath,
            configDir,
            run,
            dryRun: options.dryRun,
          });
          activePeekHandler = null;
          pushCapture(state, validateCapture);
        },
      },
    ],
    { concurrent: false },
  );

  await tasks.run();
  return state;
}
