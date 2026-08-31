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

const samplePr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer",
  author: "jose",
  state: "open",
  url: "https://github.com/acme/web/pull/42",
  baseBranch: "main",
  headBranch: "feature/cache",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: null,
  commits: [
    { sha: "abc1234", message: "Add cache", author: "jose", url: "https://x/1" },
  ],
  files: [
    {
      filename: "src/cache.ts",
      status: "added",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: "+ cache",
    },
  ],
  reviews: [],
};

const fakeGithub = {
  getPullRequest: async () => samplePr,
} as unknown as GitHubClient;

const fakeLlm: LLMProvider = {
  generate: async () => "## Resumen\nSe agregó una capa de caché.",
};

let documentsPath: string;

function makeConfig(): AppConfig {
  return {
    port: 0,
    githubToken: "token",
    llm: { baseUrl: "https://x/v1", apiKey: "key", model: "m" },
    documentsPath,
    workEventsPath: join(documentsPath, "work-events"),
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
  documentsPath = await mkdtemp(join(tmpdir(), "wd-test-"));
});

afterEach(async () => {
  await rm(documentsPath, { recursive: true, force: true });
});

describe("documents routes", () => {
  it("GET /health responde ok", async () => {
    const app = await buildServer(makeConfig(), { github: fakeGithub, llm: fakeLlm });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
    await app.close();
  });

  it("genera un documento desde un PR y lo lista", async () => {
    const app = await buildServer(makeConfig(), { github: fakeGithub, llm: fakeLlm });

    const create = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    expect(create.statusCode).toBe(201);
    const body = create.json();
    expect(body.status).toBe("completed");
    expect(body.filePath).toContain("42-feature-cache.md");
    expect(body.confidence).toMatchObject({ level: expect.any(String) });
    expect(typeof body.needsHumanReview).toBe("boolean");

    const written = await readFile(body.filePath, "utf8");
    expect(written).toContain("# Add caching");
    expect(written).toContain("Se agregó una capa de caché.");
    expect(written).toContain("## Confianza");

    const list = await app.inject({ method: "GET", url: "/v1/documents" });
    expect(list.json().documents).toHaveLength(1);

    const get = await app.inject({ method: "GET", url: `/v1/documents/${body.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().pullRequestNumber).toBe(42);

    await app.close();
  });

  it("valida el formato del repositorio", async () => {
    const app = await buildServer(makeConfig(), { github: fakeGithub, llm: fakeLlm });
    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "invalid", pullRequestNumber: 1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
