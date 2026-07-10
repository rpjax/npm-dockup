import AjvModule from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fail, ResolveError } from "../errors/index.js";
import {
  composeRuntimeEnv,
  interpolate,
  resolveBuildArgs,
  resolveEnvironmentEnv,
} from "../env/resolve.js";
import { interpolateCommand, interpolateLabels, interpolateValue } from "../compose/interpolate.js";
import type { Logger } from "../logger/index.js";
import type {
  ContainerConfig,
  DockupConfig,
  NameValueEntry,
  NetworkAttachment,
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

function knownNetworkNames(
  defaultNetwork: string,
  extraNetworks: ResolvedEnvironment["networks"],
): Set<string> {
  const names = new Set<string>([defaultNetwork]);
  for (const network of extraNetworks ?? []) {
    names.add(network.name);
  }
  return names;
}

function validateLabels(labels: ContainerConfig["labels"], label: string): void {
  if (labels === undefined) {
    return;
  }

  if (Array.isArray(labels)) {
    for (const entry of labels) {
      if (!entry.trim() || !entry.includes("=")) {
        fail("CONFIG", `Invalid label in ${label}: "${entry}".`, {
          hint: 'Use "key=value" format for label strings.',
        });
      }
    }
    return;
  }

  for (const key of Object.keys(labels)) {
    if (!key.trim()) {
      fail("CONFIG", `Invalid label key in ${label}.`);
    }
  }
}

function validateHealthcheck(healthcheck: ContainerConfig["healthcheck"], label: string): void {
  if (!healthcheck) {
    return;
  }

  const test = healthcheck.test;
  if (
    test === undefined ||
    test === null ||
    (typeof test === "string" && !test.trim()) ||
    (Array.isArray(test) && test.length === 0)
  ) {
    fail("CONFIG", `${label}.healthcheck.test must be non-empty.`);
  }
}

function validateContainerNetworks(
  container: ContainerConfig,
  env: string,
  knownNetworks: Set<string>,
): void {
  if (!container.networks?.length) {
    return;
  }

  const attachments: NetworkAttachment[] = container.networks.map((entry) =>
    typeof entry === "string" ? { name: entry } : entry,
  );

  for (const attachment of attachments) {
    if (!knownNetworks.has(attachment.name)) {
      fail(
        "CONFIG",
        `Container "${container.id}" in "${env}" references unknown network "${attachment.name}".`,
        {
          hint: "Declare the network on the environment or use the default network key.",
        },
      );
    }
  }
}

function validateContainer(
  env: string,
  container: ContainerConfig,
  containers: ContainerConfig[],
  allIds: Set<string>,
  knownNetworks: Set<string>,
  configDir: string,
  repoRoot: string,
): void {
  if (!container.id?.trim()) {
    fail("CONFIG", `Every container in "${env}" needs a non-empty "id".`);
  }

  const hasImage = Boolean(container.image?.trim());
  const hasImageRef = Boolean(container.imageRef?.trim());

  if (!hasImage && !hasImageRef) {
    fail("CONFIG", `Container "${container.id}" in "${env}" needs "image" or "imageRef".`);
  }

  if (hasImage && hasImageRef) {
    fail(
      "CONFIG",
      `Container "${container.id}" in "${env}" cannot set both "image" and "imageRef".`,
      {
        hint: "Use image + context for built services, or imageRef alone for pull-only images.",
      },
    );
  }

  if (hasImageRef && container.context?.trim()) {
    fail(
      "CONFIG",
      `Container "${container.id}" in "${env}" cannot use imageRef with build context.`,
      {
        hint: "Use image + context for built services, or imageRef alone for pull-only images.",
      },
    );
  }

  if (hasImageRef && (container.buildArgs?.length ?? 0) > 0) {
    fail("CONFIG", `Container "${container.id}" in "${env}" cannot use imageRef with buildArgs.`, {
      hint: "buildArgs apply only to built images with context.",
    });
  }

  if (container.context?.trim() && !hasImage) {
    fail("CONFIG", `Container "${container.id}" in "${env}" with build context needs "image".`);
  }

  validateNameValueEntries(container.env, `"${env}".containers["${container.id}"].env`, {
    forbidGlobal: true,
  });
  validateNameValueEntries(
    container.buildArgs,
    `"${env}".containers["${container.id}"].buildArgs`,
    { forbidGlobal: true },
  );
  validateLabels(container.labels, `"${env}".containers["${container.id}"].labels`);
  validateHealthcheck(container.healthcheck, `"${env}".containers["${container.id}"]`);
  validateContainerNetworks(container, env, knownNetworks);

  if ((container.buildArgs?.length ?? 0) > 0 && !container.context?.trim()) {
    fail("CONFIG", `Container "${container.id}" in "${env}" has buildArgs but no build context.`);
  }

  if ((container.platform?.trim() || container.buildTarget?.trim()) && !container.context?.trim()) {
    fail(
      "CONFIG",
      `Container "${container.id}" in "${env}" has platform/buildTarget but no build context.`,
      { hint: "platform and buildTarget apply only to containers with context." },
    );
  }

  if (container.dependsOn) {
    const seenDeps = new Set<string>();
    for (const dep of container.dependsOn) {
      if (dep.id === container.id) {
        fail("CONFIG", `Container "${container.id}" in "${env}" cannot depend on itself.`);
      }

      if (seenDeps.has(dep.id)) {
        fail(
          "CONFIG",
          `Container "${container.id}" in "${env}" has duplicate dependsOn entry "${dep.id}".`,
        );
      }
      seenDeps.add(dep.id);

      if (!allIds.has(dep.id)) {
        fail(
          "CONFIG",
          `Container "${container.id}" depends on unknown service "${dep.id}" in "${env}".`,
        );
      }

      if (dep.condition === "service_healthy") {
        const target = containers.find((c) => c.id === dep.id);
        if (!target?.healthcheck) {
          fail(
            "CONFIG",
            `Container "${container.id}" depends on "${dep.id}" with service_healthy, but "${dep.id}" has no healthcheck.`,
          );
        }
      }
    }
  }

  for (const volume of container.volumes ?? []) {
    const hasName = Boolean(volume.name?.trim());
    const hasHost = Boolean(volume.host?.trim());

    if (hasName && hasHost) {
      fail(
        "CONFIG",
        `Container "${container.id}" in "${env}" volume mount cannot set both "name" and "host".`,
        { hint: "Use name for named volumes or host for bind mounts, not both." },
      );
    }

    if (!hasName && !hasHost) {
      fail(
        "CONFIG",
        `Container "${container.id}" in "${env}" volume mount needs "name" or "host".`,
      );
    }
  }

  if (container.envFile) {
    for (const file of container.envFile) {
      const path = join(configDir, file);
      if (!existsSync(path)) {
        fail("CONFIG", `envFile not found for "${container.id}".`, {
          detail: `Missing path: ${path}`,
        });
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

function validateEnvironmentSemantics(
  config: DockupConfig,
  env: string,
  repoRoot: string,
  configDir: string,
): void {
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

  const seenNetworkNames = new Set<string>();
  for (const network of environment.networks ?? []) {
    if (seenNetworkNames.has(network.name)) {
      fail("CONFIG", `Duplicate network name "${network.name}" in "${env}".networks.`);
    }
    seenNetworkNames.add(network.name);
  }

  const seenEnvVolumeNames = new Set<string>();
  for (const volume of environment.volumes ?? []) {
    if (seenEnvVolumeNames.has(volume.name)) {
      fail("CONFIG", `Duplicate volume name "${volume.name}" in "${env}".volumes.`);
    }
    seenEnvVolumeNames.add(volume.name);
  }

  const containers = environment.containers;
  if (!Array.isArray(containers) || containers.length === 0) {
    fail("CONFIG", `"${env}".containers must be a non-empty array.`);
  }

  const allIds = new Set(containers.map((c) => c.id));
  const seenIds = new Set<string>();
  const knownNetworks = knownNetworkNames(environment.network, environment.networks);

  for (const container of containers) {
    if (seenIds.has(container.id)) {
      fail("CONFIG", `Duplicate container id "${container.id}" in "${env}".`);
    }
    seenIds.add(container.id);

    validateContainer(env, container, containers, allIds, knownNetworks, configDir, repoRoot);
  }

  try {
    const environmentEnv = environment.env ?? [];
    const envSymbols = resolveEnvironmentEnv(environmentEnv);

    for (const container of containers) {
      resolveBuildArgs(container.buildArgs ?? [], envSymbols);
      composeRuntimeEnv(environmentEnv, container.env ?? [], envSymbols);
      interpolateCommand(container.command, envSymbols);
      interpolateCommand(container.entrypoint, envSymbols);
      interpolateLabels(container.labels, envSymbols);
      if (container.imageRef) {
        interpolate(container.imageRef, envSymbols);
      }
      if (container.healthcheck) {
        interpolateValue(container.healthcheck.test, envSymbols);
      }
      if (container.hostname) {
        interpolate(container.hostname, envSymbols);
      }
      if (container.domainname) {
        interpolate(container.domainname, envSymbols);
      }
      for (const extraHost of container.extraHosts ?? []) {
        interpolate(extraHost.host, envSymbols);
      }
    }
  } catch (err) {
    if (err instanceof ResolveError) {
      fail("CONFIG", `Environment "${env}" resolution failed: ${err.message}`);
    }
    throw err;
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

  const configDir = dirname(configPath);
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
    validateEnvironmentSemantics(config, env, repoRoot, configDir);
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
    networks: environment.networks,
    volumes: environment.volumes,
    tag,
    registry: environment.registry?.trim() || undefined,
    env: environment.env ?? [],
    compose: environment.compose,
    containers: environment.containers,
  };
}

export function listEnvNames(config: DockupConfig): string[] {
  return Object.keys(config);
}
