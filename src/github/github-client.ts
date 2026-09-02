import { Octokit } from "@octokit/rest";
import type {
  PullRequestCommit,
  PullRequestData,
  PullRequestFile,
  PullRequestReview,
} from "../domain/types.js";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new GitHubError(
      `Repositorio inválido: "${repository}". Se espera el formato "owner/repo".`,
      400,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

export class GitHubClient {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequest(repository: string, pullNumber: number): Promise<PullRequestData> {
    const { owner, repo } = parseRepository(repository);

    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const [commits, files, reviews] = await Promise.all([
        this.octokit.paginate(this.octokit.pulls.listCommits, {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        }),
        this.octokit.paginate(this.octokit.pulls.listFiles, {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        }),
        this.octokit.paginate(this.octokit.pulls.listReviews, {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        }),
      ]);

      const mappedCommits: PullRequestCommit[] = commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author?.login ?? commit.commit.author?.name ?? null,
        url: commit.html_url,
      }));

      const mappedFiles: PullRequestFile[] = files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      }));

      const mappedReviews: PullRequestReview[] = reviews
        .filter((review) => review.state !== "PENDING")
        .map((review) => ({
          author: review.user?.login ?? null,
          state: review.state,
          body: review.body ?? null,
        }));

      return {
        repository,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.user?.login ?? null,
        state: pr.state,
        url: pr.html_url,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        commits: mappedCommits,
        files: mappedFiles,
        reviews: mappedReviews,
      };
    } catch (error: unknown) {
      if (error instanceof GitHubError) {
        throw error;
      }
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      if (status === 404) {
        throw new GitHubError(
          `No se encontró el PR #${pullNumber} en "${repository}".`,
          404,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new GitHubError(`Error consultando GitHub: ${message}`, status);
    }
  }
}
