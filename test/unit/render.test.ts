import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildComposeDocument, serializeCompose } from "../../src/compose/render.js";
import { getEnvironment } from "../../src/config/validate.js";
import type { DockupConfig } from "../../src/config/types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadConfig(name: string): DockupConfig {
  return JSON.parse(readFileSync(join(repoRoot, "examples", name), "utf8")) as DockupConfig;
}

describe("render v2 compose fields", () => {
  const config = loadConfig("compose-complete.dockup.json");
  const resolved = getEnvironment(config, "dev");
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);
  const yaml = serializeCompose(doc);

  it("renders pull-only imageRef literally", () => {
    const traefik = (doc.services as Record<string, Record<string, unknown>>).traefik;
    assert.equal(traefik.image, "traefik:v3.3");
  });

  it("renders labels with interpolation", () => {
    assert.match(yaml, /Host\(`app\.localhost`\)/);
  });

  it("renders healthcheck and depends_on condition map", () => {
    const app = (doc.services as Record<string, Record<string, unknown>>).app;
    const sidecar = (doc.services as Record<string, Record<string, unknown>>).sidecar;
    assert.ok(sidecar.healthcheck);
    assert.deepEqual(app.depends_on, {
      sidecar: { condition: "service_healthy" },
    });
  });

  it("renders capabilities and shm size", () => {
    const sidecar = (doc.services as Record<string, Record<string, unknown>>).sidecar;
    assert.deepEqual(sidecar.cap_add, ["SYS_ADMIN"]);
    assert.equal(sidecar.shm_size, "2gb");
  });

  it("renders multiple networks and internal network definition", () => {
    const sidecar = (doc.services as Record<string, Record<string, unknown>>).sidecar;
    assert.deepEqual(sidecar.networks, ["edge", "internal"]);
    const networks = doc.networks as Record<string, Record<string, unknown>>;
    assert.equal(networks.internal.internal, true);
  });

  it("merges compose escape hatch", () => {
    const app = (doc.services as Record<string, Record<string, unknown>>).app;
    assert.deepEqual(app.deploy, {
      resources: { limits: { cpus: "0.50" } },
    });
  });

  it("renders readOnly volume mounts", () => {
    const configWithReadOnly: DockupConfig = {
      dev: {
        namespace: "x",
        network: "net",
        containers: [
          {
            id: "cache",
            image: "cache",
            volumes: [{ name: "data", container: "/data", readOnly: true }],
          },
        ],
      },
    };
    const resolvedReadOnly = getEnvironment(configWithReadOnly, "dev");
    const readOnlyDoc = buildComposeDocument(
      resolvedReadOnly,
      resolvedReadOnly.env,
      resolvedReadOnly.containers,
    );
    const cache = (readOnlyDoc.services as Record<string, Record<string, unknown>>).cache;
    assert.deepEqual(cache.volumes, ["data:/data:ro"]);
  });

  it("interpolates extraHosts host names", () => {
    const configWithHosts: DockupConfig = {
      dev: {
        namespace: "x",
        network: "net",
        env: [{ name: "API_HOST", value: "api.internal" }],
        containers: [
          {
            id: "app",
            image: "app",
            extraHosts: [{ host: "${API_HOST}", ip: "10.0.0.5" }],
          },
        ],
      },
    };
    const resolvedHosts = getEnvironment(configWithHosts, "dev");
    const hostsDoc = buildComposeDocument(
      resolvedHosts,
      resolvedHosts.env,
      resolvedHosts.containers,
    );
    const app = (hostsDoc.services as Record<string, Record<string, unknown>>).app;
    assert.deepEqual(app.extra_hosts, ["api.internal:10.0.0.5"]);
  });
});

