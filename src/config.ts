import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  githubToken: z.string().min(1, "GITHUB_TOKEN es obligatorio"),
  llm: z.object({
    baseUrl: z.string().url().default("https://api.openai.com/v1"),
    apiKey: z.string().min(1, "LLM_API_KEY es obligatorio"),
    model: z.string().min(1).default("gpt-4o-mini"),
  }),
  documentsPath: z.string().min(1).default("./data/docs"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse({
    port: env.PORT,
    githubToken: env.GITHUB_TOKEN,
    llm: {
      baseUrl: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
    },
    documentsPath: env.DOCUMENTS_PATH,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuración inválida:\n${issues}`);
  }

  return parsed.data;
}
