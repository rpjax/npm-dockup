import type {
  ContainerConfig,
  DependsOnEntry,
  HealthcheckConfig,
  NetworkAttachment,
  NetworkDefinition,
  NameValueEntry,
  ResolvedEnvironment,
  VolumeDefinition,
  VolumeMapping,
} from "../config/types.js";
import { composeRuntimeEnv, interpolate, resolveEnvironmentEnv } from "../env/resolve.js";
import { imageRoot as computeImageRoot, resolveComposeImage } from "../docker/image.js";
import { interpolateCommand, interpolateLabels, interpolateValue } from "./interpolate.js";
import { deepMerge } from "./merge.js";
import YAML from "yaml";

function collectNamedVolumes(containers: ContainerConfig[]): string[] {
  const names = new Set<string>();
  for (const container of containers) {
    for (const volume of container.volumes ?? []) {
      if (volume.name?.trim()) {
        names.add(volume.name.trim());
      }
    }
  }
  return [...names];
}

function renderDependsOn(deps: DependsOnEntry[]): Record<string, unknown> | string[] {
  const hasConditions = deps.some((dep) => dep.condition && dep.condition !== "service_started");
  if (!hasConditions) {
    return deps.map((dep) => dep.id);
  }

  const result: Record<string, { condition: string }> = {};
  for (const dep of deps) {
    result[dep.id] = {
      condition: dep.condition ?? "service_started",
    };
  }
  return result;
}

function renderHealthcheck(
  healthcheck: HealthcheckConfig,
  symbols: Map<string, string>,
): Record<string, unknown> {
  const rendered: Record<string, unknown> = {
    test: interpolateValue(healthcheck.test, symbols),
  };
  if (healthcheck.interval) {
    rendered.interval = healthcheck.interval;
  }
  if (healthcheck.timeout) {
    rendered.timeout = healthcheck.timeout;
  }
  if (healthcheck.retries !== undefined) {
    rendered.retries = healthcheck.retries;
  }
  if (healthcheck.startPeriod) {
    rendered.start_period = healthcheck.startPeriod;
  }
  return rendered;
}

function normalizeNetworkAttachments(
  networks: string[] | NetworkAttachment[] | undefined,
  defaultNetwork: string,
): NetworkAttachment[] {
  if (!networks?.length) {
    return [{ name: defaultNetwork }];
  }

  return networks.map((entry) => (typeof entry === "string" ? { name: entry } : entry));
}

function renderServiceNetworks(
  attachments: NetworkAttachment[],
): Record<string, unknown> | string[] {
  const hasAliases = attachments.some((entry) => entry.aliases?.length);
  if (!hasAliases) {
    return attachments.map((entry) => entry.name);
  }

  const result: Record<string, { aliases?: string[] }> = {};
  for (const entry of attachments) {
    result[entry.name] = entry.aliases?.length ? { aliases: entry.aliases } : {};
  }
  return result;
}

function renderVolumeMount(volume: VolumeMapping): string {
  const suffix = volume.readOnly ? ":ro" : "";
  const name = volume.name?.trim();
  const host = volume.host?.trim();
  if (name) {
    return `${name}:${volume.container}${suffix}`;
  }
  if (host) {
    return `${host}:${volume.container}${suffix}`;
  }
  throw new Error("Volume mount requires name or host.");
}

function renderNetworkDefinitions(
  defaultNetwork: string,
  extraNetworks: NetworkDefinition[] | undefined,
): Record<string, unknown> {
  const networks: Record<string, unknown> = {
    [defaultNetwork]: { name: defaultNetwork },
  };

  for (const network of extraNetworks ?? []) {
    if (network.name === defaultNetwork) {
      networks[defaultNetwork] = buildNetworkDefinition(network, defaultNetwork);
      continue;
    }
    networks[network.name] = buildNetworkDefinition(network, network.name);
  }

  return networks;
}

function buildNetworkDefinition(
  network: NetworkDefinition,
  fallbackName: string,
): Record<string, unknown> {
  const def: Record<string, unknown> = { name: network.name || fallbackName };
  if (network.driver) {
    def.driver = network.driver;
  }
  if (network.external) {
    def.external = true;
  }
  if (network.internal) {
    def.internal = true;
  }
  return def;
}

function renderVolumeDefinitions(
  mountNames: string[],
  envVolumes: VolumeDefinition[] | undefined,
): Record<string, unknown> | undefined {
  const defs: Record<string, unknown> = {};

  for (const name of mountNames) {
    defs[name] = {};
  }

  for (const volume of envVolumes ?? []) {
    const def: Record<string, unknown> = {};
    if (volume.external) {
      def.external = true;
    }
    if (volume.driver) {
      def.driver = volume.driver;
    }
    if (volume.driverOpts) {
      def.driver_opts = volume.driverOpts;
    }
    defs[volume.name] = def;
  }

  return Object.keys(defs).length > 0 ? defs : undefined;
}

