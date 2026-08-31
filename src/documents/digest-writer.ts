import { join } from "node:path";
import type { ConfidenceLevel } from "../domain/work-event.js";
import type { DigestClaimItem, WeeklyDigestView } from "./digest.js";
import { slugify } from "./markdown-writer.js";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/** Ruta del digest semanal: `<documentsPath>/digests/{repo}-{semana}.md`. */
export function buildDigestPath(
  documentsPath: string,
  repository: string,
  weekLabel: string,
): string {
  const repoSlug = slugify(repository);
  return join(documentsPath, "digests", `${repoSlug}-${weekLabel}.md`);
}

function renderClaimList(items: DigestClaimItem[]): string[] {
  if (items.length === 0) {
    return ["_Sin ítems en esta ventana._"];
  }
  return items.map((item) => `- ${item.text} ([${item.label}](${item.url}))`);
}

/**
 * Renderiza el digest semanal como Markdown trazable: banner de confianza,
 * overview, secciones qué se hizo / decisiones / pendientes, drift y el índice
 * de eventos de la ventana con su link.
 */
export function renderWeeklyDigest(view: WeeklyDigestView): string {
  const levelLabel = CONFIDENCE_LABEL[view.confidence.level];
  const lines: string[] = [
    `# Digest semanal — ${view.repository} (${view.weekLabel})`,
    "",
    "> Vista de digest generada por Mico 🐒 agregando los eventos de trabajo (WorkEvent) de la ventana.",
    "",
  ];

  if (view.needsHumanReview) {
    lines.push(
      `> ⚠️ **Revisión humana recomendada** — la confianza agregada es ${levelLabel} (score ${view.confidence.score}). ` +
        "El digest contiene eventos de baja confianza; verificá antes de darlo por cierto.",
      "",
    );
  }

  lines.push(
    "| Campo | Valor |",
    "| --- | --- |",
    `| Repositorio | \`${view.repository}\` |`,
    `| Ventana | ${view.from} → ${view.to} |`,
    `| Semana | ${view.weekLabel} |`,
    `| Eventos | ${view.eventCount} |`,
    `| Confianza agregada | ${levelLabel} (score ${view.confidence.score}) |`,
    `| Revisión humana | ${view.needsHumanReview ? "Sí" : "No"} |`,
    `| Generado | ${new Date().toISOString()} |`,
    "",
    "---",
    "",
    "## Resumen",
    "",
    view.overview.trim(),
    "",
    "## Qué se hizo",
    "",
    ...renderClaimList(view.did),
    "",
    "## Decisiones",
    "",
    ...renderClaimList(view.decisions),
    "",
    "## Pendientes / por avanzar",
    "",
    ...renderClaimList(view.pending),
    "",
    "## Drift / huecos",
    "",
  );

  if (view.drift.length === 0) {
    lines.push("_No se detectaron señales de drift en esta ventana._");
  } else {
    for (const signal of view.drift) {
      lines.push(`- ${signal.reason} — [${signal.title}](${signal.url})`);
    }
  }

  lines.push("", "## Eventos de la ventana", "");
  if (view.events.length === 0) {
    lines.push("_No hay eventos registrados en la ventana._");
  } else {
    for (const stored of view.events) {
      const level = CONFIDENCE_LABEL[stored.confidence.level];
      lines.push(
        `- [${stored.workEvent.title}](${stored.workEvent.url}) — ${stored.workEvent.occurredAt} (confianza ${level})`,
      );
    }
  }

  lines.push(
    "",
    "## Confianza",
    "",
    `- Nivel agregado: ${levelLabel} (score ${view.confidence.score})`,
    `- Revisión humana: ${view.needsHumanReview ? "Sí" : "No"}`,
    "- Motivos:",
  );
  for (const reason of view.confidence.reasons) {
    lines.push(`  - ${reason}`);
  }

  return `${lines.join("\n")}\n`;
}
