import { AppConfig } from "../config.js";
import path from "path";
import { GitWatcher, normalizeRemoteUrl, remoteHost } from "../git/git-watcher.js";
import { AgentStateStore } from "../memory/agent-state-store.js";
import { OpenAIProvider } from "../llm/openai-provider.js";
import { CommitAnalyzer } from "../llm/commit-analyzer.js";
import { DailyDocManager } from "../documents/daily-doc-manager.js";
import {
  computeCommitConfidence,
  needsHumanReview,
} from "../domain/confidence.js";
import type { Evidence, WorkEvent } from "../domain/work-event.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import type { StoredWorkEvent } from "../memory/work-event-store.js";
import type { CommitInfo } from "../git/git-watcher.js";

/** Dependencias inyectables (para tests); por defecto se construyen reales. */
export interface MicoAgentDeps {
  gitWatcher?: Pick<GitWatcher, "getUnprocessedCommits" | "getRemoteUrl">;
  stateStore?: AgentStateStore;
  commitAnalyzer?: Pick<CommitAnalyzer, "analyzeCommit">;
  dailyDocManager?: DailyDocManager;
  workEventStore?: WorkEventStore;
}

export class MicoAgent {
  private config: AppConfig;
  private gitWatcher: Pick<GitWatcher, "getUnprocessedCommits" | "getRemoteUrl">;
  private stateStore: AgentStateStore;
  private commitAnalyzer: Pick<CommitAnalyzer, "analyzeCommit">;
  private dailyDocManager: DailyDocManager;
  private workEventStore: WorkEventStore;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isTickBusy: boolean = false;
  /** `owner/repo` derivado del remote `origin`; fallback local si no hay remote. */
  private repositoryName: string = "local";
  /** Host del remote (para construir URLs); `null` si no hay remote. */
  private repositoryHost: string | null = null;
  private repositoryResolved: boolean = false;

  constructor(config: AppConfig, deps: MicoAgentDeps = {}) {
    this.config = config;

    this.gitWatcher = deps.gitWatcher ?? new GitWatcher(config.mico.targetRepoPath);
    this.stateStore = deps.stateStore ?? new AgentStateStore(config.mico.stateFile);
    this.commitAnalyzer =
      deps.commitAnalyzer ?? new CommitAnalyzer(new OpenAIProvider(config.llm));
    this.dailyDocManager =
      deps.dailyDocManager ?? new DailyDocManager(config.mico.outputDir);
    this.workEventStore =
      deps.workEventStore ?? new WorkEventStore(config.workEventsPath);
  }

  /**
   * Inicia el agente Mico en segundo plano.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`
 🐒 =======================================================
    MICO AGENT v0.1.0 — El agente curioso de desarrollo
 =======================================================
  📍 Repo a monitorear: ${this.config.mico.targetRepoPath}
  📁 Salida de informes: ${this.config.mico.outputDir}
  ⏱️  Intervalo de sondeo: ${this.config.mico.watchIntervalMs}ms
  🤖 Modelo LLM: ${this.config.llm.model}
 =======================================================
`);

    // Cargar commits ya procesados
    const processedCount = (await this.stateStore.load()).size;
    console.log(`[Mico] Estado cargado. ${processedCount} commit(s) previamente procesado(s).`);

    // Primera verificación inmediata
    await this.tick();

    // Iniciar loop continuo de monitoreo
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("[Mico] Error no capturado en tick:", err);
      });
    }, this.config.mico.watchIntervalMs);
  }

  /**
   * Ejecuta una única pasada de verificación y procesamiento (carga el estado
   * persistido y hace un `tick`). Ideal para `mico run-once` y el hook
   * `post-commit`: procesa los commits pendientes y finaliza de inmediato.
   */
  async runOnce(): Promise<void> {
    await this.stateStore.load();
    await this.tick();
  }

