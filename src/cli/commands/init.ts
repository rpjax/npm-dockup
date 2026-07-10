import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT } from "../exit-codes.js";
import type { InitOptions } from "../options.js";
import { CONFIG_SUFFIX } from "../../config/discovery.js";
import { fail } from "../../errors/index.js";
import type { Logger } from "../../logger/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function runInit(options: InitOptions, log: Logger): number {
  const targetName = options.name.endsWith(CONFIG_SUFFIX)
    ? options.name
    : `${options.name}${CONFIG_SUFFIX}`;
  const targetPath = resolve(process.cwd(), targetName);

  if (existsSync(targetPath)) {
    fail("CLI", `Config already exists: ${targetPath}`, {
      hint: "Choose a different name or remove the existing file.",
    });
  }

  const templatePath = join(packageRoot, "examples", "minimal.dockup.json");
  copyFileSync(templatePath, targetPath);

  if (options.json) {
    console.log(JSON.stringify({ ok: true, command: "init", path: targetPath }, null, 2));
  } else if (!options.quiet) {
    log.ok("INIT", `Created ${targetPath}`);
  }

  return EXIT.OK;
}
