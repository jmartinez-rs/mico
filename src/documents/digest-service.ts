import type { PublishConfig } from "../config.js";
import {
  DEFAULT_CONFIDENCE_CONFIG,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import type { Confidence } from "../domain/work-event.js";
import {
  buildRepoDigestPath,
  type RepoPublisher,
} from "../github/repo-publisher.js";
import { DIGEST_SYSTEM_PROMPT, buildDigestPrompt } from "../llm/digest-prompt.js";
import type { LLMProvider } from "../llm/provider.js";
import type { WorkEventStore } from "../memory/work-event-store.js";
import type { RepoUploadResult } from "../models/index.js";
import {
  buildWeeklyDigestView,
  defaultWeekRange,
  isoWeekLabel,
  type WeeklyDigestView,
} from "./digest.js";
import { buildDigestPath, renderWeeklyDigest } from "./digest-writer.js";
import { writeDocument } from "./markdown-writer.js";

export interface GenerateWeeklyDigestInput {
  repository: string;
  from?: string;
  to?: string;
  /** Fuerza (o inhibe) la subida al repo para este request; si se omite, usa la config. */
  uploadToRepo?: boolean;
}

export interface WeeklyDigestResult {
  status: "completed";
  repository: string;
  from: string;
  to: string;
  weekLabel: string;
  filePath: string;
  eventCount: number;
  confidence: Confidence;
  needsHumanReview: boolean;
  driftCount: number;
  repoUpload?: RepoUploadResult;
}

export interface DigestServiceOptions {
  confidence?: ConfidenceConfig;
  publisher?: RepoPublisher;
  publish?: PublishConfig;
}

/**
 * Genera el digest semanal (Incremento B): lee la MEMORIA de eventos (Incremento
 * A) para una ventana, agrega los claims, sintetiza un overview con el LLM
 * (degradando a un resumen determinista si el LLM falla), aplica el gate de
 * confianza agregada y escribe el Markdown en la carpeta local.
 */
export class DigestService {
  private readonly confidenceConfig: ConfidenceConfig;
  private readonly publisher?: RepoPublisher;
  private readonly publish?: PublishConfig;

  constructor(
    private readonly memory: WorkEventStore,
    private readonly llm: LLMProvider,
    private readonly documentsPath: string,
    options: DigestServiceOptions = {},
  ) {
    this.confidenceConfig = options.confidence ?? DEFAULT_CONFIDENCE_CONFIG;
    this.publisher = options.publisher;
    this.publish = options.publish;
  }

  async generateWeekly(
    input: GenerateWeeklyDigestInput,
  ): Promise<WeeklyDigestResult> {
    const range =
      input.from && input.to
        ? { from: input.from, to: input.to }
        : defaultWeekRange();
    const from = input.from ?? range.from;
    const to = input.to ?? range.to;
    const weekLabel = isoWeekLabel(from);

    const events = await this.memory.list({
      repository: input.repository,
      from,
      to,
    });

    const overview = await this.buildOverview(input.repository, events);

    const view: WeeklyDigestView = buildWeeklyDigestView({
      repository: input.repository,
      from,
      to,
      weekLabel,
      events,
      overview,
      confidenceConfig: this.confidenceConfig,
    });

    const markdown = renderWeeklyDigest(view);
    const filePath = buildDigestPath(this.documentsPath, input.repository, weekLabel);
    await writeDocument(filePath, markdown);

    // Aditivo (Fase piloto): tras escribir el .md local, opcionalmente subirlo
    // al repo como artefacto/evidencia. La subida es opt-in por request o config.
    const repoUpload = await this.maybePublish(
      input.repository,
      view.weekLabel,
      markdown,
      input.uploadToRepo,
    );

    return {
      status: "completed",
      repository: view.repository,
      from: view.from,
      to: view.to,
      weekLabel: view.weekLabel,
      filePath,
      eventCount: view.eventCount,
      confidence: view.confidence,
      needsHumanReview: view.needsHumanReview,
      driftCount: view.drift.length,
      ...(repoUpload ? { repoUpload } : {}),
    };
  }

  /**
   * Sube el digest semanal al repo si la subida está activa (flag del request o
   * default de config). El repo destino es `publish.repo` o, si está vacío, el
   * repo del digest. Devuelve `undefined` si no corresponde subir.
   *
   * Best-effort: la salida local (`.md` ya escrito) es el flujo principal. Si la
   * subida falla, no se propaga la excepción; se devuelve `committed: false` con
   * el motivo en `error` para que la route lo loguee y responda normalmente.
   */
  private async maybePublish(
    repository: string,
    weekLabel: string,
    markdown: string,
    uploadToRepo?: boolean,
  ): Promise<RepoUploadResult | undefined> {
    const shouldUpload = uploadToRepo ?? this.publish?.toRepo ?? false;
    if (!shouldUpload || !this.publisher || !this.publish) {
      return undefined;
    }

    const targetRepo = this.publish.repo ?? repository;
    const path = buildRepoDigestPath(this.publish.pathPrefix, repository, weekLabel);
    try {
      const result = await this.publisher.publishFile({
        repository: targetRepo,
        path,
        content: markdown,
        message: `docs(mico): digest semanal ${repository} (${weekLabel})`,
        branch: this.publish.branch,
      });
      return { committed: result.committed, path: result.path, url: result.url };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { committed: false, path, error: message };
    }
  }

  private async buildOverview(
    repository: string,
    events: Awaited<ReturnType<WorkEventStore["list"]>>,
  ): Promise<string> {
    if (events.length === 0) {
      return "";
    }
    try {
      return await this.llm.generate({
        system: DIGEST_SYSTEM_PROMPT,
        prompt: buildDigestPrompt(repository, events),
      });
    } catch {
      // Degradación segura: si el LLM falla, el view compone un overview
      // determinista a partir de los conteos.
      return "";
    }
  }
}
