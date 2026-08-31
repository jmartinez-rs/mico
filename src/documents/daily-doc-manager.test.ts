import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { DailyDocManager } from "./daily-doc-manager.js";
import { CommitAnalysisResult } from "../llm/commit-analyzer.js";

describe("DailyDocManager", () => {
  let tempDir: string;
  let docManager: DailyDocManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-test-"));
    docManager = new DailyDocManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("crea un nuevo archivo YYYY-MM-DD.md con el formato adecuado", async () => {
    const analysis: CommitAnalysisResult = {
      commit: {
        hash: "1234567890abcdef1234567890abcdef12345678",
        shortHash: "1234567",
        author: "Desarrollador Test",
        authorEmail: "test@example.com",
        date: new Date("2026-08-31T12:00:00Z"),
        dateIso: "2026-08-31T12:00:00.000Z",
        dateYYYYMMDD: "2026-08-31",
        message: "feat: implementar nueva funcionalidad",
        filesChanged: ["src/index.ts"],
        diff: "+ console.log('hello');",
      },
      markdownAnalysis: "### Resumen Ejecutivo\nSe agregó log en index.",
      processedAt: "2026-08-31T12:01:00Z",
    };

    const filePath = await docManager.appendCommitAnalysis(analysis);
    expect(filePath).toBe(path.join(tempDir, "2026-08-31.md"));

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("# Informe de Desarrollo - 2026-08-31 🐒");
    expect(content).toContain("### 🔨 Commit `1234567` — feat: implementar nueva funcionalidad");
    expect(content).toContain("Desarrollador Test");
    expect(content).toContain("Se agregó log en index.");
  });

  it("anexa análisis adicionales al mismo archivo del día si ya existe", async () => {
    const commit1: CommitAnalysisResult = {
      commit: {
        hash: "aaaa111122223333444455556666777788889999",
        shortHash: "aaaa111",
        author: "Dev 1",
        authorEmail: "dev1@example.com",
        date: new Date("2026-08-31T10:00:00Z"),
        dateIso: "2026-08-31T10:00:00.000Z",
        dateYYYYMMDD: "2026-08-31",
        message: "fix: corregir bug",
        filesChanged: ["src/config.ts"],
        diff: "- old\n+ new",
      },
      markdownAnalysis: "Corrección de bug en config.",
      processedAt: "2026-08-31T10:05:00Z",
    };

    const commit2: CommitAnalysisResult = {
      commit: {
        hash: "bbbb111122223333444455556666777788889999",
        shortHash: "bbbb111",
        author: "Dev 2",
        authorEmail: "dev2@example.com",
        date: new Date("2026-08-31T14:00:00Z"),
        dateIso: "2026-08-31T14:00:00.000Z",
        dateYYYYMMDD: "2026-08-31",
        message: "docs: actualizar readme",
        filesChanged: ["README.md"],
        diff: "+ Mico",
      },
      markdownAnalysis: "Documentación de Mico.",
      processedAt: "2026-08-31T14:05:00Z",
    };

    await docManager.appendCommitAnalysis(commit1);
    const filePath = await docManager.appendCommitAnalysis(commit2);

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("Commit `aaaa111`");
    expect(content).toContain("Commit `bbbb111`");
  });
});
