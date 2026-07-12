import { EXIT } from "../exit-codes.js";
import type { ValidateOptions } from "../options.js";
import { loadValidatedConfig } from "../context.js";
import { validateConfig } from "../../config/validate.js";
import type { RunContext } from "../run-context.js";
import {
  printNextStepsBlock,
  printValidateReport,
  resolveValidateNextSteps,
} from "../../ux/index.js";

export function runValidate(options: ValidateOptions, run: RunContext): number {
  const { configPath, repoRoot, config, configDir } = loadValidatedConfig(options);
  const envNames = validateConfig(config, configPath, repoRoot, run.log, options.env);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          command: "validate",
          config: configPath,
          configDir,
          repoRoot,
          environments: envNames,
          report: {
            config: configPath,
            configDir,
            repoRoot,
            environments: envNames,
          },
          nextSteps: resolveValidateNextSteps(envNames),
        },
        null,
        2,
      ),
    );
  } else if (!options.quiet) {
    printValidateReport({
      configPath,
      configDir,
      repoRoot,
      environments: envNames,
    });
    printNextStepsBlock(resolveValidateNextSteps(envNames));
  }

  return EXIT.OK;
}
