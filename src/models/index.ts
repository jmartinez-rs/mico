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
 * Resultado de generar un documento desde un PR.
 */
export interface DocumentGenerationResult {
  status: "completed";
  id: string;
  filePath: string;
  documentUrl: string | null;
  confidence: Confidence;
  needsHumanReview: boolean;
}
