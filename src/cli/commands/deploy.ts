import { EXIT } from "../exit-codes.js";
import type { DeployOptions } from "../options.js";
import { useListr } from "../options.js";
import type { Logger } from "../../logger/index.js";
import { runDeployTasks } from "../deploy-tasks.js";

export async function runDeploy(options: DeployOptions, log: Logger): Promise<number> {
  const startedAt = Date.now();
  const result = await runDeployTasks(options, log);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
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
        },
        null,
        2,
      ),
    );
  } else if (useListr(options)) {
    log.deployComplete({
      env: options.env,
      artifacts: result.artifacts,
      elapsedSec,
    });
  } else {
    log.summary({
      env: options.env,
      namespace: result.namespace,
      tag: result.tag,
      built: result.built,
      pushed: result.pushed,
      artifacts: result.artifacts,
      elapsedSec,
    });
  }

  return EXIT.OK;
}
