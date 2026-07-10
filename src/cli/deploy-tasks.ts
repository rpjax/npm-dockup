import { Listr } from "listr2";
import { validateConfig, getEnvironment } from "../config/validate.js";
import { fail } from "../errors/index.js";
import type { ContainerConfig } from "../config/types.js";
import type { Logger } from "../logger/index.js";
import { preflight } from "../docker/preflight.js";
import { buildContainer, pushContainer } from "../docker/build.js";
import { shouldBuild } from "../docker/image.js";
import { generateComposeArtifacts, validateComposeArtifacts } from "../compose/generate.js";
import type { DeployOptions } from "./options.js";
import { useListr } from "./options.js";
import { loadValidatedConfig } from "./context.js";

export interface DeployResult {
  built: string[];
  pushed: string[];
  artifacts: string[];
  namespace: string;
  tag: string;
  registry?: string;
}

export async function runDeployTasks(options: DeployOptions, log: Logger): Promise<DeployResult> {
  const { configPath, repoRoot, config, configDir } = loadValidatedConfig(options);
  const resolved = getEnvironment(config, options.env);

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
    namespace: resolved.namespace,
    tag: resolved.tag,
    registry: resolved.registry,
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

    await preflight({
      resolved,
      configPath,
      configDir,
      repoRoot,
      log,
      dryRun: options.dryRun,
    });

    if (!options.skipBuild) {
      for (const container of buildTargets) {
        const builtTag = await buildContainer({
          resolved,
          container,
          repoRoot,
          configDir,
          environmentEnv: resolved.env,
          log,
          dryRun: options.dryRun,
        });
        if (builtTag) {
          state.built.push(container.id);
        }
      }
    } else {
      log.info("BUILD", "Skipping build phase (--skip-build).");
    }

    if (!options.skipPush) {
      for (const container of buildTargets) {
        const pushedTag = await pushContainer({
          resolved,
          container,
          configDir,
          log,
          dryRun: options.dryRun,
        });
        if (pushedTag) {
          state.pushed.push(container.id);
        }
      }
    } else {
      log.info("PUSH", "Skipping push phase (--skip-push).");
    }

    const artifacts = generateComposeArtifacts({
      config,
      envKey: options.env,
      configDir,
      log,
    });

    await validateComposeArtifacts({
      composePath: artifacts.composePath,
      envPath: artifacts.envPath,
      configDir,
      log,
      dryRun: options.dryRun,
    });

    state.artifacts = [artifacts.composePath, artifacts.envPath];
  };

  if (!useListr(options)) {
    await runLinear();
    return state;
  }

  const listrLog = log;

  const tasks = new Listr(
    [
      {
        title: "Config",
        task: async () => {
          validateConfig(config, configPath, repoRoot, undefined, options.env);
        },
      },
      {
        title: "Preflight",
        task: async () => {
          await preflight({
            resolved,
            configPath,
            configDir,
            repoRoot,
            log: listrLog,
            dryRun: options.dryRun,
          });
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
                task: async () => {
                  const builtTag = await buildContainer({
                    resolved,
                    container,
                    repoRoot,
                    configDir,
                    environmentEnv: resolved.env,
                    log: listrLog,
                    dryRun: options.dryRun,
                  });
                  if (builtTag) {
                    state.built.push(container.id);
                  }
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
                task: async () => {
                  const pushedTag = await pushContainer({
                    resolved,
                    container,
                    configDir,
                    log: listrLog,
                    dryRun: options.dryRun,
                  });
                  if (pushedTag) {
                    state.pushed.push(container.id);
                  }
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
            log: listrLog,
          });
          state.artifacts = [artifacts.composePath, artifacts.envPath];
        },
      },
      {
        title: "Validate compose",
        task: async () => {
          const composePath = state.artifacts[0];
          const envPath = state.artifacts[1];
          if (!composePath || !envPath) {
            fail("GENERATE", "Compose artifacts were not generated.");
          }
          await validateComposeArtifacts({
            composePath,
            envPath,
            configDir,
            log: listrLog,
            dryRun: options.dryRun,
          });
        },
      },
    ],
    { concurrent: false },
  );

  await tasks.run();
  return state;
}
