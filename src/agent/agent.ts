import { AppConfig } from "../config.js";
import { GitWatcher } from "../git/git-watcher.js";
import { AgentStateStore } from "../memory/agent-state-store.js";
import { OpenAIProvider } from "../llm/openai-provider.js";
import { CommitAnalyzer } from "../llm/commit-analyzer.js";
import { DailyDocManager } from "../documents/daily-doc-manager.js";

export class MicoAgent {
  private config: AppConfig;
  private gitWatcher: GitWatcher;
  private stateStore: AgentStateStore;
  private commitAnalyzer: CommitAnalyzer;
  private dailyDocManager: DailyDocManager;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isTickBusy: boolean = false;

  constructor(config: AppConfig) {
    this.config = config;

    this.gitWatcher = new GitWatcher(config.mico.targetRepoPath);
    this.stateStore = new AgentStateStore(config.mico.stateFile);

    const llmProvider = new OpenAIProvider(config.llm);
    this.commitAnalyzer = new CommitAnalyzer(llmProvider);
    this.dailyDocManager = new DailyDocManager(config.mico.outputDir);
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

        for (const commit of newCommits) {
          console.log(`[Mico] 🔍 Analizando commit ${commit.shortHash}: "${commit.message.split("\n")[0]}"`);
          
          // Analizar con LLM
          const analysis = await this.commitAnalyzer.analyzeCommit(commit);

          // Escribir en documento diario Markdown
          const docPath = await this.dailyDocManager.appendCommitAnalysis(analysis);
          console.log(`[Mico] 📝 Documentado en ${docPath}`);

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
