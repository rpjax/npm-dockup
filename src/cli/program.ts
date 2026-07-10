import { Command, Option } from "commander";
import { DockupError, ResolveError, type ErrorPhase } from "../errors/index.js";
import { Logger } from "../logger/index.js";
import { EXIT, type ExitCode } from "./exit-codes.js";
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

export function readPackageVersion(): string {
  return getVersion();
}

function addGlobalOptions(command: Command): Command {
  return command
    .option("-c, --config <path>", "path to *.dockup.json config file")
    .option("-r, --root <path>", "repository root for build contexts", ".")
    .option("--json", "structured JSON output")
    .option("-q, --quiet", "errors and warnings only")
    .option("-v, --verbose", "debug logging");
}

function addOutputOptions(command: Command): Command {
  return command
    .option("--json", "structured JSON output")
    .option("-q, --quiet", "errors and warnings only")
    .option("-v, --verbose", "debug logging");
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
  };
}

function printJsonError(err: DockupError | ResolveError): void {
  const payload =
    err instanceof DockupError
      ? {
          ok: false,
          phase: err.phase,
          message: err.message,
          hint: err.hint ?? null,
          detail: err.detail ?? null,
          cause: err.causeText ?? null,
        }
      : {
          ok: false,
          phase: "CONFIG",
          message: err.message,
          hint: null,
          detail: null,
          cause: null,
        };
  console.log(JSON.stringify(payload, null, 2));
}

export function exitCodeForPhase(phase: ErrorPhase): ExitCode {
  if (phase === "CLI" || phase === "CONFIG" || phase === "GENERATE") {
    return EXIT.CLI_CONFIG;
  }
  if (phase === "RUNTIME") {
    return EXIT.RUNTIME;
  }
  return EXIT.DOCKER;
}

export function handleFatal(
  err: unknown,
  log: Logger,
  json: boolean,
  options: { interactive?: boolean } = {},
): ExitCode {
  const interactive = options.interactive ?? false;

  if (err instanceof DockupError) {
    if (json) {
      printJsonError(err);
    } else if (!interactive) {
      log.section("dockup failed");
      log.error(err.phase, err.message, { detail: err.detail });
      if (err.causeText) {
        log.error(err.phase, `Cause: ${err.causeText}`);
      }
      if (err.hint) {
        log.warn(err.phase, `Hint: ${err.hint}`);
      }
      const elapsed = ((Date.now() - log.startedAt) / 1000).toFixed(1);
      console.log(`Elapsed: ${elapsed}s`);
    } else if (err.hint) {
      log.warn(err.phase, `Hint: ${err.hint}`);
    }
    return exitCodeForPhase(err.phase);
  }

  if (err instanceof ResolveError) {
    if (json) {
      printJsonError(err);
    } else {
      log.section("dockup failed");
      log.error("CONFIG", err.message);
    }
    return EXIT.CLI_CONFIG;
  }

  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.log(JSON.stringify({ ok: false, phase: "RUNTIME", message }, null, 2));
  } else {
    log.section("dockup failed");
    log.error("RUNTIME", "Unexpected error.", {
      detail:
        err instanceof Error && err.stack
          ? err.stack.split("\n").slice(0, 6).join("\n")
          : undefined,
    });
    log.error("RUNTIME", `Cause: ${message}`);
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

interface RunContext {
  global: CommanderGlobalOpts;
  log: Logger;
  interactive: boolean;
}

function createRunContext(): RunContext {
  return {
    global: {},
    log: createLogger({}),
    interactive: false,
  };
}

export function createProgram(runContext: RunContext = createRunContext()): Command {
  const program = addGlobalOptions(
    new Command()
      .name("dockup")
      .description("Docker deploy CLI — build, push, and generate compose artifacts")
      .version(readPackageVersion(), "-V, --version", "print version")
      .enablePositionalOptions(),
  );

  program.hook("preAction", (_thisCommand, actionCommand) => {
    runContext.global = mergeCommanderGlobal(
      program.opts() as CommanderGlobalOpts,
      actionCommand.opts() as CommanderGlobalOpts,
    );
    runContext.interactive =
      actionCommand.name() === "deploy" &&
      !runContext.global.json &&
      !runContext.global.quiet;
    runContext.log = createLogger(runContext.global, runContext.interactive);
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
    const global = runContext.global;
    const options = deployFromCommander({ ...localOpts, ...global });
    const log = runContext.log;

    if (!options.json && !options.quiet) {
      log.banner(readPackageVersion());
    }

    try {
      await runDeploy(options, log);
    } catch (err) {
      process.exitCode = handleFatal(err, log, Boolean(global.json), {
        interactive: runContext.interactive,
      });
    }
  });

  addGlobalOptions(
    program
      .command("validate")
      .description("validate *.dockup.json without Docker")
      .option("-e, --env <name>", "validate a single environment"),
  ).action((localOpts: CommanderValidateOpts) => {
    const global = runContext.global;
    const options = validateFromCommander({ ...localOpts, ...global });
    const log = runContext.log;

    if (!options.json && !options.quiet) {
      log.banner(readPackageVersion());
    }

    try {
      runValidate(options, log);
    } catch (err) {
      process.exitCode = handleFatal(err, log, Boolean(global.json));
    }
  });

  addOutputOptions(
    program
      .command("init")
      .description("create a *.dockup.json from the minimal template")
      .argument("[name]", "config base name", "app"),
  ).action((name: string, _localOpts: CommanderGlobalOpts) => {
    const global = runContext.global;
    const options = initFromCommander(name, global);
    const log = runContext.log;

    if (!options.json && !options.quiet) {
      log.banner(readPackageVersion());
    }

    try {
      runInit(options, log);
    } catch (err) {
      process.exitCode = handleFatal(err, log, Boolean(global.json));
    }
  });

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const runContext = createRunContext();
  const program = createProgram(runContext);

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (err) {
    const { global, log, interactive } = runContext;
    process.exitCode = handleFatal(err, log, Boolean(global.json), { interactive });
  }
}
