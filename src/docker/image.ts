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
  const imageName = container.image?.trim();
  if (!imageName) {
    throw new Error(`Container "${container.id}" needs "image" for build/push.`);
  }
  return `${imageRoot(resolved)}/${imageName}:${tag}`;
}

export function isPullOnly(container: ContainerConfig): boolean {
  return Boolean(container.imageRef?.trim()) && !container.context?.trim();
}

export function shouldBuild(container: ContainerConfig): boolean {
  return Boolean(container.context?.trim()) && !isPullOnly(container);
}

export function shouldPush(container: ContainerConfig): boolean {
  return shouldBuild(container);
}

export function resolveComposeImage(container: ContainerConfig): string {
  if (container.imageRef?.trim()) {
    return container.imageRef.trim();
  }
  const imageName = container.image?.trim();
  if (!imageName) {
    throw new Error(`Container "${container.id}" needs "image" or "imageRef".`);
  }
  return `\${DOCKER_IMAGE_ROOT}/${imageName}:\${DOCKER_TAG}`;
}
