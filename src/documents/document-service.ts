import { randomUUID } from "node:crypto";
import type { PublishConfig } from "../config.js";
import {
  DEFAULT_CONFIDENCE_CONFIG,
  computeConfidence,
  needsHumanReview,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import { mapPullRequestToWorkEvent } from "../domain/pr-mapper.js";
import type { WorkEventDocumentView } from "../domain/work-event.js";
import type { GitHubClient } from "../github/github-client.js";
import {
  buildRepoDocumentPath,
  type RepoPublisher,
} from "../github/repo-publisher.js";
import type { LLMProvider } from "../llm/provider.js";
import type { StoredWorkEvent, WorkEventStore } from "../memory/work-event-store.js";
import type {
  DocumentGenerationResult,
  GeneratedDocument,
  PullRequestData,
  RepoUploadResult,
} from "../models/index.js";
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
  /** Fuerza (o inhibe) la subida al repo para este request; si se omite, usa la config. */
  uploadToRepo?: boolean;
}

export interface DocumentServiceOptions {
  confidence?: ConfidenceConfig;
  publisher?: RepoPublisher;
  publish?: PublishConfig;
}

export class DocumentService {
  private readonly confidenceConfig: ConfidenceConfig;
  private readonly publisher?: RepoPublisher;
  private readonly publish?: PublishConfig;

  constructor(
    private readonly github: GitHubClient,
    private readonly llm: LLMProvider,
    private readonly store: DocumentStore,
    private readonly documentsPath: string,
    private readonly memory: WorkEventStore,
    options: DocumentServiceOptions = {},
  ) {
    this.confidenceConfig = options.confidence ?? DEFAULT_CONFIDENCE_CONFIG;
    this.publisher = options.publisher;
    this.publish = options.publish;
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

    // Aditivo (Fase piloto): tras escribir el .md local, opcionalmente subirlo
    // al repo como artefacto/evidencia. La subida es opt-in por request o config.
    const repoUpload = await this.maybePublish(pr, markdown, input.uploadToRepo);

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
      ...(repoUpload ? { repoUpload } : {}),
    };
  }

  /**
   * Sube el documento por PR al repo si la subida está activa (flag del request
   * o default de config). El repo destino es `publish.repo` o, si está vacío, el
   * repo de origen del PR. Devuelve `undefined` si no corresponde subir.
   *
   * Best-effort: la salida local (`.md` ya escrito) es el flujo principal. Si la
   * subida falla, no se propaga la excepción; se devuelve `committed: false` con
   * el motivo en `error` para que la route lo loguee y responda normalmente.
   */
  private async maybePublish(
    pr: PullRequestData,
    markdown: string,
    uploadToRepo?: boolean,
  ): Promise<RepoUploadResult | undefined> {
    const shouldUpload = uploadToRepo ?? this.publish?.toRepo ?? false;
    if (!shouldUpload || !this.publisher || !this.publish) {
      return undefined;
    }

    const repository = this.publish.repo ?? pr.repository;
    const path = buildRepoDocumentPath(this.publish.pathPrefix, pr);
    try {
      const result = await this.publisher.publishFile({
        repository,
        path,
        content: markdown,
        message: `docs(mico): documento del PR #${pr.number} — ${pr.title}`,
        branch: this.publish.branch,
      });
      return { committed: result.committed, path: result.path, url: result.url };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { committed: false, path, error: message };
    }
  }

  listDocuments(): Promise<GeneratedDocument[]> {
    return this.store.list();
  }

  getDocument(id: string): Promise<GeneratedDocument | undefined> {
    return this.store.get(id);
  }
}
