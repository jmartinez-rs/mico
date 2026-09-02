import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitHubClient } from "../github/github-client.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PullRequestData } from "../models/index.js";
import { DocumentStore } from "./document-store.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import { DocumentService } from "./document-service.js";

const samplePr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer to the API",
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
      patch: "+ export const cache = {}",
    },
  ],
  reviews: [],
};

const fakeGithub = {
  getPullRequest: async () => samplePr,
} as unknown as GitHubClient;

/** LLM fake que devuelve claims JSON estructurados. */
const fakeLlm: LLMProvider = {
  generate: async () =>
    JSON.stringify({
      overview: "Se agregó una capa de caché a la API.",
      did: ["Implementar cache layer"],
      decisions: ["Usar caché en memoria"],
      pending: [],
    }),
};

describe("DocumentService", () => {
  let tempDir: string;
  let store: DocumentStore;
  let memory: WorkEventStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mico-docsvc-test-"));
    store = new DocumentStore(join(tempDir, "docs"));
    memory = new WorkEventStore(join(tempDir, "work-events"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("genera un documento desde un PR: escribe .md, persiste work-event e indexa", async () => {
    const service = new DocumentService(
      fakeGithub,
      fakeLlm,
      store,
      join(tempDir, "docs"),
      memory,
    );

    const result = await service.generateFromPullRequest({
      repository: "acme/web",
      pullRequestNumber: 42,
    });

    expect(result.status).toBe("completed");
    expect(result.filePath).toContain("42-feature-cache.md");
    expect(result.confidence.level).toBe("high");

    // Documento escrito con el contenido del LLM
    const written = await readFile(result.filePath, "utf-8");
    expect(written).toContain("# Add caching");
    expect(written).toContain("Se agregó una capa de caché a la API.");

    // Work-event persistido en memoria
    const events = await memory.list({ repository: "acme/web" });
    expect(events.length).toBe(1);
    expect(events[0]!.workEvent.title).toBe("Add caching");
    expect(events[0]!.claims.length).toBeGreaterThan(0);

    // Documento indexado
    const docs = await store.list();
    expect(docs.length).toBe(1);
    expect(docs[0]!.pullRequestNumber).toBe(42);
  });

  it("es idempotente: procesar el mismo PR no duplica el work-event", async () => {
    const service = new DocumentService(
      fakeGithub,
      fakeLlm,
      store,
      join(tempDir, "docs"),
      memory,
    );

    await service.generateFromPullRequest({
      repository: "acme/web",
      pullRequestNumber: 42,
    });
    await service.generateFromPullRequest({
      repository: "acme/web",
      pullRequestNumber: 42,
    });

    const events = await memory.list({ repository: "acme/web" });
    expect(events.length).toBe(1);
  });

  it("listDocuments y getDocument exponen los documentos generados", async () => {
    const service = new DocumentService(
      fakeGithub,
      fakeLlm,
      store,
      join(tempDir, "docs"),
      memory,
    );

    const result = await service.generateFromPullRequest({
      repository: "acme/web",
      pullRequestNumber: 42,
    });

    const docs = await service.listDocuments();
    expect(docs.length).toBe(1);

    const doc = await service.getDocument(result.id);
    expect(doc?.title).toBe("Add caching");
  });
});