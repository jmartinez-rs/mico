import { randomUUID } from "node:crypto";
import {
  DEFAULT_CONFIDENCE_CONFIG,
  computeConfidence,
  needsHumanReview,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import { mapPullRequestToWorkEvent } from "../domain/pr-mapper.js";
import type { WorkEventDocumentView } from "../domain/work-event.js";
import type { GitHubClient } from "../github/github-client.js";
import type { LLMProvider } from "../llm/provider.js";
import type { StoredWorkEvent, WorkEventStore } from "../memory/work-event-store.js";
import type {
  DocumentGenerationResult,
  GeneratedDocument,
  PullRequestData,
} from "../domain/types.js";
import { extractClaims } from "./claim-extractor.js";
import type { DocumentStore } from "./document-store.js";
import {
  buildDocumentPath,
  renderWorkEventDocument,
  writeDocument,
} from "./markdown-writer.js";

export interface GenerateFromPullRequestInput {
  repository: string;
  pullRequestNumber: number;
}

export interface DocumentServiceOptions {
  confidence?: ConfidenceConfig;
}

export class DocumentService {
  private readonly confidenceConfig: ConfidenceConfig;

  constructor(
    private readonly github: GitHubClient,
    private readonly llm: LLMProvider,
    private readonly store: DocumentStore,
    private readonly documentsPath: string,
    private readonly memory: WorkEventStore,
    options: DocumentServiceOptions = {},
  ) {
    this.confidenceConfig = options.confidence ?? DEFAULT_CONFIDENCE_CONFIG;
  }

  async generateFromPullRequest(
    input: GenerateFromPullRequestInput,
  ): Promise<DocumentGenerationResult> {
    const pr = await this.github.getPullRequest(
      input.repository,
      input.pullRequestNumber,
    );

    // Núcleo Opción B: la señal cruda se traduce al modelo (evento + evidencia)
    // y la confianza se calcula antes de renderizar la vista (ADR-0002).
    const { workEvent, evidence } = mapPullRequestToWorkEvent(pr);
    const confidence = computeConfidence(pr, this.confidenceConfig);
    const humanReview = needsHumanReview(
      confidence,
      this.confidenceConfig.reviewThreshold,
    );

    // Incremento B: el LLM extrae claims estructurados (qué se hizo /
    // decisiones / pendientes). Si el parseo JSON falla, se degrada a un claim
    // narrativo único (comportamiento previo) sin romper el flujo.
    const { claims, narrative } = await extractClaims({
      llm: this.llm,
      pr,
      workEventId: workEvent.id,
      evidence,
      confidence,
    });

    const view: WorkEventDocumentView = {
      workEvent,
      evidence,
      claims,
      confidence,
      needsHumanReview: humanReview,
      narrative,
    };

    const markdown = renderWorkEventDocument(view);
    const filePath = buildDocumentPath(this.documentsPath, pr);
    await writeDocument(filePath, markdown);

    // Incremento A: persistir el evento + evidencia (+ claims/confianza) en la
    // memoria consultable. Idempotente: procesar el mismo PR no duplica.
    const stored: StoredWorkEvent = {
      workEvent,
      evidence,
      claims,
      confidence,
      needsHumanReview: humanReview,
      narrative,
      storedAt: new Date().toISOString(),
    };
    await this.memory.save(stored);

    const document: GeneratedDocument = {
      id: randomUUID(),
      repository: pr.repository,
      pullRequestNumber: pr.number,
      title: pr.title,
      filePath,
      createdAt: new Date().toISOString(),
      confidence,
      needsHumanReview: humanReview,
    };
    await this.store.save(document);

    return {
      status: "completed",
      id: document.id,
      filePath,
      documentUrl: null,
      confidence,
      needsHumanReview: humanReview,
    };
  }

  listDocuments(): Promise<GeneratedDocument[]> {
    return this.store.list();
  }

  getDocument(id: string): Promise<GeneratedDocument | undefined> {
    return this.store.get(id);
  }
}