function renderResources(container: ContainerConfig): Record<string, unknown> {
  const resources: Record<string, unknown> = {};
  if (container.memLimit) {
    resources.mem_limit = container.memLimit;
  }
  if (container.memswapLimit) {
    resources.memswap_limit = container.memswapLimit;
  }
  if (container.cpus !== undefined) {
    resources.cpus = container.cpus;
  }
  if (container.cpuShares !== undefined) {
    resources.cpu_shares = container.cpuShares;
  }
  if (container.pidsLimit !== undefined) {
    resources.pids_limit = container.pidsLimit;
  }
  return resources;
}

function renderContainerService(
  container: ContainerConfig,
  defaultNetwork: string,
  runtimeEnv: Array<{ name: string; value: string }>,
  symbols: Map<string, string>,
): Record<string, unknown> {
  const service: Record<string, unknown> = {
    image: container.imageRef?.trim()
      ? interpolate(container.imageRef.trim(), symbols)
      : resolveComposeImage(container),
    container_name: container.id,
    restart: container.restart ?? "unless-stopped",
    networks: renderServiceNetworks(
      normalizeNetworkAttachments(container.networks, defaultNetwork),
    ),
  };

  if (container.ports?.length) {
    service.ports = container.ports.map((port) => `${port.host}:${port.container}`);
  }

  if (container.expose?.length) {
    service.expose = container.expose.map(String);
  }

  if (runtimeEnv.length) {
    service.environment = Object.fromEntries(runtimeEnv.map((entry) => [entry.name, entry.value]));
  }

  if (container.envFile?.length) {
    service.env_file = container.envFile;
  }

  if (container.volumes?.length) {
    service.volumes = container.volumes.map(renderVolumeMount);
  }

  if (container.dependsOn?.length) {
    service.depends_on = renderDependsOn(container.dependsOn);
  }

  const command = interpolateCommand(container.command, symbols);
  if (command !== undefined) {
    service.command = command;
  }

  const entrypoint = interpolateCommand(container.entrypoint, symbols);
  if (entrypoint !== undefined) {
    service.entrypoint = entrypoint;
  }

  const labels = interpolateLabels(container.labels, symbols);
  if (labels && Object.keys(labels).length > 0) {
    service.labels = labels;
  }

  if (container.healthcheck) {
    service.healthcheck = renderHealthcheck(container.healthcheck, symbols);
  }

  if (container.profiles?.length) {
    service.profiles = container.profiles;
  }

  if (container.init !== undefined) {
    service.init = container.init;
  }

  if (container.user) {
    service.user = container.user;
  }

  if (container.workingDir) {
    service.working_dir = container.workingDir;
  }

  if (container.privileged !== undefined) {
    service.privileged = container.privileged;
  }

  if (container.capAdd?.length) {
    service.cap_add = container.capAdd;
  }

  if (container.capDrop?.length) {
    service.cap_drop = container.capDrop;
  }

  if (container.shmSize) {
    service.shm_size = container.shmSize;
  }

  if (container.hostname) {
    service.hostname = interpolateValue(container.hostname, symbols);
  }

  if (container.domainname) {
    service.domainname = interpolateValue(container.domainname, symbols);
  }

  if (container.extraHosts?.length) {
    service.extra_hosts = container.extraHosts.map(
      (entry) => `${interpolate(entry.host, symbols)}:${entry.ip}`,
    );
  }

  Object.assign(service, renderResources(container));

  if (container.compose) {
    deepMerge(service, container.compose);
  }

  return service;
}

export function buildComposeDocument(
  resolved: ResolvedEnvironment,
  environmentEnv: NameValueEntry[],
  containers: ContainerConfig[],
): Record<string, unknown> {
  const envSymbols = resolveEnvironmentEnv(environmentEnv);
  const services: Record<string, unknown> = {};

  for (const container of containers) {
    const runtimeEnv = composeRuntimeEnv(environmentEnv, container.env ?? [], envSymbols);
    services[container.id] = renderContainerService(
      container,
      resolved.network,
      runtimeEnv,
      envSymbols,
    );
  }

  const namedVolumes = collectNamedVolumes(containers);
  const doc: Record<string, unknown> = {
    services,
    networks: renderNetworkDefinitions(resolved.network, resolved.networks),
  };

  const volumeDefs = renderVolumeDefinitions(namedVolumes, resolved.volumes);
  if (volumeDefs) {
    doc.volumes = volumeDefs;
  }

  if (resolved.compose) {
    deepMerge(doc, resolved.compose);
  }

  return doc;
}

export function buildEnvFileContent(resolved: ResolvedEnvironment, envKey: string): string {
  const root = computeImageRoot(resolved);
  return [
    "# Generated by dockup — do not edit by hand",
    `# env=${envKey}`,
    `DOCKER_IMAGE_ROOT=${root}`,
    `DOCKER_TAG=${resolved.tag}`,
    "",
  ].join("\n");
}

export function serializeCompose(doc: Record<string, unknown>): string {
  return YAML.stringify(doc, { lineWidth: 0 }).trimEnd() + "\n";
}
