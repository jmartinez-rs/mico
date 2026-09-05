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
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateYYYYMMDD = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;

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
   * Obtiene la URL del remote `origin` (si existe) para derivar el
   * `repository` (`owner/repo`) de los WorkEvents locales.
   */
  async getRemoteUrl(): Promise<string | null> {
    try {
      const output = await this.runGit(["config", "--get", "remote.origin.url"]);
      return output || null;
    } catch {
      return null;
    }
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

/**
 * Normaliza una URL de remote git a `owner/repo` (sin host, esquema ni `.git`).
 * Soporta SSH (`git@github.com:owner/repo.git`) y HTTPS
 * (`https://github.com/owner/repo.git`). Para repos con subgrupos
 * (`group/sub/project`) se conservan los últimos dos segmentos. Si no reconoce
 * el formato, devuelve la URL limpia de `.git` tal cual.
 */
export function normalizeRemoteUrl(url: string): string {
  const trimmed = url.trim();
  const sshMatch = trimmed.match(/^[^@\s]+@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return lastTwoSegments(sshMatch[2] ?? "");
  }
  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return lastTwoSegments(httpsMatch[2] ?? "");
  }
  return trimmed.replace(/\.git$/, "");
}

/** Host del remote (`github.com`, `gitlab.com`, ...) o `null` si no se reconoce. */
export function remoteHost(url: string): string | null {
  const trimmed = url.trim();
  const sshMatch = trimmed.match(/^[^@\s]+@([^:]+):/);
  if (sshMatch) {
    return sshMatch[1] ?? null;
  }
  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\//);
  if (httpsMatch) {
    return httpsMatch[1] ?? null;
  }
  return null;
}

function lastTwoSegments(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}
