import AjvModule from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { fail, ResolveError } from "../errors/index.js";
import { composeRuntimeEnv, resolveBuildArgs, resolveEnvironmentEnv } from "../env/resolve.js";
import type { Logger } from "../logger/index.js";
import type {
  ContainerConfig,
  DockupConfig,
  NameValueEntry,
  ResolvedEnvironment,
} from "./types.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = join(packageRoot, "schema", "dockup.schema.json");

let ajvValidator: ValidateFunction | null = null;

function getSchemaValidator(): ValidateFunction {
  if (!ajvValidator) {
    const Ajv = AjvModule.default ?? AjvModule;
    const ajv = new Ajv({ allErrors: true, strict: false });
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    ajvValidator = ajv.compile(schema);
  }
  return ajvValidator;
}

export function validateSchema(config: unknown): void {
  const validate = getSchemaValidator();
  if (!validate(config)) {
    const messages = (validate.errors ?? [])
      .map((err: ErrorObject) => {
        const path = err.instancePath || "(root)";
        return `${path}: ${err.message ?? "invalid"}`;
      })
      .join("\n");
    fail("CONFIG", "Config failed JSON Schema validation.", {
      detail: messages,
      hint: "See schema/dockup.schema.json or docs/config.md",
    });
  }
}

function validateNameValueEntries(
  entries: NameValueEntry[] | undefined,
  label: string,
  options: { allowGlobal?: boolean; forbidGlobal?: boolean } = {},
): void {
  if (entries === undefined) {
    return;
  }

  if (!Array.isArray(entries)) {
    fail("CONFIG", `${label} must be an array.`);
  }

  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry?.name?.trim()) {
      fail("CONFIG", `Every entry in ${label} needs a non-empty "name".`);
    }
    if (names.has(entry.name)) {
      fail("CONFIG", `Duplicate name "${entry.name}" in ${label}.`);
    }
    names.add(entry.name);

    if (entry.value === undefined || entry.value === null) {
      fail("CONFIG", `"${entry.name}" in ${label} needs a "value".`);
    }

    if (options.allowGlobal && entry.global !== undefined && typeof entry.global !== "boolean") {
      fail("CONFIG", `"${entry.name}".global in ${label} must be a boolean.`);
    }

    if (options.forbidGlobal && entry.global !== undefined) {
      fail("CONFIG", `"${entry.name}".global is only allowed in environment env, not in ${label}.`);
    }
  }
}

function validateEnvironmentSemantics(config: DockupConfig, env: string, repoRoot: string): void {
  const environment = config[env];
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    fail("CONFIG", `"${env}" must be an object.`);
  }

  if (!environment.namespace?.trim()) {
    fail("CONFIG", `"${env}".namespace is required.`);
  }

  if (!environment.network?.trim()) {
    fail("CONFIG", `"${env}".network is required.`);
  }

  if (environment.tag !== undefined && !String(environment.tag).trim()) {
    fail("CONFIG", `"${env}".tag must be a non-empty string when set.`);
  }

  validateNameValueEntries(environment.env, `"${env}".env`, { allowGlobal: true });

  const containers = environment.containers;
  if (!Array.isArray(containers) || containers.length === 0) {
    fail("CONFIG", `"${env}".containers must be a non-empty array.`);
  }

  const ids = new Set<string>();
  for (const container of containers) {
    validateContainer(config, env, container, containers, ids, repoRoot);
  }

  try {
    const environmentEnv = environment.env ?? [];
    const envSymbols = resolveEnvironmentEnv(environmentEnv);

    for (const container of containers) {
      resolveBuildArgs(container.buildArgs ?? [], envSymbols);
      composeRuntimeEnv(environmentEnv, container.env ?? [], envSymbols);
    }
  } catch (err) {
    if (err instanceof ResolveError) {
      fail("CONFIG", `Environment "${env}" resolution failed: ${err.message}`);
    }
    throw err;
  }
}

function validateContainer(
  _config: DockupConfig,
  env: string,
  container: ContainerConfig,
  containers: ContainerConfig[],
  ids: Set<string>,
  repoRoot: string,
): void {
  if (!container.id?.trim()) {
    fail("CONFIG", `Every container in "${env}" needs a non-empty "id".`);
  }
  if (!container.image?.trim()) {
    fail("CONFIG", `Container "${container.id}" in "${env}" needs an "image" name.`);
  }
  if (ids.has(container.id)) {
    fail("CONFIG", `Duplicate container id "${container.id}" in "${env}".`);
  }
  ids.add(container.id);

  validateNameValueEntries(container.env, `"${env}".containers["${container.id}"].env`, {
    forbidGlobal: true,
  });
  validateNameValueEntries(
    container.buildArgs,
    `"${env}".containers["${container.id}"].buildArgs`,
    { forbidGlobal: true },
  );

  if ((container.buildArgs?.length ?? 0) > 0 && !container.context?.trim()) {
    fail("CONFIG", `Container "${container.id}" in "${env}" has buildArgs but no build context.`);
  }

  if (container.dependsOn) {
    for (const dep of container.dependsOn) {
      if (!ids.has(dep) && !containers.some((c) => c.id === dep)) {
        fail(
          "CONFIG",
          `Container "${container.id}" depends on unknown service "${dep}" in "${env}".`,
        );
      }
    }
  }

  if (container.context?.trim()) {
    const contextPath = join(repoRoot, container.context);
    if (!existsSync(contextPath)) {
      fail("CONFIG", `Build context not found for "${container.id}".`, {
        detail: `Missing path: ${contextPath}`,
        hint: "Check --root and container.context paths.",
      });
    }
    const dockerfile = join(contextPath, container.dockerfile ?? "Dockerfile");
    if (!existsSync(dockerfile)) {
      fail("CONFIG", `Dockerfile not found for "${container.id}".`, {
        detail: `Missing file: ${dockerfile}`,
      });
    }
  }
}

export function validateConfig(
  config: DockupConfig,
  configPath: string,
  repoRoot: string,
  log?: Logger,
  onlyEnv?: string,
): string[] {
  validateSchema(config);

  const envNames = Object.keys(config);
  if (envNames.length === 0) {
    fail("CONFIG", `${configPath} must define at least one environment at the root.`);
  }

  if (onlyEnv && !envNames.includes(onlyEnv)) {
    fail("CONFIG", `Unknown environment "${onlyEnv}".`, {
      detail: `Available environments: ${envNames.join(" | ")}`,
    });
  }

  const targets = onlyEnv ? [onlyEnv] : envNames;
  for (const env of targets) {
    validateEnvironmentSemantics(config, env, repoRoot);
  }

  log?.ok("CONFIG", `Using ${basename(configPath)}`);
  log?.ok(
    "CONFIG",
    onlyEnv
      ? `Validated environment: ${onlyEnv}`
      : `Validated ${envNames.length} environment(s): ${envNames.join(", ")}`,
  );

  return onlyEnv ? [onlyEnv] : envNames;
}

export function getEnvironment(config: DockupConfig, envKey: string): ResolvedEnvironment {
  const environment = config[envKey];
  if (!environment) {
    fail("CONFIG", `Unknown environment "${envKey}".`);
  }

  const tag = environment.tag?.trim() || envKey;

  return {
    namespace: environment.namespace.trim(),
    network: environment.network.trim(),
    tag,
    registry: environment.registry?.trim() || undefined,
    env: environment.env ?? [],
    containers: environment.containers,
  };
}

export function listEnvNames(config: DockupConfig): string[] {
  return Object.keys(config);
}