  /**
   * Ciclo individual de verificación y procesamiento de nuevos commits.
   */
  async tick(): Promise<void> {
    if (this.isTickBusy) return;
    this.isTickBusy = true;

    try {
      const processedHashes = this.stateStore.getProcessedHashes();
      const newCommits = await this.gitWatcher.getUnprocessedCommits(processedHashes);

      if (newCommits.length > 0) {
        console.log(`[Mico 🐒] Detectado(s) ${newCommits.length} nuevo(s) commit(s). Analizando...`);
        await this.resolveRepositoryName();

        for (const commit of newCommits) {
          console.log(`[Mico] 🔍 Analizando commit ${commit.shortHash}: "${commit.message.split("\n")[0]}"`);

          // Analizar con LLM
          const analysis = await this.commitAnalyzer.analyzeCommit(commit);

          // Escribir en documento diario Markdown
          const docPath = await this.dailyDocManager.appendCommitAnalysis(analysis);
          console.log(`[Mico] 📝 Documentado en ${docPath}`);

          // Persistir en la memoria de work-events (unifica daemon ↔ digests)
          await this.persistWorkEvent(commit);

          // Guardar estado
          await this.stateStore.markAsProcessed(commit.hash);
        }

        console.log(`[Mico 🐒] ¡Procesamiento completado para ${newCommits.length} commit(s)! Escuchando nuevos cambios...`);
      }
    } catch (error: any) {
      console.error("[Mico 🐒] Error durante la inspección de commits:", error.message);
    } finally {
      this.isTickBusy = false;
    }
  }

  /**
   * Resuelve (una sola vez) el nombre del repositorio `owner/repo` desde el
   * remote `origin`; si no hay remote, usa `local/<basename>`.
   */
  private async resolveRepositoryName(): Promise<void> {
    if (this.repositoryResolved) return;
    const remoteUrl = await this.gitWatcher.getRemoteUrl();
    if (remoteUrl) {
      this.repositoryName = normalizeRemoteUrl(remoteUrl);
      this.repositoryHost = remoteHost(remoteUrl);
    } else {
      this.repositoryName = `local/${path.basename(this.config.mico.targetRepoPath)}`;
    }
    this.repositoryResolved = true;
  }

  /**
   * Persiste el commit como `WorkEvent` + `Evidence` + `Confidence` en la misma
   * memoria que usa el servidor REST, de modo que los digests semanales
   * funcionen con commits locales sin depender de GitHub.
   */
  private async persistWorkEvent(commit: CommitInfo): Promise<void> {
    const repository = this.repositoryName;
    const workEventId = `commit-${slugify(repository)}-${commit.shortHash}`;
    const commitUrl = this.buildCommitUrl(commit.hash);

    const evidence: Evidence[] = [
      {
        id: `evidence-${workEventId}-commit`,
        kind: "commit",
        label: `${commit.shortHash} — ${commit.message.split("\n")[0]}`,
        url: commitUrl,
        detail: commit.message,
      },
    ];

    const confidence = computeCommitConfidence(commit, this.config.confidence);
    const humanReview = needsHumanReview(
      confidence,
      this.config.confidence.reviewThreshold,
    );

    const workEvent: WorkEvent = {
      id: workEventId,
      type: "commit",
      repository,
      title: commit.message.split("\n")[0] ?? commit.message,
      author: commit.author,
      url: commitUrl,
      occurredAt: commit.dateIso,
      evidenceIds: evidence.map((item) => item.id),
    };

    const stored: StoredWorkEvent = {
      workEvent,
      evidence,
      claims: [
        {
          id: `claim-${workEventId}-narrative`,
          category: "narrative",
          text: commit.message,
          confidence,
          evidenceIds: evidence.map((item) => item.id),
        },
      ],
      confidence,
      needsHumanReview: humanReview,
      narrative: commit.message,
      storedAt: new Date().toISOString(),
    };

    await this.workEventStore.save(stored);
  }

  /** URL del commit: `https://<host>/<owner>/<repo>/commit/<hash>` si hay remote. */
  private buildCommitUrl(hash: string): string {
    if (!this.repositoryHost) {
      return "";
    }
    return `https://${this.repositoryHost}/${this.repositoryName}/commit/${hash}`;
  }

  /**
   * Detiene el agente limpiamente.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[Mico 🐒] Agente detenido limpiamente.");
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "repo";
}