import {
  aggregateConfidence,
  DEFAULT_CONFIDENCE_CONFIG,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import type {
  Claim,
  ClaimCategory,
  Confidence,
  Evidence,
} from "../domain/work-event.js";
import type { StoredWorkEvent } from "../memory/work-event-store.js";

/** Ítem agregado de un claim en el digest, con su trazabilidad al evento. */
export interface DigestClaimItem {
  text: string;
  workEventId: string;
  eventTitle: string;
  label: string;
  url: string;
}

/** Señal de drift/hueco detectada en la ventana (versión básica del piloto). */
export interface DriftSignal {
  workEventId: string;
  title: string;
  url: string;
  reason: string;
}

/** Vista del digest semanal: proyección agregada sobre la memoria. */
export interface WeeklyDigestView {
  repository: string;
  from: string;
  to: string;
  weekLabel: string;
  eventCount: number;
  events: StoredWorkEvent[];
  overview: string;
  did: DigestClaimItem[];
  decisions: DigestClaimItem[];
  pending: DigestClaimItem[];
  confidence: Confidence;
  needsHumanReview: boolean;
  drift: DriftSignal[];
}

function prAnchor(stored: StoredWorkEvent): Evidence | undefined {
  return (
    stored.evidence.find((item) => item.kind === "pull_request") ??
    stored.evidence[0]
  );
}

function collectCategory(
  events: StoredWorkEvent[],
  category: ClaimCategory,
): DigestClaimItem[] {
  const items: DigestClaimItem[] = [];
  for (const stored of events) {
    const anchor = prAnchor(stored);
    const matching = stored.claims.filter(
      (claim: Claim) => claim.category === category,
    );
    for (const claim of matching) {
      items.push({
        text: claim.text,
        workEventId: stored.workEvent.id,
        eventTitle: stored.workEvent.title,
        label: anchor?.label ?? stored.workEvent.title,
        url: anchor?.url ?? stored.workEvent.url,
      });
    }
  }
  return items;
}

/**
 * Detección básica de drift/huecos (piloto): señala PRs sin descripción y
 * trabajo con evidencia insuficiente (confianza baja / sin commits). Se apoya en
 * la confianza ya persistida para no reprocesar la señal cruda.
 *
 * TODO (roadmap): drift más rico — pendientes que se arrastran entre semanas,
 * trabajo (commits) sin PR asociado, inconsistencias entre digest y repo.
 */
export function detectDrift(events: StoredWorkEvent[]): DriftSignal[] {
  const signals: DriftSignal[] = [];
  for (const stored of events) {
    const anchor = prAnchor(stored);
    const base = {
      workEventId: stored.workEvent.id,
      title: stored.workEvent.title,
      url: anchor?.url ?? stored.workEvent.url,
    };

    if (
      stored.confidence.reasons.some((reason) =>
        reason.includes("no tiene descripción"),
      )
    ) {
      signals.push({ ...base, reason: "PR sin descripción." });
    }

    const hasCommitEvidence = stored.evidence.some(
      (item) => item.kind === "commit",
    );
    if (!hasCommitEvidence) {
      signals.push({ ...base, reason: "No hay commits registrados como evidencia." });
    }

    if (stored.needsHumanReview) {
      signals.push({
        ...base,
        reason: `Evidencia insuficiente (confianza ${stored.confidence.level}, score ${stored.confidence.score}).`,
      });
    }
  }
  return signals;
}

/**
 * Construye la vista del digest agregando los eventos de la ventana: claims por
 * categoría, confianza agregada (marca revisión si hay eventos de baja
 * confianza) y señales de drift. El `overview` se inyecta desde afuera (puede
 * venir del LLM); si está vacío, se compone uno determinista.
 */
export function buildWeeklyDigestView(input: {
  repository: string;
  from: string;
  to: string;
  weekLabel: string;
  events: StoredWorkEvent[];
  overview?: string;
  confidenceConfig?: ConfidenceConfig;
}): WeeklyDigestView {
  const config = input.confidenceConfig ?? DEFAULT_CONFIDENCE_CONFIG;
  const events = [...input.events].sort((a, b) =>
    a.workEvent.occurredAt.localeCompare(b.workEvent.occurredAt),
  );

  const did = collectCategory(events, "what_was_done");
  const decisions = collectCategory(events, "decision");
  const pending = collectCategory(events, "pending");

  const { confidence, needsHumanReview } = aggregateConfidence(
    events.map((event) => event.confidence),
    config,
  );

  const drift = detectDrift(events);

  const overview =
    (input.overview ?? "").trim() ||
    composeOverview(input.repository, events.length, did.length, pending.length);

  return {
    repository: input.repository,
    from: input.from,
    to: input.to,
    weekLabel: input.weekLabel,
    eventCount: events.length,
    events,
    overview,
    did,
    decisions,
    pending,
    confidence,
    needsHumanReview,
    drift,
  };
}

function composeOverview(
  repository: string,
  eventCount: number,
  didCount: number,
  pendingCount: number,
): string {
  if (eventCount === 0) {
    return `No se registró trabajo para ${repository} en la ventana.`;
  }
  return (
    `Durante la ventana se registraron ${eventCount} evento(s) de trabajo en ${repository}, ` +
    `con ${didCount} avance(s) y ${pendingCount} pendiente(s) identificados.`
  );
}

/**
 * Etiqueta ISO de semana (`YYYY-Www`) para una fecha ISO. Se usa en el nombre de
 * archivo del digest.
 */
export function isoWeekLabel(dateISO: string): string {
  const date = new Date(dateISO);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  const year = target.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Ventana semanal por defecto (lunes 00:00:00Z a domingo 23:59:59.999Z UTC) que
 * contiene a `now`. Se usa cuando el request no trae `from`/`to`.
 */
export function defaultWeekRange(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { from: monday.toISOString(), to: sunday.toISOString() };
}
