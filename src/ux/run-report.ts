import pc from "picocolors";
import type { DeployResult } from "../cli/deploy-tasks.js";
import type { DeployOptions } from "../cli/options.js";
import { formatIndentedList, formatRow } from "./align.js";
import { printSection } from "./session.js";

export interface DeployReportContext {
  options: DeployOptions;
  result: DeployResult;
  elapsedSec: string;
}

export function printDeployReport(context: DeployReportContext): void {
  const { options, result, elapsedSec } = context;
  const useColor = defaultColor();
  const c = (text: string, style: (v: string) => string) => (useColor ? style(text) : text);

  printSection("Run report", useColor);

  if (options.dryRun) {
    console.log(c("  ⚠  Dry run — no images were built or pushed", pc.yellow));
    console.log("");
  }

  console.log(c(`  ✔  Deploy completed in ${elapsedSec}s`, pc.green));
  console.log("");

  console.log(formatRow("Environment", options.env));
  console.log(formatRow("Namespace", result.namespace));
  if (result.registry) {
    console.log(formatRow("Registry", result.registry));
  }
  console.log(formatRow("Image tag", result.tag));
  console.log("");

  if (options.skipBuild) {
    console.log(formatRow("Built", "skipped"));
  } else if (result.built.length) {
    console.log(formatRow(`Built (${result.built.length})`, result.built.join(", ")));
  }

  if (options.skipPush) {
    console.log(formatRow("Pushed", "skipped"));
  } else if (result.pushed.length) {
    console.log(formatRow(`Pushed (${result.pushed.length})`, result.pushed.join(", ")));
  }

  if (result.artifacts.length) {
    console.log("");
    console.log("  Artifacts");
    for (const line of formatIndentedList(result.artifacts.map(normalizePath))) {
      console.log(line);
    }
  }

  if (result.images.length) {
    console.log("");
    console.log("  Images");
    for (const line of formatIndentedList(result.images)) {
      console.log(line);
    }
  }

  console.log("");
}

export interface ValidateReportContext {
  configPath: string;
  configDir: string;
  repoRoot: string;
  environments: string[];
}

export function printValidateReport(context: ValidateReportContext): void {
  const useColor = defaultColor();
  const c = (text: string, style: (v: string) => string) => (useColor ? style(text) : text);

  printSection("Run report", useColor);
  console.log(c("  ✔  Configuration valid", pc.green));
  console.log("");
  console.log(formatRow("Config", normalizePath(context.configPath)));
  console.log(formatRow("Environments", context.environments.join(", ")));
  console.log(formatRow("Repo root", normalizePath(context.repoRoot)));
  console.log("");
  console.log("  Checked");
  for (const line of formatIndentedList([
    "JSON Schema",
    "Semantic rules",
    `Symbol resolution (${context.environments.join(", ")})`,
  ])) {
    console.log(line);
  }
  console.log("");
}

export interface InitReportContext {
  path: string;
}

export function printInitReport(context: InitReportContext): void {
  const useColor = defaultColor();
  const c = (text: string, style: (v: string) => string) => (useColor ? style(text) : text);

  printSection("Run report", useColor);
  console.log(c("  ✔  Config created", pc.green));
  console.log("");
  console.log(formatRow("File", normalizePath(context.path)));
  console.log(formatRow("Template", "minimal"));
  console.log("");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function defaultColor(): boolean {
  return pc.isColorSupported && process.stdout.isTTY === true && !process.env.NO_COLOR;
}

export function buildDeployJsonReport(
  options: DeployOptions,
  result: DeployResult,
  elapsedSec: number,
) {
  return {
    elapsedSec,
    environment: options.env,
    namespace: result.namespace,
    registry: result.registry ?? null,
    tag: result.tag,
    built: result.built,
    pushed: result.pushed,
    artifacts: result.artifacts,
    images: result.images,
    skipped: {
      build: options.skipBuild,
      push: options.skipPush,
      generateOnly: options.generateOnly,
      dryRun: options.dryRun,
    },
  };
}
