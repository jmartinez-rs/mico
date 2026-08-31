import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { MicoAgent } from "./agent.js";
import type { AppConfig } from "../config.js";
import type { CommitInfo } from "../git/git-watcher.js";
import { AgentStateStore } from "../memory/agent-state-store.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import { DailyDocManager } from "../documents/daily-doc-manager.js";
import type { CommitAnalysisResult } from "../llm/commit-analyzer.js";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    githubToken: "",
    llm: { baseUrl: "https://api.openai.com/v1", apiKey: "test-key", model: "gpt-4o-mini" },
    documentsPath: "./data/docs",
    workEventsPath: "./data/work-events",
    mico: {
      watchIntervalMs: 10000,
      targetRepoPath: "./",
      outputDir: "./docs/mico",
      stateFile: "./data/mico-state.json",
    },
    publish: { toRepo: false, pathPrefix: "docs/mico" },
    confidence: {
      reviewThreshold: 0.5,
      highThreshold: 0.75,
      minBodyLength: 30,
      poorCommitRatio: 0.5,
      weights: {
        noBody: 0.35,
        shortBody: 0.15,
        noCommits: 0.1,
        poorCommits: 0.2,
        noFiles: 0.1,
        noDiff: 0.1,
      },
    },
    ...overrides,
  };
}

function makeCommit(overrides: Partial<CommitInfo> = {}): CommitInfo {
  return {
    hash: "1234567890abcdef1234567890abcdef12345678",
    shortHash: "1234567",
    author: "Test Dev",
    authorEmail: "test@example.com",
    date: new Date("2026-08-31T12:00:00Z"),
    dateIso: "2026-08-31T12:00:00.000Z",
    dateYYYYMMDD: "2026-08-31",
    message: "feat: implementar nueva funcionalidad",
    filesChanged: ["src/index.ts"],
    diff: "+ console.log('hello');",
    ...overrides,
  };
}

class FakeGitWatcher {
  commits: CommitInfo[] = [];
  remoteUrl: string | null = null;

  async getUnprocessedCommits(processedHashes: Set<string>): Promise<CommitInfo[]> {
    return this.commits.filter((commit) => !processedHashes.has(commit.hash));
  }

  async getRemoteUrl(): Promise<string | null> {
    return this.remoteUrl;
  }
}

class FakeCommitAnalyzer {
  calls: string[] = [];

  async analyzeCommit(commit: CommitInfo): Promise<CommitAnalysisResult> {
    this.calls.push(commit.shortHash);
    return {
      commit,
      markdownAnalysis: "### Resumen Ejecutivo\nAnálisis fake.",
      processedAt: new Date().toISOString(),
    };
  }
}

describe("MicoAgent", () => {
  let tempDir: string;
  let gitWatcher: FakeGitWatcher;
  let analyzer: FakeCommitAnalyzer;
  let stateStore: AgentStateStore;
  let workEventStore: WorkEventStore;
  let dailyDocManager: DailyDocManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-agent-test-"));
    gitWatcher = new FakeGitWatcher();
    analyzer = new FakeCommitAnalyzer();
    stateStore = new AgentStateStore(path.join(tempDir, "state.json"));
    workEventStore = new WorkEventStore(path.join(tempDir, "work-events"));
    dailyDocManager = new DailyDocManager(path.join(tempDir, "docs"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function buildAgent(config: AppConfig = makeConfig()): MicoAgent {
    return new MicoAgent(config, {
      gitWatcher,
      stateStore,
      commitAnalyzer: analyzer,
      workEventStore,
      dailyDocManager,
    });
  }

  it("procesa commits nuevos: documenta, persiste work-event y marca estado", async () => {
    gitWatcher.commits = [makeCommit()];
    gitWatcher.remoteUrl = "git@github.com:owner/repo.git";

    const agent = buildAgent();
    await agent.tick();

    // Estado: el commit quedó marcado como procesado
    expect(stateStore.has("1234567890abcdef1234567890abcdef12345678")).toBe(true);

    // Documento diario escrito
    const docPath = path.join(tempDir, "docs", "2026-08-31.md");
    const doc = await fs.readFile(docPath, "utf-8");
    expect(doc).toContain("Commit `1234567`");

    // Memoria de work-events: evento persistido con repository derivado del remote
    const events = await workEventStore.list();
    expect(events.length).toBe(1);
    const stored = events[0]!;
    expect(stored.workEvent.repository).toBe("owner/repo");
    expect(stored.workEvent.type).toBe("commit");
    expect(stored.workEvent.title).toBe("feat: implementar nueva funcionalidad");
    expect(stored.evidence[0]!.kind).toBe("commit");
    expect(stored.evidence[0]!.url).toBe(
      "https://github.com/owner/repo/commit/1234567890abcdef1234567890abcdef12345678",
    );
    expect(stored.confidence.score).toBeGreaterThan(0);
    expect(stored.needsHumanReview).toBe(false);
  });

  it("no reprocesa commits ya marcados como procesados", async () => {
    gitWatcher.commits = [makeCommit()];
    const agent = buildAgent();

    await agent.tick();
    await agent.tick();

    expect(analyzer.calls.length).toBe(1);
    const events = await workEventStore.list();
    expect(events.length).toBe(1);
  });

  it("usa repository local/<basename> cuando no hay remote origin", async () => {
    gitWatcher.commits = [makeCommit()];
    gitWatcher.remoteUrl = null;

    const agent = buildAgent(makeConfig({ mico: { ...makeConfig().mico, targetRepoPath: "/tmp/mi-repo" } }));
    await agent.tick();

    const events = await workEventStore.list();
    expect(events[0]!.workEvent.repository).toBe("local/mi-repo");
  });

  it("marca revisión humana para commits con señal pobre", async () => {
    gitWatcher.commits = [
      makeCommit({ message: "wip", filesChanged: [], diff: "" }),
    ];
    const agent = buildAgent();
    await agent.tick();

    const events = await workEventStore.list();
    expect(events[0]!.needsHumanReview).toBe(true);
    expect(events[0]!.confidence.level).toBe("low");
  });
});