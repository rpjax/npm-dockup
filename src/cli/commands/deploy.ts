import { EXIT } from "../exit-codes.js";
import type { DeployOptions } from "../options.js";
import type { RunContext } from "../run-context.js";
import { runDeployTasks } from "../deploy-tasks.js";
import {
  buildDeployJsonReport,
  printDeployReport,
  printNextStepsBlock,
  resolveDeployNextSteps,
} from "../../ux/index.js";

export async function runDeploy(
  options: DeployOptions,
  run: RunContext,
  _meta: { version: string; configPath: string },
): Promise<number> {
  const startedAt = Date.now();
  const result = await runDeployTasks(options, run);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (options.json) {
    const payload: Record<string, unknown> = {
      ok: true,
      command: "deploy",
      env: options.env,
      namespace: result.namespace,
      registry: result.registry ?? null,
      tag: result.tag,
      built: result.built,
      pushed: result.pushed,
      artifacts: result.artifacts,
      elapsedSec: Number(elapsedSec),
      report: buildDeployJsonReport(options, result, Number(elapsedSec)),
      nextSteps: resolveDeployNextSteps(options, result),
    };
    if (options.withLogs) {
      payload.logs = { processes: result.processes };
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (!options.quiet) {
    printDeployReport({ options, result, elapsedSec });
    printNextStepsBlock(resolveDeployNextSteps(options, result));
  }

  return EXIT.OK;
}
