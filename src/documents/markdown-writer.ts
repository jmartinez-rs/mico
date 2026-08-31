import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Claim,
  ClaimCategory,
  ConfidenceLevel,
  Evidence,
  WorkEventDocumentView,
} from "../domain/work-event.js";
import type { PullRequestData } from "../models/index.js";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "documento";
}

export function buildDocumentPath(documentsPath: string, pr: PullRequestData): string {
  const slug = slugify(pr.headBranch || pr.title);
  const fileName = `${pr.number}-${slug}.md`;
  return join(documentsPath, "pull-requests", fileName);
}

export function buildMarkdown(pr: PullRequestData, generatedBody: string): string {
  const header = [
    `# ${pr.title}`,
    "",
    "> Documento generado automáticamente por Mico 🐒 a partir de un Pull Request.",
    "",
    "| Campo | Valor |",
    "| --- | --- |",
    `| Repositorio | \`${pr.repository}\` |`,
    `| Pull Request | [#${pr.number}](${pr.url}) |`,
    `| Autor | ${pr.author ?? "desconocido"} |`,
    `| Rama | \`${pr.baseBranch}\` ← \`${pr.headBranch}\` |`,
    `| Estado | ${pr.state}${pr.mergedAt ? " (merged)" : ""} |`,
    `| Generado | ${new Date().toISOString()} |`,
    "",
    "---",
    "",
  ].join("\n");

  return `${header}${generatedBody.trim()}\n`;
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/** Categorías estructuradas del digest v1 y su encabezado en la vista. */
const CLAIM_SECTIONS: { category: ClaimCategory; heading: string }[] = [
  { category: "what_was_done", heading: "Qué se hizo" },
  { category: "decision", heading: "Decisiones" },
  { category: "pending", heading: "Pendientes / por avanzar" },
];

/**
 * Referencia de trazabilidad para un claim: prioriza el link al PR (unidad
 * mínima del piloto) y cae a la primera evidencia disponible.
 */
function claimTraceability(claim: Claim, evidence: Evidence[]): string {
  const referenced = evidence.filter((item) =>
    claim.evidenceIds.includes(item.id),
  );
  const anchor =
    referenced.find((item) => item.kind === "pull_request") ?? referenced[0];
  if (!anchor) {
    return "";
  }
  return ` ([${anchor.label}](${anchor.url}))`;
}

/** Renderiza las secciones de claims por categoría, con su trazabilidad. */
function renderClaimSections(
  claims: Claim[],
  evidence: Evidence[],
): string[] {
  const lines: string[] = [];
  for (const section of CLAIM_SECTIONS) {
    const items = claims.filter((claim) => claim.category === section.category);
    if (items.length === 0) {
      continue;
    }
    lines.push("", `## ${section.heading}`, "");
    for (const claim of items) {
      lines.push(`- ${claim.text}${claimTraceability(claim, evidence)}`);
    }
  }
  return lines;
}

/**
 * Renderiza el documento como VISTA sobre el modelo (WorkEvent + Evidence +
 * Claims + Confidence), no directamente desde el PR. La salida es trazable e
 * incluye el estado de confianza y el flag de revisión humana (ADR-0002).
 */
export function renderWorkEventDocument(view: WorkEventDocumentView): string {
  const { workEvent, evidence, claims, confidence, needsHumanReview, narrative } =
    view;
  const prEvidence = evidence.find((item) => item.kind === "pull_request");
  const levelLabel = CONFIDENCE_LABEL[confidence.level];

  const lines: string[] = [
    `# ${workEvent.title}`,
    "",
    "> Vista de documento generada por Mico 🐒 sobre un evento de trabajo (WorkEvent) y su evidencia.",
    "",
  ];

  if (needsHumanReview) {
    lines.push(
      `> ⚠️ **Revisión humana recomendada** — la confianza es ${levelLabel} (score ${confidence.score}). ` +
        "La evidencia disponible es débil; verificá antes de dar por cierto el contenido.",
      "",
    );
  }

  lines.push(
    "| Campo | Valor |",
    "| --- | --- |",
    `| Repositorio | \`${workEvent.repository}\` |`,
    prEvidence
      ? `| Evento | ${prEvidence.label} ([link](${prEvidence.url})) |`
      : `| Evento | [link](${workEvent.url}) |`,
    `| Autor | ${workEvent.author ?? "desconocido"} |`,
    `| Confianza | ${levelLabel} (score ${confidence.score}) |`,
    `| Revisión humana | ${needsHumanReview ? "Sí" : "No"} |`,
    `| Generado | ${new Date().toISOString()} |`,
    "",
    "---",
    "",
    narrative.trim(),
  );

  lines.push(...renderClaimSections(claims, evidence));

  lines.push("", "## Evidencia", "");

  for (const item of evidence) {
    const detail = item.detail ? ` — ${item.detail}` : "";
    lines.push(`- [${item.label}](${item.url})${detail}`);
  }

  lines.push(
    "",
    "## Confianza",
    "",
    `- Nivel: ${levelLabel} (score ${confidence.score})`,
    `- Revisión humana: ${needsHumanReview ? "Sí" : "No"}`,
    "- Motivos:",
  );
  for (const reason of confidence.reasons) {
    lines.push(`  - ${reason}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function writeDocument(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
