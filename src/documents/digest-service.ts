import {
  DEFAULT_CONFIDENCE_CONFIG,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import type { Confidence } from "../domain/work-event.js";
import { buildDigestSystemPrompt, buildDigestPrompt } from "../llm/digest-prompt.js";
import type { LLMProvider } from "../llm/provider.js";
import type { WorkEventStore } from "../memory/work-event-store.js";
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
}

export interface DigestServiceOptions {
  confidence?: ConfidenceConfig;
  language?: "es" | "en";
}

/**
 * Genera el digest semanal (Incremento B): lee la MEMORIA de eventos (Incremento
 * A) para una ventana, agrega los claims, sintetiza un overview con el LLM
 * (degradando a un resumen determinista si el LLM falla), aplica el gate de
 * confianza agregada y escribe el Markdown en la carpeta local.
 */
export class DigestService {
  private readonly confidenceConfig: ConfidenceConfig;

  constructor(
    private readonly memory: WorkEventStore,
    private readonly llm: LLMProvider,
    private readonly documentsPath: string,
    private readonly options: DigestServiceOptions = {},
  ) {
    this.confidenceConfig = options.confidence ?? DEFAULT_CONFIDENCE_CONFIG;
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

    const markdown = renderWeeklyDigest(view, this.options.language);
    const filePath = buildDigestPath(this.documentsPath, input.repository, weekLabel);
    await writeDocument(filePath, markdown);

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
    };
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
        system: buildDigestSystemPrompt(this.options.language),
        prompt: buildDigestPrompt(repository, events, this.options.language),
      });
    } catch {
      // Degradación segura: si el LLM falla, el view compone un overview
      // determinista a partir de los conteos.
      return "";
    }
  }
}
