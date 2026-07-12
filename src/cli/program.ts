import { Command, Option } from "commander";
import { basename } from "node:path";
import { DockupError, ResolveError } from "../errors/index.js";
import { Logger } from "../logger/index.js";
import { EXIT, exitCodeForPhase, type ExitCode } from "./exit-codes.js";
import {
  deployFromCommander,
  initFromCommander,
  validateFromCommander,
  type CommanderDeployOpts,
  type CommanderGlobalOpts,
  type CommanderValidateOpts,
} from "./options.js";
import { runDeploy } from "./commands/deploy.js";
import { runValidate } from "./commands/validate.js";
import { runInit } from "./commands/init.js";
import { getVersion } from "../version.js";
import { createRunContext, type RunContext } from "./run-context.js";
import { loadValidatedConfig } from "./context.js";
import { printErrorPanel } from "../ux/error-panel.js";
import { printSessionHeader } from "../ux/session.js";

export function readPackageVersion(): string {
  return getVersion();
}

function addGlobalOptions(command: Command): Command {
  return command
    .option("-c, --config <path>", "path to *.dockup.json config file")
    .option("-r, --root <path>", "repository root for build contexts", ".")
    .option("--json", "structured JSON output")
    .option("-q, --quiet", "errors and warnings only")
    .option("-v, --verbose", "debug logging")
    .addOption(new Option("--stream-logs", "stream full subprocess output in framed panels"))
    .addOption(new Option("--with-logs", "include captured subprocess logs in JSON output"));
}

function addOutputOptions(command: Command): Command {
  return command
    .option("--json", "structured JSON output")
    .option("-q, --quiet", "errors and warnings only")
    .option("-v, --verbose", "debug logging")
    .addOption(new Option("--stream-logs", "stream full subprocess output in framed panels"))
    .addOption(new Option("--with-logs", "include captured subprocess logs in JSON output"));
}

export function mergeCommanderGlobal(
  root: CommanderGlobalOpts,
  local: CommanderGlobalOpts,
): CommanderGlobalOpts {
  return {
    config: local.config ?? root.config,
    root: local.root ?? root.root,
    json: Boolean(local.json || root.json),
    quiet: Boolean(local.quiet || root.quiet),
    verbose: Boolean(local.verbose || root.verbose),
    streamLogs: Boolean(local.streamLogs || root.streamLogs),
    withLogs: Boolean(local.withLogs || root.withLogs),
  };
}

function printJsonError(err: DockupError | ResolveError, startedAt: number): void {
  const elapsedSec = Number(((Date.now() - startedAt) / 1000).toFixed(1));
  const payload =
    err instanceof DockupError
      ? {
          ok: false,
          phase: err.phase,
          message: err.message,
          hint: err.hint ?? null,
          detail: err.detail ?? null,
          cause: err.causeText ?? null,
          elapsedSec,
          exitCode: exitCodeForPhase(err.phase),
        }
      : {
          ok: false,
          phase: "CONFIG",
          message: err.message,
          hint: null,
          detail: null,
          cause: null,
          elapsedSec,
          exitCode: EXIT.CLI_CONFIG,
        };
  console.log(JSON.stringify(payload, null, 2));
}

export function handleFatal(err: unknown, run: RunContext, json: boolean): ExitCode {
  if (err instanceof DockupError) {
    if (json) {
      printJsonError(err, run.log.startedAt);
    } else {
      printErrorPanel({ err, startedAt: run.log.startedAt });
    }
    return exitCodeForPhase(err.phase);
  }

  if (err instanceof ResolveError) {
    if (json) {
      printJsonError(err, run.log.startedAt);
    } else {
      printErrorPanel({
        err: new DockupError("CONFIG", err.message),
        startedAt: run.log.startedAt,
      });
    }
    return EXIT.CLI_CONFIG;
  }

  const message = err instanceof Error ? err.message : String(err);
  const runtimeErr = new DockupError("RUNTIME", "Unexpected error.", {
    detail:
      err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : undefined,
    cause: message,
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          phase: "RUNTIME",
          message,
          elapsedSec: Number(((Date.now() - run.log.startedAt) / 1000).toFixed(1)),
          exitCode: EXIT.RUNTIME,
        },
        null,
        2,
      ),
    );
  } else {
    printErrorPanel({ err: runtimeErr, startedAt: run.log.startedAt });
  }
  return EXIT.RUNTIME;
}

function createLogger(global: CommanderGlobalOpts, interactive = false): Logger {
  return new Logger({
    json: Boolean(global.json),
    quiet: Boolean(global.quiet),
    verbose: Boolean(global.verbose),
    interactive,
  });
}

interface AppRunContext {
  global: CommanderGlobalOpts;
  run: RunContext;
}

function createAppRunContext(): AppRunContext {
  const global: CommanderGlobalOpts = {
    json: false,
    quiet: false,
    streamLogs: false,
    withLogs: false,
  };
  const log = createLogger(global, false);
  return {
    global: {},
    run: createRunContext(
      { json: false, quiet: false, streamLogs: false, withLogs: false },
      log,
      false,
    ),
  };
}

