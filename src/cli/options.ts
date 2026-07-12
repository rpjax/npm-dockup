export interface GlobalOptions {
  config?: string;
  root: string;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  streamLogs: boolean;
  withLogs: boolean;
}

export interface DeployOptions extends GlobalOptions {
  env: string;
  only?: string;
  skipBuild: boolean;
  skipPush: boolean;
  generateOnly: boolean;
  dryRun: boolean;
}

export type ValidateOptions = GlobalOptions & {
  env?: string;
};

export interface InitOptions {
  name: string;
  json: boolean;
  quiet: boolean;
}

export interface CommanderGlobalOpts {
  config?: string;
  root?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  streamLogs?: boolean;
  withLogs?: boolean;
}

export interface CommanderDeployOpts extends CommanderGlobalOpts {
  env: string;
  only?: string;
  skipBuild?: boolean;
  skipPush?: boolean;
  generateOnly?: boolean;
  dryRun?: boolean;
}

export interface CommanderValidateOpts extends CommanderGlobalOpts {
  env?: string;
}

export function globalFromCommander(opts: CommanderGlobalOpts): GlobalOptions {
  return {
    config: opts.config,
    root: opts.root ?? ".",
    json: Boolean(opts.json),
    quiet: Boolean(opts.quiet),
    verbose: Boolean(opts.verbose),
    streamLogs: Boolean(opts.streamLogs),
    withLogs: Boolean(opts.withLogs),
  };
}

export function deployFromCommander(opts: CommanderDeployOpts): DeployOptions {
  const global = globalFromCommander(opts);
  const generateOnly = Boolean(opts.generateOnly);

  return {
    ...global,
    env: opts.env,
    only: opts.only,
    skipBuild: generateOnly || Boolean(opts.skipBuild),
    skipPush: generateOnly || Boolean(opts.skipPush),
    generateOnly,
    dryRun: Boolean(opts.dryRun),
  };
}

export function validateFromCommander(opts: CommanderValidateOpts): ValidateOptions {
  return {
    ...globalFromCommander(opts),
    env: opts.env,
  };
}

export function initFromCommander(
  name: string,
  opts: Pick<CommanderGlobalOpts, "json" | "quiet">,
): InitOptions {
  return {
    name,
    json: Boolean(opts.json),
    quiet: Boolean(opts.quiet),
  };
}

export function useListr(options: Pick<GlobalOptions, "json" | "quiet" | "streamLogs">): boolean {
  return !options.json && !options.quiet && !options.streamLogs;
}
