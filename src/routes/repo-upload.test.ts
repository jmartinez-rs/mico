import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config.js";
import { DEFAULT_CONFIDENCE_CONFIG } from "../domain/confidence.js";
import type { GitHubClient } from "../github/github-client.js";
import {
  RepoPublishError,
  type PublishFileInput,
  type RepoPublishResult,
  type RepoPublisher,
} from "../github/repo-publisher.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PullRequestData } from "../models/index.js";
import { buildServer } from "../server.js";

const samplePr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer suficientemente descriptivo para la señal.",
  author: "jose",
  state: "closed",
  url: "https://github.com/acme/web/pull/42",
  baseBranch: "main",
  headBranch: "feature/cache",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: "2026-08-19T00:00:00Z",
  commits: [
    { sha: "abc1234", message: "Add cache layer", author: "jose", url: "https://x/1" },
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

/** Fake que registra las llamadas para verificar rutas/contenido. */
class FakeRepoPublisher implements RepoPublisher {
  readonly calls: PublishFileInput[] = [];

  async publishFile(input: PublishFileInput): Promise<RepoPublishResult> {
    this.calls.push(input);
    return {
      committed: true,
      path: input.path,
      url: `https://github.com/${input.repository}/blob/main/${input.path}`,
      commitSha: "deadbeef",
      branch: input.branch,
    };
  }
}

/** Fake que siempre falla, para verificar la subida best-effort. */
class FailingRepoPublisher implements RepoPublisher {
  readonly calls: PublishFileInput[] = [];

  async publishFile(input: PublishFileInput): Promise<RepoPublishResult> {
    this.calls.push(input);
    throw new RepoPublishError(
      `Error publicando en el repo "${input.repository}": boom`,
      502,
    );
  }
}

let documentsPath: string;
let workEventsPath: string;

function makeConfig(overrides: Partial<AppConfig["publish"]> = {}): AppConfig {
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
    publish: { toRepo: false, pathPrefix: "docs/mico", ...overrides },
    confidence: DEFAULT_CONFIDENCE_CONFIG,
  };
}

beforeEach(async () => {
  documentsPath = await mkdtemp(join(tmpdir(), "wd-upload-docs-"));
  workEventsPath = await mkdtemp(join(tmpdir(), "wd-upload-mem-"));
});

afterEach(async () => {
  await rm(documentsPath, { recursive: true, force: true });
  await rm(workEventsPath, { recursive: true, force: true });
});

describe("subida del Markdown al repo (documento por PR)", () => {
  it("sube cuando uploadToRepo=true y responde repoUpload.committed", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42, uploadToRepo: true },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.repoUpload).toMatchObject({
      committed: true,
      path: "docs/mico/pull-requests/42-feature-cache.md",
    });
    expect(body.repoUpload.url).toBeTruthy();

    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0]).toMatchObject({
      repository: "acme/web",
      path: "docs/mico/pull-requests/42-feature-cache.md",
    });
    expect(publisher.calls[0]?.content).toContain("# Add caching");

    await app.close();
  });

  it("NO sube por defecto (uploadToRepo ausente) y no incluye repoUpload", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().repoUpload).toBeUndefined();
    expect(publisher.calls).toHaveLength(0);

    await app.close();
  });

  it("sube por default global de config (PUBLISH_TO_REPO)", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig({ toRepo: true }), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().repoUpload.committed).toBe(true);
    expect(publisher.calls).toHaveLength(1);

    await app.close();
  });

  it("el flag del request tiene prioridad sobre el default (false apaga)", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig({ toRepo: true }), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42, uploadToRepo: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().repoUpload).toBeUndefined();
    expect(publisher.calls).toHaveLength(0);

    await app.close();
  });

  it("best-effort: si la subida falla, responde 201 con committed:false y no rompe el request", async () => {
    const publisher = new FailingRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42, uploadToRepo: true },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // El resto de la respuesta sigue intacta (salida local es el flujo principal).
    expect(body.status).toBe("completed");
    expect(body.filePath).toContain("42-feature-cache.md");
    expect(body.repoUpload).toMatchObject({
      committed: false,
      path: "docs/mico/pull-requests/42-feature-cache.md",
    });
    expect(typeof body.repoUpload.error).toBe("string");
    expect(body.repoUpload.url).toBeUndefined();
    expect(publisher.calls).toHaveLength(1);

    await app.close();
  });

  it("usa PUBLISH_REPO como destino cuando está configurado", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(
      makeConfig({ toRepo: true, repo: "acme/docs-mirror" }),
      { github: fakeGithub, llm: fakeLlm, publisher },
    );

    await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
    expect(publisher.calls[0]?.repository).toBe("acme/docs-mirror");

    await app.close();
  });
});

describe("subida del Markdown al repo (digest semanal)", () => {
  async function seedEvent(app: Awaited<ReturnType<typeof buildServer>>) {
    await app.inject({
      method: "POST",
      url: "/v1/documents/from-pull-request",
      payload: { repository: "acme/web", pullRequestNumber: 42 },
    });
  }

  it("sube cuando uploadToRepo=true y responde repoUpload con la ruta del digest", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });
    await seedEvent(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/digests/weekly",
      payload: {
        repository: "acme/web",
        from: "2026-08-17T00:00:00Z",
        to: "2026-08-23T23:59:59Z",
        uploadToRepo: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.repoUpload).toMatchObject({ committed: true });
    expect(body.repoUpload.path).toContain("docs/mico/digests/acme-web-");
    expect(body.repoUpload.path.endsWith(".md")).toBe(true);

    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0]?.content).toContain("# Digest semanal");

    await app.close();
  });

  it("best-effort: si la subida del digest falla, responde 201 con committed:false", async () => {
    const publisher = new FailingRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });
    await seedEvent(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/digests/weekly",
      payload: {
        repository: "acme/web",
        from: "2026-08-17T00:00:00Z",
        to: "2026-08-23T23:59:59Z",
        uploadToRepo: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // El resto de la respuesta sigue intacta (el .md local ya se escribió).
    expect(body.status).toBe("completed");
    expect(body.filePath).toBeTruthy();
    expect(body.repoUpload).toMatchObject({ committed: false });
    expect(body.repoUpload.path).toContain("docs/mico/digests/acme-web-");
    expect(typeof body.repoUpload.error).toBe("string");
    expect(publisher.calls).toHaveLength(1);

    await app.close();
  });

  it("NO sube el digest por defecto y no incluye repoUpload", async () => {
    const publisher = new FakeRepoPublisher();
    const app = await buildServer(makeConfig(), {
      github: fakeGithub,
      llm: fakeLlm,
      publisher,
    });
    await seedEvent(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/digests/weekly",
      payload: {
        repository: "acme/web",
        from: "2026-08-17T00:00:00Z",
        to: "2026-08-23T23:59:59Z",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().repoUpload).toBeUndefined();
    expect(publisher.calls).toHaveLength(0);

    await app.close();
  });
});