function deployHeaderFlags(opts: CommanderDeployOpts): string[] {
  const flags: string[] = [];
  if (opts.generateOnly) flags.push("--generate-only");
  if (opts.dryRun) flags.push("--dry-run");
  if (opts.only) flags.push(`--only ${opts.only}`);
  if (opts.streamLogs) flags.push("--stream-logs");
  return flags;
}

function printHumanHeader(
  run: RunContext,
  version: string,
  command: string,
  extra?: { env?: string; configBasename?: string; flags?: string[] },
): void {
  if (run.log.isJson || run.log.isQuiet) {
    return;
  }
  printSessionHeader({
    version,
    command,
    env: extra?.env,
    configBasename: extra?.configBasename,
    flags: extra?.flags,
  });
}

export function createProgram(appContext: AppRunContext = createAppRunContext()): Command {
  const program = addGlobalOptions(
    new Command()
      .name("dockup")
      .description("Docker deploy CLI — build, push, and generate compose artifacts")
      .version(readPackageVersion(), "-V, --version", "print version")
      .enablePositionalOptions(),
  );

  program.hook("preAction", (_thisCommand, actionCommand) => {
    appContext.global = mergeCommanderGlobal(
      program.opts() as CommanderGlobalOpts,
      actionCommand.opts() as CommanderGlobalOpts,
    );
    const interactive =
      actionCommand.name() === "deploy" &&
      !appContext.global.json &&
      !appContext.global.quiet &&
      !appContext.global.streamLogs;
    const log = createLogger(appContext.global, interactive);
    appContext.run = createRunContext(
      {
        json: Boolean(appContext.global.json),
        quiet: Boolean(appContext.global.quiet),
        streamLogs: Boolean(appContext.global.streamLogs),
        withLogs: Boolean(appContext.global.withLogs),
      },
      log,
      interactive,
    );
  });

  addGlobalOptions(
    program
      .command("deploy")
      .description("build, push, and generate compose artifacts for an environment")
      .requiredOption("-e, --env <name>", "environment key from *.dockup.json")
      .option("--only <id>", "build/push a single container id")
      .addOption(new Option("--skip-build", "skip docker build phase"))
      .addOption(new Option("--skip-push", "skip docker push phase"))
      .addOption(new Option("--generate-only", "generate compose artifacts only"))
      .addOption(new Option("--dry-run", "log docker commands without executing")),
  ).action(async (localOpts: CommanderDeployOpts) => {
    const global = appContext.global;
    const options = deployFromCommander({ ...localOpts, ...global });
    const run = appContext.run;
    const version = readPackageVersion();

    let configPath: string | undefined;
    try {
      configPath = loadValidatedConfig(options).configPath;
    } catch {
      // validation error handled in runDeploy
    }

    printHumanHeader(run, version, "deploy", {
      env: options.env,
      configBasename: configPath ? basename(configPath) : undefined,
      flags: deployHeaderFlags({ ...localOpts, ...global }),
    });

    try {
      await runDeploy(options, run, { version, configPath: configPath ?? "" });
    } catch (err) {
      process.exitCode = handleFatal(err, run, Boolean(global.json));
    }
  });

  addGlobalOptions(
    program
      .command("validate")
      .description("validate *.dockup.json without Docker")
      .option("-e, --env <name>", "validate a single environment"),
  ).action((localOpts: CommanderValidateOpts) => {
    const global = appContext.global;
    const options = validateFromCommander({ ...localOpts, ...global });
    const run = appContext.run;
    const version = readPackageVersion();

    let configBasename: string | undefined;
    try {
      configBasename = basename(loadValidatedConfig(options).configPath);
    } catch {
      // header without config if discovery fails later
    }

    printHumanHeader(run, version, "validate", {
      configBasename,
      env: options.env,
    });

    try {
      runValidate(options, run);
    } catch (err) {
      process.exitCode = handleFatal(err, run, Boolean(global.json));
    }
  });

  addOutputOptions(
    program
      .command("init")
      .description("create a *.dockup.json from the minimal template")
      .argument("[name]", "config base name", "app"),
  ).action((name: string, _localOpts: CommanderGlobalOpts) => {
    const global = appContext.global;
    const options = initFromCommander(name, global);
    const run = appContext.run;
    const version = readPackageVersion();

    printHumanHeader(run, version, "init", {
      configBasename: options.name.endsWith(".dockup.json")
        ? options.name
        : `${options.name}.dockup.json`,
    });

    try {
      runInit(options, run);
    } catch (err) {
      process.exitCode = handleFatal(err, run, Boolean(global.json));
    }
  });

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const appContext = createAppRunContext();
  const program = createProgram(appContext);

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (err) {
    const { global, run } = appContext;
    process.exitCode = handleFatal(err, run, Boolean(global.json));
  }
}

// Re-export for tests that import from program.ts
export { exitCodeForPhase };
