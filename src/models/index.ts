export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface PullRequestCommit {
  sha: string;
  message: string;
  author: string | null;
  url: string;
}

export interface PullRequestReview {
  author: string | null;
  state: string;
  body: string | null;
}

export interface PullRequestData {
  repository: string;
  number: number;
  title: string;
  body: string | null;
  author: string | null;
  state: string;
  url: string;
  baseBranch: string;
  headBranch: string;
  createdAt: string;
  mergedAt: string | null;
  commits: PullRequestCommit[];
  files: PullRequestFile[];
  reviews: PullRequestReview[];
}

import type { Confidence } from "../domain/work-event.js";

export interface GeneratedDocument {
  id: string;
  repository: string;
  pullRequestNumber: number;
  title: string;
  filePath: string;
  createdAt: string;
  confidence?: Confidence;
  needsHumanReview?: boolean;
}

/**
 * Resultado de subir el Markdown generado al repositorio (opcional). Se agrega a
 * la respuesta de los endpoints solo cuando la subida estuvo activa.
 */
export interface RepoUploadResult {
  committed: boolean;
  path: string;
  url?: string;
  /** Motivo del fallo cuando la subida no se concretó (best-effort). */
  error?: string;
}

export interface DocumentGenerationResult {
  status: "completed";
  id: string;
  filePath: string;
  documentUrl: string | null;
  confidence: Confidence;
  needsHumanReview: boolean;
  repoUpload?: RepoUploadResult;
}
