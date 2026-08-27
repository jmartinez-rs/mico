import type { PullRequestData } from "../models/index.js";

const MAX_PATCH_CHARS = 6000;
const MAX_TOTAL_PATCH_CHARS = 40000;

export const SYSTEM_PROMPT = [
  "Eres un asistente técnico que redacta documentación clara y trazable a partir de Pull Requests.",
  "Escribes en español, en formato Markdown, con tono profesional y conciso.",
  "Nunca inventes información: básate únicamente en los datos provistos (commits, archivos, diffs, reviews).",
  "Si algo no está claro a partir de la evidencia, indícalo explícitamente en lugar de suponer.",
  "Estructura el documento con estas secciones: Resumen, Cambios principales, Detalle por archivo, Decisiones y riesgos, Fuentes.",
].join(" ");

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n... [diff truncado, ${text.length - max} caracteres omitidos]`;
}

export function buildPrompt(pr: PullRequestData): string {
  const lines: string[] = [];

  lines.push(`# Pull Request #${pr.number}: ${pr.title}`);
  lines.push("");
  lines.push(`- Repositorio: ${pr.repository}`);
  lines.push(`- Autor: ${pr.author ?? "desconocido"}`);
  lines.push(`- Estado: ${pr.state}${pr.mergedAt ? " (merged)" : ""}`);
  lines.push(`- Rama base: ${pr.baseBranch} ← ${pr.headBranch}`);
  lines.push(`- URL: ${pr.url}`);
  lines.push("");

  if (pr.body && pr.body.trim().length > 0) {
    lines.push("## Descripción del PR");
    lines.push(pr.body.trim());
    lines.push("");
  }

  lines.push("## Commits");
  for (const commit of pr.commits) {
    const firstLine = commit.message.split("\n")[0] ?? commit.message;
    lines.push(`- ${commit.sha.slice(0, 7)} — ${firstLine} (${commit.author ?? "desconocido"})`);
  }
  lines.push("");

  if (pr.reviews.length > 0) {
    lines.push("## Reviews");
    for (const review of pr.reviews) {
      lines.push(`- ${review.author ?? "desconocido"} [${review.state}]${review.body ? `: ${review.body}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Archivos modificados");
  let totalPatchChars = 0;
  for (const file of pr.files) {
    lines.push(
      `### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`,
    );
    if (file.patch && totalPatchChars < MAX_TOTAL_PATCH_CHARS) {
      const patch = truncate(file.patch, MAX_PATCH_CHARS);
      totalPatchChars += patch.length;
      lines.push("```diff");
      lines.push(patch);
      lines.push("```");
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "Redacta la documentación técnica de este Pull Request siguiendo la estructura indicada. Incluye en 'Fuentes' los enlaces a commits y al PR.",
  );

  return lines.join("\n");
}
