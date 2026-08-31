import { LLMProvider } from "./provider.js";
import { CommitInfo } from "../git/git-watcher.js";
import { buildCommitAnalysisPrompt } from "./commit-analyzer-prompt.js";

export interface CommitAnalysisResult {
  commit: CommitInfo;
  markdownAnalysis: string;
  processedAt: string;
}

export class CommitAnalyzer {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Analiza un commit utilizando el proveedor LLM.
   */
  async analyzeCommit(commit: CommitInfo): Promise<CommitAnalysisResult> {
    const { system, prompt } = buildCommitAnalysisPrompt(commit);

    try {
      const markdownAnalysis = await this.llmProvider.generate({ system, prompt });
      return {
        commit,
        markdownAnalysis: markdownAnalysis.trim(),
        processedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`[Mico CommitAnalyzer] Error al invocar LLM para commit ${commit.shortHash}:`, error.message);
      // Fallback narrativo si falla el LLM
      const fallbackAnalysis = `### Resumen Ejecutivo\nCommit \`${commit.shortHash}\` de ${commit.author}: *${commit.message.split("\n")[0]}*\n\n### Cambios Realizados\n${commit.filesChanged.map((f) => `- Archivo modificado: \`${f}\``).join("\n")}\n\n*(Nota: Análisis simplificado generado automáticamente por contingencia)*`;
      
      return {
        commit,
        markdownAnalysis: fallbackAnalysis,
        processedAt: new Date().toISOString(),
      };
    }
  }
}
