import type { PullRequestData } from "./types.js";
import type { Evidence, WorkEvent } from "./work-event.js";

export interface MappedWorkEvent {
  workEvent: WorkEvent;
  evidence: Evidence[];
}

function repositorySlug(repository: string): string {
  return repository.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Traduce la señal cruda de un PR (`PullRequestData`) al modelo de dominio:
 * un `WorkEvent` con su `Evidence`. Es puro y determinista (mismos datos ⇒
 * misma salida), sin llamadas a red ni al LLM.
 *
 * Evidencia (ADR-0002): el link al PR es la trazabilidad mínima suficiente del
 * piloto; los commits y reviews se agregan como evidencia adicional si existen.
 */
export function mapPullRequestToWorkEvent(pr: PullRequestData): MappedWorkEvent {
  const evidence: Evidence[] = [];

  evidence.push({
    id: `pr-${pr.number}`,
    kind: "pull_request",
    label: `PR #${pr.number}`,
    url: pr.url,
    detail: pr.title,
  });

  for (const commit of pr.commits) {
    const firstLine = (commit.message.split("\n")[0] ?? commit.message).trim();
    evidence.push({
      id: `commit-${commit.sha}`,
      kind: "commit",
      label: commit.sha.slice(0, 7),
      url: commit.url,
      detail: firstLine,
    });
  }

  pr.reviews.forEach((review, index) => {
    const author = review.author ?? "desconocido";
    evidence.push({
      id: `review-${author}-${index}`,
      kind: "review",
      label: `review de ${author}`,
      url: pr.url,
      detail: review.body ? `${review.state}: ${review.body}` : review.state,
    });
  });

  const workEvent: WorkEvent = {
    id: `pr-${repositorySlug(pr.repository)}-${pr.number}`,
    type: "pull_request",
    repository: pr.repository,
    title: pr.title,
    author: pr.author,
    url: pr.url,
    occurredAt: pr.mergedAt ?? pr.createdAt,
    evidenceIds: evidence.map((item) => item.id),
  };

  return { workEvent, evidence };
}
