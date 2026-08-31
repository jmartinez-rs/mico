import { Octokit } from "@octokit/rest";
import { slugify } from "../documents/markdown-writer.js";
import type { PullRequestData } from "../models/index.js";

/**
 * Error de la subida de artefactos al repo. Coherente con `GitHubError`:
 * mensaje en español y `status` HTTP opcional para que las rutas puedan mapear
 * la respuesta.
 */
export class RepoPublishError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RepoPublishError";
  }
}

export interface PublishFileInput {
  /** Repositorio destino en formato `owner/repo`. */
  repository: string;
  /** Ruta del archivo dentro del repo (con `/` como separador). */
  path: string;
  /** Contenido del archivo en texto plano (se codifica a base64). */
  content: string;
  /** Mensaje de commit descriptivo. */
  message: string;
  /** Rama destino. Si se omite, GitHub usa la rama por defecto del repo. */
  branch?: string;
}

export interface RepoPublishResult {
  committed: boolean;
  path: string;
  url?: string;
  commitSha?: string;
  branch?: string;
}

/**
 * Publica artefactos Markdown (documento por PR / digest) en un repositorio de
 * GitHub. Interfaz para poder inyectar un fake en tests (como github/llm).
 */
export interface RepoPublisher {
  publishFile(input: PublishFileInput): Promise<RepoPublishResult>;
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new RepoPublishError(
      `Repositorio inválido: "${repository}". Se espera el formato "owner/repo".`,
      400,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

function normalizePrefix(pathPrefix: string): string {
  return pathPrefix.replace(/^\/+|\/+$/g, "");
}

/**
 * Ruta del documento por PR dentro del repo destino:
 * `${pathPrefix}/pull-requests/{number}-{slug}.md`. Refleja la ruta local.
 */
export function buildRepoDocumentPath(
  pathPrefix: string,
  pr: PullRequestData,
): string {
  const slug = slugify(pr.headBranch || pr.title);
  return `${normalizePrefix(pathPrefix)}/pull-requests/${pr.number}-${slug}.md`;
}

/**
 * Ruta del digest semanal dentro del repo destino:
 * `${pathPrefix}/digests/{repo}-{semana}.md`. Refleja la ruta local.
 */
export function buildRepoDigestPath(
  pathPrefix: string,
  repository: string,
  weekLabel: string,
): string {
  const repoSlug = slugify(repository);
  return `${normalizePrefix(pathPrefix)}/digests/${repoSlug}-${weekLabel}.md`;
}

/**
 * Publisher real vía Octokit: create-or-update de un archivo con
 * `repos.createOrUpdateFileContents`. Obtiene el `sha` si el archivo ya existe
 * (para update) y hace el PUT con el contenido en base64.
 */
export class GitHubRepoPublisher implements RepoPublisher {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async publishFile(input: PublishFileInput): Promise<RepoPublishResult> {
    const { owner, repo } = parseRepository(input.repository);
    const contentBase64 = Buffer.from(input.content, "utf8").toString("base64");

    try {
      const sha = await this.getExistingSha(owner, repo, input.path, input.branch);

      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: input.path,
        message: input.message,
        content: contentBase64,
        ...(sha ? { sha } : {}),
        ...(input.branch ? { branch: input.branch } : {}),
      });

      return {
        committed: true,
        path: input.path,
        url: data.content?.html_url ?? undefined,
        commitSha: data.commit?.sha,
        branch: input.branch,
      };
    } catch (error: unknown) {
      if (error instanceof RepoPublishError) {
        throw error;
      }
      const status = statusOf(error);
      const message = error instanceof Error ? error.message : String(error);
      throw new RepoPublishError(
        `Error publicando en el repo "${input.repository}": ${message}`,
        status,
      );
    }
  }

  /** Devuelve el `sha` del archivo si ya existe; `undefined` si es creación (404). */
  private async getExistingSha(
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ): Promise<string | undefined> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ...(branch ? { ref: branch } : {}),
      });
      if (!Array.isArray(data) && "sha" in data) {
        return data.sha;
      }
      return undefined;
    } catch (error: unknown) {
      if (statusOf(error) === 404) {
        return undefined;
      }
      throw error;
    }
  }
}
