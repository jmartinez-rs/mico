import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import { DocumentService } from "./documents/document-service.js";
import { DocumentStore } from "./documents/document-store.js";
import { GitHubClient } from "./github/github-client.js";
import { OpenAICompatibleProvider } from "./llm/openai-provider.js";
import type { LLMProvider } from "./llm/provider.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";

export interface BuildServerDeps {
  github?: GitHubClient;
  llm?: LLMProvider;
}

export async function buildServer(
  config: AppConfig,
  deps: BuildServerDeps = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  const github = deps.github ?? new GitHubClient(config.githubToken);
  const llm =
    deps.llm ??
    new OpenAICompatibleProvider({
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
      model: config.llm.model,
    });
  const store = new DocumentStore(config.documentsPath);
  const service = new DocumentService(github, llm, store, config.documentsPath);

  await registerHealthRoutes(app);
  await registerDocumentRoutes(app, service);

  return app;
}
