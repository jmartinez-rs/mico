import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "path";

loadEnv();

const configSchema = z.object({
  githubToken: z.string().optional().default(""),
  llm: z.object({
    baseUrl: z.string().url().default("https://api.openai.com/v1"),
    apiKey: z.string().min(1, "LLM_API_KEY es obligatorio"),
    model: z.string().min(1).default("gpt-4o-mini"),
  }),
  documentsPath: z.string().min(1).default("./data/docs"),
  workEventsPath: z.string().min(1).default("./data/work-events"),
  mico: z.object({
    language: z.enum(["es", "en"]).default("es"),
    watchIntervalMs: z.coerce.number().int().positive().default(10000),
    targetRepoPath: z.string().min(1).default("./"),
    outputDir: z.string().min(1).default("./docs/mico").transform(val => {
      if (path.basename(val).toLowerCase() !== "mico") {
        return path.join(val, "mico");
      }
      return val;
    }),
    stateFile: z.string().min(1).default("./data/mico-state.json"),
  }),
  confidence: z.object({
    reviewThreshold: z.coerce.number().min(0).max(1).default(0.5),
    highThreshold: z.coerce.number().min(0).max(1).default(0.75),
    minBodyLength: z.coerce.number().int().nonnegative().default(30),
    poorCommitRatio: z.coerce.number().min(0).max(1).default(0.5),
    weights: z.object({
      noBody: z.coerce.number().min(0).max(1).default(0.35),
      shortBody: z.coerce.number().min(0).max(1).default(0.15),
      noCommits: z.coerce.number().min(0).max(1).default(0.1),
      poorCommits: z.coerce.number().min(0).max(1).default(0.2),
      noFiles: z.coerce.number().min(0).max(1).default(0.1),
      noDiff: z.coerce.number().min(0).max(1).default(0.1),
    }),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;
export type MicoConfig = AppConfig["mico"];

import fs from "fs";

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): AppConfig {
  let fileConfig: Record<string, any> = {};
  const configJsonPath = path.join(cwd, "mico.config.json");

  if (fs.existsSync(configJsonPath)) {
    try {
      const raw = fs.readFileSync(configJsonPath, "utf-8");
      fileConfig = JSON.parse(raw);
    } catch (err: any) {
      console.warn(`[Mico 🐒] Advertencia: No se pudo parsear mico.config.json: ${err.message}`);
    }
  }

  const parsed = configSchema.safeParse({
    githubToken: env.GITHUB_TOKEN ?? fileConfig.githubToken,
    llm: {
      baseUrl: env.LLM_BASE_URL ?? fileConfig.llmBaseUrl ?? fileConfig.llm?.baseUrl,
      apiKey: env.LLM_API_KEY ?? fileConfig.llmApiKey ?? fileConfig.llm?.apiKey,
      model: env.LLM_MODEL ?? fileConfig.llmModel ?? fileConfig.llm?.model,
    },
    documentsPath: env.DOCUMENTS_PATH ?? fileConfig.documentsPath,
    workEventsPath: env.WORK_EVENTS_PATH ?? fileConfig.workEventsPath,
    mico: {
      language: env.MICO_LANGUAGE ?? fileConfig.language ?? fileConfig.mico?.language,
      watchIntervalMs: env.MICO_WATCH_INTERVAL_MS ?? fileConfig.watchIntervalMs ?? fileConfig.mico?.watchIntervalMs,
      targetRepoPath: env.MICO_TARGET_REPO_PATH ?? fileConfig.targetRepoPath ?? fileConfig.mico?.targetRepoPath,
      outputDir: env.MICO_OUTPUT_DIR ?? fileConfig.outputDir ?? fileConfig.mico?.outputDir,
      stateFile: env.MICO_STATE_FILE ?? fileConfig.stateFile ?? fileConfig.mico?.stateFile,
    },
    confidence: {
      reviewThreshold: env.CONFIDENCE_REVIEW_THRESHOLD,
      highThreshold: env.CONFIDENCE_HIGH_THRESHOLD,
      minBodyLength: env.CONFIDENCE_MIN_BODY_LENGTH,
      poorCommitRatio: env.CONFIDENCE_POOR_COMMIT_RATIO,
      weights: {
        noBody: env.CONFIDENCE_WEIGHT_NO_BODY,
        shortBody: env.CONFIDENCE_WEIGHT_SHORT_BODY,
        noCommits: env.CONFIDENCE_WEIGHT_NO_COMMITS,
        poorCommits: env.CONFIDENCE_WEIGHT_POOR_COMMITS,
        noFiles: env.CONFIDENCE_WEIGHT_NO_FILES,
        noDiff: env.CONFIDENCE_WEIGHT_NO_DIFF,
      },
    },
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuración inválida:\n${issues}`);
  }

  return parsed.data;
}
