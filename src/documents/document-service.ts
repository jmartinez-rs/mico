import { randomUUID } from "node:crypto";
import type { GitHubClient } from "../github/github-client.js";
import type { LLMProvider } from "../llm/provider.js";
import { SYSTEM_PROMPT, buildPrompt } from "../llm/prompt.js";
import type { DocumentGenerationResult, GeneratedDocument } from "../models/index.js";
import type { DocumentStore } from "./document-store.js";
import {
  buildDocumentPath,
  buildMarkdown,
  writeDocument,
} from "./markdown-writer.js";

export interface GenerateFromPullRequestInput {
  repository: string;
  pullRequestNumber: number;
}

export class DocumentService {
  constructor(
    private readonly github: GitHubClient,
    private readonly llm: LLMProvider,
    private readonly store: DocumentStore,
    private readonly documentsPath: string,
  ) {}

  async generateFromPullRequest(
    input: GenerateFromPullRequestInput,
  ): Promise<DocumentGenerationResult> {
    const pr = await this.github.getPullRequest(
      input.repository,
      input.pullRequestNumber,
    );

    const prompt = buildPrompt(pr);
    const body = await this.llm.generate({ system: SYSTEM_PROMPT, prompt });

    const markdown = buildMarkdown(pr, body);
    const filePath = buildDocumentPath(this.documentsPath, pr);
    await writeDocument(filePath, markdown);

    const document: GeneratedDocument = {
      id: randomUUID(),
      repository: pr.repository,
      pullRequestNumber: pr.number,
      title: pr.title,
      filePath,
      createdAt: new Date().toISOString(),
    };
    await this.store.save(document);

    return {
      status: "completed",
      id: document.id,
      filePath,
      documentUrl: null,
    };
  }

  listDocuments(): Promise<GeneratedDocument[]> {
    return this.store.list();
  }

  getDocument(id: string): Promise<GeneratedDocument | undefined> {
    return this.store.get(id);
  }
}
