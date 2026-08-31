import fs from "fs/promises";
import path from "path";
import { CommitAnalysisResult } from "../llm/commit-analyzer.js";

export class DailyDocManager {
  private outputDir: string;

  constructor(outputDir: string = "./docs/mico") {
    this.outputDir = path.resolve(outputDir);
  }

  /**
   * Obtiene la ruta del archivo Markdown diario para una fecha dada (YYYY-MM-DD).
   */
  getDailyDocPath(dateYYYYMMDD: string): string {
    return path.join(this.outputDir, `${dateYYYYMMDD}.md`);
  }

  /**
   * Asegura que el directorio de salida existe.
   */
  async ensureDirectoryExists(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  /**
   * Agrega un nuevo commit analizado al informe diario correspondiente.
   * Si el archivo para esa fecha no existe, lo crea con la cabecera correspondiente.
   */
  async appendCommitAnalysis(analysisResult: CommitAnalysisResult): Promise<string> {
    await this.ensureDirectoryExists();

    const { commit, markdownAnalysis } = analysisResult;
    const dateStr = commit.dateYYYYMMDD || (new Date().toISOString().split("T")[0] ?? "1970-01-01");
    const filePath = this.getDailyDocPath(dateStr);

    let fileExists = false;
    try {
      await fs.access(filePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      // Crear nuevo informe del día
      const header = `# Informe de Desarrollo - ${dateStr} 🐒

> Documento generado por **Mico**, el agente observador de desarrollo.

## 📌 Visión General del Día
Este informe documenta las tareas y cambios realizados durante el día **${dateStr}**.

## 📜 Registro de Commits e Implementaciones
`;
      await fs.writeFile(filePath, header, "utf-8");
    }

    // Formatear la entrada del commit
    const timeStr = commit.date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const commitSection = `
---

### 🔨 Commit \`${commit.shortHash}\` — ${commit.message.split("\n")[0]}

- **Hora:** \`${timeStr}\`
- **Autor:** ${commit.author}
- **Hash:** \`${commit.hash}\`

${markdownAnalysis}
`;

    await fs.appendFile(filePath, commitSection, "utf-8");
    return filePath;
  }
}
