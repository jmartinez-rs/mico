import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import { DigestService } from "./documents/digest-service.js";
import { DocumentService } from "./documents/document-service.js";
import { DocumentStore } from "./documents/document-store.js";
import { GitHubClient } from "./github/github-client.js";
import {
  GitHubRepoPublisher,
  type RepoPublisher,
} from "./github/repo-publisher.js";
import { OpenAICompatibleProvider } from "./llm/openai-provider.js";
import type { LLMProvider } from "./llm/provider.js";
import { WorkEventStore } from "./memory/work-event-store.js";
import { registerDigestRoutes } from "./routes/digests.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWorkEventRoutes } from "./routes/work-events.js";

export interface BuildServerDeps {
  github?: GitHubClient;
  llm?: LLMProvider;
  publisher?: RepoPublisher;
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
  const publisher = deps.publisher ?? new GitHubRepoPublisher(config.githubToken);
  const store = new DocumentStore(config.documentsPath);
  const memory = new WorkEventStore(config.workEventsPath);
  const service = new DocumentService(
    github,
    llm,
    store,
    config.documentsPath,
    memory,
    { confidence: config.confidence, publisher, publish: config.publish },
  );
  const digestService = new DigestService(memory, llm, config.documentsPath, {
    confidence: config.confidence,
    publisher,
    publish: config.publish,
  });

  await registerHealthRoutes(app);
  await registerDocumentRoutes(app, service);
  await registerWorkEventRoutes(app, memory);
  await registerDigestRoutes(app, digestService);

  return app;
}
