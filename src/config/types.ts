export interface NameValueEntry {
  name: string;
  value: string | number | boolean;
  global?: boolean;
}

export interface PortMapping {
  host: number | string;
  container: number | string;
}

export interface VolumeMapping {
  name?: string;
  host?: string;
  container: string;
  readOnly?: boolean;
}

export type DependsOnCondition =
  "service_started" | "service_healthy" | "service_completed_successfully";

export interface DependsOnEntry {
  id: string;
  condition?: DependsOnCondition;
}

export interface HealthcheckConfig {
  test: string | string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  startPeriod?: string;
}

export interface NetworkAttachment {
  name: string;
  aliases?: string[];
}

export interface ExtraHostMapping {
  host: string;
  ip: string;
}

export interface NetworkDefinition {
  name: string;
  driver?: string;
  external?: boolean;
  internal?: boolean;
}

export interface VolumeDefinition {
  name: string;
  external?: boolean;
  driver?: string;
  driverOpts?: Record<string, string>;
}

export interface ContainerConfig {
  id: string;
  image?: string;
  imageRef?: string;
  context?: string;
  dockerfile?: string;
  platform?: string;
  buildTarget?: string;
  env?: NameValueEntry[];
  envFile?: string[];
  buildArgs?: NameValueEntry[];
  ports?: PortMapping[];
  expose?: (number | string)[];
  volumes?: VolumeMapping[];
  dependsOn?: DependsOnEntry[];
  command?: string | string[];
  entrypoint?: string | string[];
  labels?: string[] | Record<string, string>;
  healthcheck?: HealthcheckConfig;
  restart?: string;
  profiles?: string[];
  init?: boolean;
  user?: string;
  workingDir?: string;
  privileged?: boolean;
  capAdd?: string[];
  capDrop?: string[];
  shmSize?: string;
  memLimit?: string;
  memswapLimit?: string;
  cpus?: number | string;
  cpuShares?: number;
  pidsLimit?: number;
  networks?: string[] | NetworkAttachment[];
  hostname?: string;
  domainname?: string;
  extraHosts?: ExtraHostMapping[];
  compose?: Record<string, unknown>;
}

export interface EnvironmentConfig {
  namespace: string;
  network: string;
  networks?: NetworkDefinition[];
  volumes?: VolumeDefinition[];
  tag?: string;
  registry?: string;
  env?: NameValueEntry[];
  compose?: Record<string, unknown>;
  containers: ContainerConfig[];
}

export type DockupConfig = Record<string, EnvironmentConfig>;

export interface ResolvedEnvironment {
  namespace: string;
  network: string;
  networks?: NetworkDefinition[];
  volumes?: VolumeDefinition[];
  tag: string;
  registry?: string;
  env: NameValueEntry[];
  compose?: Record<string, unknown>;
  containers: ContainerConfig[];
}

export interface DeployContext {
  configDir: string;
  repoRoot: string;
  configPath: string;
  config: DockupConfig;
}

export interface ComposeArtifacts {
  composePath: string;
  envPath: string;
  outDir: string;
  composeContent: string;
}
