import { describe, expect, it } from "vitest";
import type { PullRequestData } from "../models/index.js";
import {
  buildRepoDigestPath,
  buildRepoDocumentPath,
} from "./repo-publisher.js";

const pr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer",
  author: "jose",
  state: "open",
  url: "https://github.com/acme/web/pull/42",
  baseBranch: "main",
  headBranch: "feature/cache",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: null,
  commits: [],
  files: [],
  reviews: [],
};

describe("repo-publisher path builders", () => {
  it("construye la ruta del documento por PR con el prefijo", () => {
    const path = buildRepoDocumentPath("docs/mico", pr);
    expect(path).toBe("docs/mico/pull-requests/42-feature-cache.md");
  });

  it("normaliza barras extra del prefijo", () => {
    const path = buildRepoDocumentPath("/docs/mico/", pr);
    expect(path).toBe("docs/mico/pull-requests/42-feature-cache.md");
  });

  it("cae al slug del título si no hay rama", () => {
    const path = buildRepoDocumentPath("docs/mico", {
      ...pr,
      headBranch: "",
    });
    expect(path).toBe("docs/mico/pull-requests/42-add-caching.md");
  });

  it("construye la ruta del digest semanal con el prefijo", () => {
    const path = buildRepoDigestPath("docs/mico", "acme/web", "2026-W34");
    expect(path).toBe("docs/mico/digests/acme-web-2026-W34.md");
  });
});
