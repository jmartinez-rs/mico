import { loadConfig } from "../../config.js";
import { DigestService } from "../../documents/digest-service.js";
import { OpenAICompatibleProvider } from "../../llm/openai-provider.js";
import { WorkEventStore } from "../../memory/work-event-store.js";

/** Genera el digest semanal desde la memoria local: \`mico digest [--repo] [--from] [--to]\`. */
export async function runDigest(): Promise<void> {
  const args = process.argv.slice(2);
  const repoFlag = args.indexOf("--repo");
  const fromFlag = args.indexOf("--from");
  const toFlag = args.indexOf("--to");

  const repository = repoFlag >= 0 ? args[repoFlag + 1] : undefined;
  const from = fromFlag >= 0 ? args[fromFlag + 1] : undefined;
  const to = toFlag >= 0 ? args[toFlag + 1] : undefined;

  if (!repository) {
    console.error("\n ✗ Uso: mico digest --repo <owner/repo> [--from YYYY-MM-DD] [--to YYYY-MM-DD]\n");
    process.exit(1);
  }

  try {
    const config = loadConfig(process.env, process.cwd());
    const llm = new OpenAICompatibleProvider(config.llm);
    const memory = new WorkEventStore(config.workEventsPath);
    const service = new DigestService(memory, llm, config.documentsPath, {
      confidence: config.confidence,
    });

    console.log(`\n 🐒 Generando digest semanal de ${repository}...\n`);
    const result = await service.generateWeekly({ repository, from, to });

    console.log(`  ✓ Digest generado: ${result.filePath}`);
    console.log(`  ✓ Semana: ${result.weekLabel} (${result.eventCount} evento(s))`);
    console.log(`  ✓ Confianza: ${result.confidence.level} (score ${result.confidence.score})`);
    if (result.needsHumanReview) {
      console.log("  ⚠ Marcado para revisión humana.");
    }
    console.log("");
  } catch (error: any) {
    console.error(`\n ✗ Error al generar el digest: ${error.message}\n`);
    process.exit(1);
  }
}
