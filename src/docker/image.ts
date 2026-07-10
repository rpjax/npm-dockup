import type { ContainerConfig, ResolvedEnvironment } from "../config/types.js";

export function imageRoot(resolved: Pick<ResolvedEnvironment, "namespace" | "registry">): string {
  const namespace = resolved.namespace.trim();
  const registry = resolved.registry?.trim();
  return registry ? `${registry}/${namespace}` : namespace;
}

export function imageReference(
  resolved: Pick<ResolvedEnvironment, "namespace" | "registry">,
  container: ContainerConfig,
  tag: string,
): string {
  return `${imageRoot(resolved)}/${container.image}:${tag}`;
}

export function hasBuildContext(container: ContainerConfig): boolean {
  return Boolean(container.context?.trim());
}
