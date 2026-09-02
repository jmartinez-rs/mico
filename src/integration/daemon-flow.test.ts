/**
 * Test de integración del DAEMON: flujo completo con infraestructura real.
 *
 * Repo git REAL (temp) → GitWatcher real → MicoAgent.tick() → documento diario
 * real + work-event persistido + estado actualizado.
 *
 * El LLM es fake por defecto (ver helpers.ts). Para correr con el LLM real:
 *   MICO_INTEGRATION_REAL_LLM=1 npx vitest run src/integration/daemon-flow.test.ts
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MicoAgent } from "../agent/agent.js";
import { GitWatcher } from "../git/git-watcher.js";
import { AgentStateStore } from "../memory/agent-state-store.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import { DailyDocManager } from "../documents/daily-doc-manager.js";
import { CommitAnalyzer } from "../llm/commit-analyzer.js";
import {
  addCommitWithDate,
  cleanup,
  createTempGitRepo,
  makeIntegrationConfig,
  makeLlm,
  runGit,
} from "./helpers.js";

describe("MicoAgent (integración, git real)", () => {
  let repoDir: string;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mico-int-data-"));
  });

  afterEach(async () => {
    await cleanup(repoDir);
    await cleanup(dataDir);
  });

  function buildAgent() {
    const config = makeIntegrationConfig({ repoDir, dataDir });
    return new MicoAgent(config, {
      gitWatcher: new GitWatcher(repoDir),
      stateStore: new AgentStateStore(config.mico.stateFile),
      commitAnalyzer: new CommitAnalyzer(makeLlm()),
      dailyDocManager: new DailyDocManager(config.mico.outputDir),
      workEventStore: new WorkEventStore(config.workEventsPath),
    });
  }

  it("procesa un commit nuevo: escribe doc diario, persiste work-event y marca estado", async () => {
    const repo = await createTempGitRepo(["feat: primer commit de integración"]);
    repoDir = repo.dir;

    const agent = buildAgent();
    await agent.tick();

    // 1. Estado: el commit quedó marcado como procesado
    const state = new AgentStateStore(join(dataDir, "state.json"));
    const processed = await state.load();
    expect(processed.has(repo.headHash)).toBe(true);

    // 2. Documento diario escrito con el análisis
    const docsDir = join(dataDir, "docs", "mico");
    const files = await (await import("node:fs/promises")).readdir(docsDir);
    expect(files.length).toBe(1);
    const doc = await readFile(join(docsDir, files[0]!), "utf-8");
    expect(doc).toContain("feat: primer commit de integración");
    expect(doc).toContain("Análisis determinista de integración");

    // 3. Work-event persistido con repository derivado (sin remote => local/<basename>)
    const memory = new WorkEventStore(join(dataDir, "work-events"));
    const events = await memory.list();
    expect(events.length).toBe(1);
    expect(events[0]!.workEvent.title).toBe("feat: primer commit de integración");
    expect(events[0]!.workEvent.repository).toContain("local/");
  });

  it("no reprocesa commits ya marcados en el segundo tick", async () => {
    const repo = await createTempGitRepo(["feat: único commit"]);
    repoDir = repo.dir;

    const agent = buildAgent();
    await agent.tick();
    await agent.tick();

    const memory = new WorkEventStore(join(dataDir, "work-events"));
    const events = await memory.list();
    expect(events.length).toBe(1);
  });

  it("crea un documento distinto por día según la fecha del commit", async () => {
    const repo = await createTempGitRepo(["feat: commit del día 1"]);
    repoDir = repo.dir;

    // Commit con fecha del día siguiente (12:01)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowIso = tomorrow.toISOString().replace("T", " ").slice(0, 19);
    await addCommitWithDate(repoDir, "feat: commit del día 2", tomorrowIso);

    const agent = buildAgent();
    await agent.tick();

    const docsDir = join(dataDir, "docs", "mico");
    const files = await (await import("node:fs/promises")).readdir(docsDir);
    expect(files.length).toBe(2);

    const memory = new WorkEventStore(join(dataDir, "work-events"));
    const events = await memory.list();
    expect(events.length).toBe(2);
  });

  it("deriva repository owner/repo desde el remote origin", async () => {
    const repo = await createTempGitRepo(["feat: con remote"]);
    repoDir = repo.dir;
    await runGit(repoDir, ["remote", "add", "origin", "git@github.com:acme/eaos-app.git"]);

    const agent = buildAgent();
    await agent.tick();

    const memory = new WorkEventStore(join(dataDir, "work-events"));
    const events = await memory.list();
    expect(events[0]!.workEvent.repository).toBe("acme/eaos-app");
    expect(events[0]!.workEvent.url).toContain("https://github.com/acme/eaos-app/commit/");
  });
});