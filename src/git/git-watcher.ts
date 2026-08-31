import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: Date;
  dateIso: string;
  dateYYYYMMDD: string;
  message: string;
  filesChanged: string[];
  diff: string;
}

export class GitWatcher {
  private repoPath: string;

  constructor(repoPath: string = "./") {
    this.repoPath = path.resolve(repoPath);
  }

  /**
   * Ejecuta un comando git en el directorio del repositorio.
   */
  private async runGit(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: this.repoPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Error al ejecutar git ${args.join(" ")}: ${error.message}`);
    }
  }

  /**
   * Obtiene la lista de hashes de los últimos N commits (más reciente primero).
   */
  async getRecentHashes(limit: number = 50): Promise<string[]> {
    try {
      const output = await this.runGit(["log", `-n`, `${limit}`, "--format=%H"]);
      if (!output) return [];
      return output.split("\n").map((h) => h.trim()).filter(Boolean);
    } catch (err) {
      // Si el repo es nuevo sin commits todavía
      return [];
    }
  }

  /**
   * Obtiene detalles completos de un commit por su hash.
   */
  async getCommitDetails(hash: string): Promise<CommitInfo> {
    // Formato con separadores personalizados para parsear hash, autor, email, fecha ISO y mensaje
    const DELIM = "---MICO_DELIM---";
    const format = `%H${DELIM}%h${DELIM}%an${DELIM}%ae${DELIM}%aI${DELIM}%B`;

    const metadataOutput = await this.runGit(["show", "--no-patch", `--format=${format}`, hash]);
    const parts = metadataOutput.split(DELIM);

    const fullHash = parts[0]?.trim() || hash;
    const shortHash = parts[1]?.trim() || hash.substring(0, 7);
    const author = parts[2]?.trim() || "Desconocido";
    const authorEmail = parts[3]?.trim() || "";
    const dateStr = parts[4]?.trim() || new Date().toISOString();
    const message = parts[5]?.trim() || "";

    const dateObj = new Date(dateStr);
    const dateIso = dateObj.toISOString();
    const dateYYYYMMDD = dateIso.split("T")[0] ?? "1970-01-01";

    // Obtener lista de archivos modificados
    const filesOutput = await this.runGit(["show", "--stat", "--name-only", `--format=`, hash]);
    const filesChanged = filesOutput
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    // Obtener diff del commit (limitado a 8000 caracteres para evitar saturar contexto LLM si es gigante)
    let diff = "";
    try {
      diff = await this.runGit(["show", "--patch", `--format=`, hash]);
      if (diff.length > 8000) {
        diff = diff.substring(0, 8000) + "\n\n...[diff truncado por longitud]...";
      }
    } catch {
      diff = "(No fue posible extraer el diff)";
    }

    return {
      hash: fullHash,
      shortHash,
      author,
      authorEmail,
      date: dateObj,
      dateIso,
      dateYYYYMMDD,
      message,
      filesChanged,
      diff,
    };
  }

  /**
   * Obtiene todos los commits no procesados en orden cronológico (más antiguo primero).
   */
  async getUnprocessedCommits(
    processedHashes: Set<string>,
    limit: number = 20
  ): Promise<CommitInfo[]> {
    const recentHashes = await this.getRecentHashes(limit);
    const newHashes = recentHashes.filter((h) => !processedHashes.has(h));

    // Invertir para procesar en orden cronológico (del más antiguo al más nuevo)
    newHashes.reverse();

    const result: CommitInfo[] = [];
    for (const hash of newHashes) {
      try {
        const details = await this.getCommitDetails(hash);
        result.push(details);
      } catch (error) {
        console.error(`[Mico GitWatcher] Error procesando commit ${hash}:`, error);
      }
    }
    return result;
  }
}
