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
}

export interface ContainerConfig {
  id: string;
  image: string;
  context?: string;
  dockerfile?: string;
  env?: NameValueEntry[];
  buildArgs?: NameValueEntry[];
  ports?: PortMapping[];
  expose?: (number | string)[];
  volumes?: VolumeMapping[];
  dependsOn?: string[];
}

export interface EnvironmentConfig {
  namespace: string;
  network: string;
  tag?: string;
  registry?: string;
  env?: NameValueEntry[];
  containers: ContainerConfig[];
}

export type DockupConfig = Record<string, EnvironmentConfig>;

export interface ResolvedEnvironment {
  namespace: string;
  network: string;
  tag: string;
  registry?: string;
  env: NameValueEntry[];
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
