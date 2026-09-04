import { loadConfig } from "../../config.js";
import { DocumentService } from "../../documents/document-service.js";
import { DocumentStore } from "../../documents/document-store.js";
import { GitHubClient } from "../../github/github-client.js";
import { OpenAICompatibleProvider } from "../../llm/openai-provider.js";
import { WorkEventStore } from "../../memory/work-event-store.js";

/** Genera documentación desde un PR de GitHub: \`mico document <owner/repo> <pr>\`. */
export async function runDocument(): Promise<void> {
  const args = process.argv.slice(2);
  const repo = args[1];
  const prNumber = parseInt(args[2] ?? "", 10);

  if (!repo || !Number.isInteger(prNumber) || prNumber <= 0) {
    console.error("\n ✗ Uso: mico document <owner/repo> <pr-number>\n");
    process.exit(1);
  }

  try {
    const config = loadConfig(process.env, process.cwd());
    if (!config.githubToken) {
      console.error("\n ✗ Se requiere GITHUB_TOKEN en .env o mico.config.json para documentar PRs.\n");
      process.exit(1);
    }

    const github = new GitHubClient(config.githubToken);
    const llm = new OpenAICompatibleProvider(config.llm);
    const store = new DocumentStore(config.documentsPath);
    const memory = new WorkEventStore(config.workEventsPath);
    const service = new DocumentService(github, llm, store, config.documentsPath, memory, {
      confidence: config.confidence,
      language: config.mico.language as "es" | "en",
    });

    console.log(`\n 🐒 Documentando PR #${prNumber} de ${repo}...\n`);
    const result = await service.generateFromPullRequest({
      repository: repo,
      pullRequestNumber: prNumber,
    });

    console.log(`  ✓ Documento generado: ${result.filePath}`);
    console.log(`  ✓ Confianza: ${result.confidence.level} (score ${result.confidence.score})`);
    if (result.needsHumanReview) {
      console.log("  ⚠ Marcado para revisión humana.");
    }
    console.log("");
  } catch (error: any) {
    console.error(`\n ✗ Error al documentar el PR: ${error.message}\n`);
    process.exit(1);
  }
}
