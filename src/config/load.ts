import { readFileSync } from "node:fs";
import { fail } from "../errors/index.js";
import type { DockupConfig } from "./types.js";

export function loadConfig(configPath: string): DockupConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch (err) {
    fail("CONFIG", `Unable to read ${configPath}.`, { cause: err });
  }

  try {
    return JSON.parse(raw!) as DockupConfig;
  } catch (err) {
    fail("CONFIG", `${configPath} is not valid JSON.`, {
      cause: err,
      hint: "Validate the file with a JSON linter or dockup validate.",
    });
  }
}
