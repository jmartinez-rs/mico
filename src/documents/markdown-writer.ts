import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
    "> Documento generado automáticamente por WorkingDocs a partir de un Pull Request.",
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

export async function writeDocument(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}
