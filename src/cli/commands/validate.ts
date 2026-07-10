import { EXIT } from "../exit-codes.js";
import type { ValidateOptions } from "../options.js";
import { loadValidatedConfig } from "../context.js";
import { validateConfig } from "../../config/validate.js";
import type { Logger } from "../../logger/index.js";

export function runValidate(options: ValidateOptions, log: Logger): number {
  const { configPath, repoRoot, config, configDir } = loadValidatedConfig(options);
  const envNames = validateConfig(config, configPath, repoRoot, log, options.env);

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
        },
        null,
        2,
      ),
    );
  } else if (!options.quiet) {
    log.ok("VALIDATE", "Configuration is valid.");
  }

  return EXIT.OK;
}
