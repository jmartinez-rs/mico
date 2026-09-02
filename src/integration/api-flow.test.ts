/**
 * Test de integración de la API REST: servidor Fastify real + stores reales.
 *
 * Verifica el flujo completo: daemon persiste work-events → la API los expone
 * → el digest semanal se genera desde la memoria local.
 *
 * El LLM es fake por defecto (ver helpers.ts). Para correr con el LLM real:
 *   MICO_INTEGRATION_REAL_LLM=1 npx vitest run src/integration/api-flow.test.ts
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MicoAgent } from "../agent/agent.js";
import { GitWatcher } from "../git/git-watcher.js";
import { AgentStateStore } from "../memory/agent-state-store.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import type { StoredWorkEvent } from "../memory/work-event-store.js";
import { DailyDocManager } from "../documents/daily-doc-manager.js";
import { CommitAnalyzer } from "../llm/commit-analyzer.js";
import { buildServer } from "../server.js";
import {
  cleanup,
  createTempGitRepo,
  makeIntegrationConfig,
  makeLlm,
} from "./helpers.js";

describe("API REST (integración, server real)", () => {
  let repoDir: string;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mico-int-api-"));
  });

  afterEach(async () => {
    await cleanup(repoDir);
    await cleanup(dataDir);
  });

  async function buildApp() {
    const config = makeIntegrationConfig({ repoDir, dataDir });
    return buildServer(config, { llm: makeLlm() });
  }

  /** Persiste un work-event directamente (como haría el daemon). */
  async function seedWorkEvent(repository: string, title: string) {
    const memory = new WorkEventStore(join(dataDir, "work-events"));
    const id = `commit-${repository.replace("/", "-")}-abc1234`;
    const stored: StoredWorkEvent = {
      workEvent: {
        id,
        type: "commit",
        repository,
        title,
        author: "Test Dev",
        url: `https://github.com/${repository}/commit/abc1234`,
        occurredAt: new Date().toISOString(),
        evidenceIds: [`evidence-${id}-commit`],
      },
      evidence: [
        {
          id: `evidence-${id}-commit`,
          kind: "commit",
          label: `abc1234 — ${title}`,
          url: `https://github.com/${repository}/commit/abc1234`,
          detail: title,
        },
      ],
      claims: [
        {
          id: `claim-${id}-narrative`,
          category: "narrative",
          text: title,
          confidence: { score: 1, level: "high", reasons: ["Señal fuerte."] },
          evidenceIds: [`evidence-${id}-commit`],
        },
      ],
      confidence: { score: 1, level: "high", reasons: ["Señal fuerte."] },
      needsHumanReview: false,
      narrative: title,
      storedAt: new Date().toISOString(),
    };
    await memory.save(stored);
  }

  it("GET /health responde ok", async () => {
    const repo = await createTempGitRepo(["feat: base"]);
    repoDir = repo.dir;
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
    await app.close();
  });

  it("expone los work-events persistidos por el daemon", async () => {
    const repo = await createTempGitRepo(["feat: commit visible en API"]);
    repoDir = repo.dir;

    // Flujo real del daemon
    const config = makeIntegrationConfig({ repoDir, dataDir });
    const agent = new MicoAgent(config, {
      gitWatcher: new GitWatcher(repoDir),
      stateStore: new AgentStateStore(config.mico.stateFile),
      commitAnalyzer: new CommitAnalyzer(makeLlm()),
      dailyDocManager: new DailyDocManager(config.mico.outputDir),
      workEventStore: new WorkEventStore(config.workEventsPath),
    });
    await agent.tick();

    // La API lee la misma memoria
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/work-events" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.workEvents.length).toBe(1);
    expect(body.workEvents[0].workEvent.title).toBe("feat: commit visible en API");
    // El commit (sin body) recibe penalización por noBody => score < 1, pero
    // supera el umbral de revisión => no se marca para revisión humana.
    expect(body.workEvents[0].confidence.score).toBeGreaterThan(0);
    expect(body.workEvents[0].confidence.score).toBeLessThan(1);
    expect(body.workEvents[0].needsHumanReview).toBe(false);
    await app.close();
  });

  it("POST /v1/digests/weekly genera el digest desde la memoria local", async () => {
    const repo = await createTempGitRepo(["feat: base"]);
    repoDir = repo.dir;
    await seedWorkEvent("acme/eaos-app", "feat: tarea de la semana");

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/digests/weekly",
      payload: { repository: "acme/eaos-app" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("completed");
    expect(body.eventCount).toBe(1);
    expect(body.weekLabel).toMatch(/^\d{4}-W\d{1,2}$/);
    expect(body.needsHumanReview).toBe(false);

    const digest = await readFile(body.filePath, "utf-8");
    expect(digest).toContain("feat: tarea de la semana");
    expect(digest).toContain("acme/eaos-app");
    await app.close();
  });

  it("GET /v1/documents lista los documentos generados", async () => {
    const repo = await createTempGitRepo(["feat: base"]);
    repoDir = repo.dir;
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/documents" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ documents: [] });
    await app.close();
  });
});