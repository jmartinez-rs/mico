import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config.js";
import { DEFAULT_CONFIDENCE_CONFIG } from "../domain/confidence.js";
import type { GitHubClient } from "../github/github-client.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PullRequestData } from "../models/index.js";
import { buildServer } from "../server.js";

function makePr(number: number, mergedAt: string): PullRequestData {
  return {
    repository: "acme/web",
    number,
    title: `PR ${number}`,
    body: "Descripción suficientemente larga para señal buena.",
    author: "jose",
    state: "closed",
    url: `https://github.com/acme/web/pull/${number}`,
    baseBranch: "main",
    headBranch: `feature/${number}`,
    createdAt: "2026-08-18T00:00:00Z",
    mergedAt,
    commits: [
      {
        sha: `sha${number}`,
        message: "Implementa la funcionalidad principal",
        author: "jose",
        url: `https://x/${number}`,
      },
    ],
    files: [
      {
        filename: "src/a.ts",
        status: "added",
        additions: 5,
        deletions: 0,
        changes: 5,
        patch: "+ code",
      },
    ],
    reviews: [],
  };
}

const prs: Record<number, PullRequestData> = {
  42: makePr(42, "2026-08-19T00:00:00Z"),
  43: makePr(43, "2026-08-20T00:00:00Z"),
};

const fakeGithub = {
  getPullRequest: async (_repository: string, pullNumber: number) => {
    const pr = prs[pullNumber];
    if (!pr) {
      throw new Error(`PR ${pullNumber} no encontrado en el fake`);
    }
    return pr;
  },
} as unknown as GitHubClient;

const structuredLlm: LLMProvider = {
  generate: async ({ system }) => {
    if (system.includes("digest semanal")) {
      return "Resumen ejecutivo de la semana generado por el LLM.";
    }
    return JSON.stringify({
      overview: "Se avanzó en la funcionalidad principal.",
      did: ["Se implementó la funcionalidad principal"],
      decisions: ["Se adoptó el patrón X"],
      pending: ["Falta documentar"],
    });
  },
};

let documentsPath: string;
let workEventsPath: string;

function makeConfig(): AppConfig {
  return {
    port: 0,
    githubToken: "token",
    llm: { baseUrl: "https://x/v1", apiKey: "key", model: "m" },
    documentsPath,
    workEventsPath,
    mico: {
      watchIntervalMs: 10000,
      targetRepoPath: "./",
      outputDir: "./docs/mico",
      stateFile: "./data/mico-state.json",
    },
    publish: { toRepo: false, pathPrefix: "docs/mico" },
    confidence: DEFAULT_CONFIDENCE_CONFIG,
  };
}

beforeEach(async () => {
  documentsPath = await mkdtemp(join(tmpdir(), "wd-md-docs-"));
  workEventsPath = await mkdtemp(join(tmpdir(), "wd-md-mem-"));
});

afterEach(async () => {
  await rm(documentsPath, { recursive: true, force: true });
  await rm(workEventsPath, { recursive: true, force: true });
});

describe("memoria de work-events + digest semanal", () => {
  it("persiste eventos, deduplica y consulta con filtros", async () => {
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: structuredLlm,
    });

    // Procesar el mismo PR dos veces no duplica (dedupe por id estable).
    await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });

    let list = await app.inject({ method: "GET", url: "/v1/work-events" });
    expect(list.json().workEvents).toHaveLength(1);

    // Un segundo PR distinto agrega otro evento.
    await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 43 },
    });

    list = await app.inject({
      method: "GET",
      url: "/v1/work-events?repository=acme/web",
    });
    expect(list.json().workEvents).toHaveLength(2);

    // Filtro por rango de fechas.
    const filtered = await app.inject({
      method: "GET",
      url: "/v1/work-events?from=2026-08-18T00:00:00Z&to=2026-08-19T12:00:00Z",
    });
    expect(filtered.json().workEvents).toHaveLength(1);

    const one = await app.inject({
      method: "GET",
      url: "/v1/work-events/pr-acme-web-42",
    });
    expect(one.statusCode).toBe(200);
    expect(one.json().workEvent.id).toBe("pr-acme-web-42");
    expect(one.json().claims.length).toBeGreaterThan(0);

    await app.close();
  });

  it("emite claims estructurados en el resumen por PR", async () => {
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: structuredLlm,
    });
    const create = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    const written = await readFile(create.json().filePath, "utf8");
    expect(written).toContain("## Qué se hizo");
    expect(written).toContain("## Decisiones");
    expect(written).toContain("## Pendientes / por avanzar");
    await app.close();
  });

  it("genera el digest semanal agregando más de un evento", async () => {
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: structuredLlm,
    });

    for (const number of [42, 43]) {
      await app.inject({
        method: "POST",
        url: "/v1/documents/from-pull-request",
        payload: { repository: "acme/web", pullRequestNumber: number },
      });
    }

    const digest = await app.inject({
      method: "POST",
      url: "/v1/digests/weekly",
      payload: {
        repository: "acme/web",
        from: "2026-08-17T00:00:00Z",
        to: "2026-08-23T23:59:59Z",
      },
    });
    expect(digest.statusCode).toBe(201);
    const body = digest.json();
    expect(body.eventCount).toBe(2);
    expect(body.status).toBe("completed");

    const md = await readFile(body.filePath, "utf8");
    expect(md).toContain("# Digest semanal");
    expect(md).toContain("## Qué se hizo");
    expect(md).toContain("Se implementó la funcionalidad principal");
    expect(md).toContain("## Drift / huecos");

    await app.close();
  });
});