describe("render additional tier-2 fields", () => {
  const config: DockupConfig = {
    dev: {
      namespace: "x",
      network: "net",
      networks: [{ name: "backend", driver: "bridge" }],
      volumes: [{ name: "shared", external: true }],
      containers: [
        {
          id: "worker",
          image: "worker",
          entrypoint: ["/entry.sh"],
          restart: "on-failure",
          memLimit: "512m",
          cpus: 1.5,
          expose: [9090],
          ports: [{ host: 3000, container: 3000 }],
          volumes: [{ host: "/var/run/docker.sock", container: "/var/run/docker.sock" }],
          networks: [{ name: "backend", aliases: ["worker.internal"] }],
          healthcheck: {
            test: ["CMD", "true"],
            startPeriod: "5s",
          },
        },
        {
          id: "api",
          image: "api",
          dependsOn: [{ id: "worker" }],
        },
      ],
    },
  };

  const resolved = getEnvironment(config, "dev");
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);
  const worker = (doc.services as Record<string, Record<string, unknown>>).worker;
  const api = (doc.services as Record<string, Record<string, unknown>>).api;

  it("renders entrypoint, restart, resources, ports, and expose", () => {
    assert.deepEqual(worker.entrypoint, ["/entry.sh"]);
    assert.equal(worker.restart, "on-failure");
    assert.equal(worker.mem_limit, "512m");
    assert.equal(worker.cpus, 1.5);
    assert.deepEqual(worker.expose, ["9090"]);
    assert.deepEqual(worker.ports, ["3000:3000"]);
  });

  it("renders bind mounts and network aliases", () => {
    assert.deepEqual(worker.volumes, ["/var/run/docker.sock:/var/run/docker.sock"]);
    assert.deepEqual(worker.networks, {
      backend: { aliases: ["worker.internal"] },
    });
    const volumes = doc.volumes as Record<string, Record<string, unknown>>;
    assert.equal(volumes.shared.external, true);
  });

  it("renders healthcheck start_period and depends_on short syntax", () => {
    const healthcheck = worker.healthcheck as Record<string, unknown>;
    assert.equal(healthcheck.start_period, "5s");
    assert.deepEqual(api.depends_on, ["worker"]);
  });
});

describe("render remaining tier-2 fields", () => {
  const config: DockupConfig = {
    dev: {
      namespace: "x",
      network: "net",
      env: [
        { name: "APP_HOST", value: "app.internal" },
        { name: "REGISTRY_IMAGE", value: "ghcr.io/org/app:1.0" },
      ],
      containers: [
        {
          id: "migrator",
          image: "migrator",
          command: "npm run migrate",
          profiles: ["tools"],
          init: true,
          user: "1000:1000",
          workingDir: "/app",
          privileged: true,
          capDrop: ["NET_RAW"],
          memswapLimit: "1g",
          cpuShares: 512,
          pidsLimit: 100,
          hostname: "${APP_HOST}",
          domainname: "internal.local",
          envFile: [".env.runtime"],
        },
        {
          id: "pull",
          imageRef: "${REGISTRY_IMAGE}",
        },
        {
          id: "app",
          image: "app",
          dependsOn: [{ id: "migrator", condition: "service_completed_successfully" }],
        },
      ],
    },
  };

  const resolved = getEnvironment(config, "dev");
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);
  const migrator = (doc.services as Record<string, Record<string, unknown>>).migrator;
  const pull = (doc.services as Record<string, Record<string, unknown>>).pull;
  const app = (doc.services as Record<string, Record<string, unknown>>).app;

  it("renders runtime, security, and resource fields", () => {
    assert.equal(migrator.command, "npm run migrate");
    assert.deepEqual(migrator.profiles, ["tools"]);
    assert.equal(migrator.init, true);
    assert.equal(migrator.user, "1000:1000");
    assert.equal(migrator.working_dir, "/app");
    assert.equal(migrator.privileged, true);
    assert.deepEqual(migrator.cap_drop, ["NET_RAW"]);
    assert.equal(migrator.memswap_limit, "1g");
    assert.equal(migrator.cpu_shares, 512);
    assert.equal(migrator.pids_limit, 100);
    assert.equal(migrator.hostname, "app.internal");
    assert.equal(migrator.domainname, "internal.local");
    assert.deepEqual(migrator.env_file, [".env.runtime"]);
  });

  it("interpolates imageRef and service_completed_successfully depends_on", () => {
    assert.equal(pull.image, "ghcr.io/org/app:1.0");
    assert.deepEqual(app.depends_on, {
      migrator: { condition: "service_completed_successfully" },
    });
  });
});

describe("render prod root compose escape", () => {
  const config = loadConfig("compose-complete.dockup.json");
  const resolved = getEnvironment(config, "prod");
  const doc = buildComposeDocument(resolved, resolved.env, resolved.containers);

  it("merges environment compose metadata", () => {
    assert.equal(doc.name, "compose-complete-prod");
  });

  it("declares named volumes from environment", () => {
    const volumes = doc.volumes as Record<string, unknown>;
    assert.ok(volumes["traefik-certs"]);
  });
});
