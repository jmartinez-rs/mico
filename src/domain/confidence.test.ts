import { describe, expect, it } from "vitest";
import type { PullRequestData } from "./types.js";
import {
  CONFIDENCE_REVIEW_THRESHOLD,
  computeConfidence,
  needsHumanReview,
} from "./confidence.js";

function makePr(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    repository: "acme/web",
    number: 42,
    title: "Add caching",
    body: "Adds a cache layer to speed up repeated requests significantly.",
    author: "jose",
    state: "closed",
    url: "https://github.com/acme/web/pull/42",
    baseBranch: "main",
    headBranch: "feature/cache",
    createdAt: "2026-08-18T00:00:00Z",
    mergedAt: "2026-08-19T00:00:00Z",
    commits: [
      {
        sha: "abc1234",
        message: "Add in-memory cache with TTL",
        author: "jose",
        url: "https://x/1",
      },
    ],
    files: [
      {
        filename: "src/cache.ts",
        status: "added",
        additions: 10,
        deletions: 0,
        changes: 10,
        patch: "+ cache implementation",
      },
    ],
    reviews: [],
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("señal buena: confianza alta y sin revisión humana", () => {
    const confidence = computeConfidence(makePr());
    expect(confidence.score).toBe(1);
    expect(confidence.level).toBe("high");
    expect(needsHumanReview(confidence)).toBe(false);
  });

  it("señal pobre: descripción vacía + commits genéricos + sin diff bajan la confianza", () => {
    const confidence = computeConfidence(
      makePr({
        body: "",
        commits: [
          { sha: "a", message: "wip", author: null, url: "https://x/a" },
          { sha: "b", message: "fix", author: null, url: "https://x/b" },
        ],
        files: [
          {
            filename: "src/cache.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            changes: 1,
          },
        ],
      }),
    );

    expect(confidence.level).toBe("low");
    expect(confidence.score).toBeLessThan(CONFIDENCE_REVIEW_THRESHOLD);
    expect(confidence.reasons.length).toBeGreaterThan(1);
  });
});

describe("needsHumanReview (gate)", () => {
  it("marca revisión humana cuando la señal es pobre", () => {
    const confidence = computeConfidence(
      makePr({
        body: "",
        commits: [{ sha: "a", message: "wip", author: null, url: "https://x/a" }],
        files: [
          {
            filename: "a.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            changes: 1,
          },
        ],
      }),
    );
    expect(needsHumanReview(confidence)).toBe(true);
  });

  it("no marca revisión humana cuando la señal es buena", () => {
    expect(needsHumanReview(computeConfidence(makePr()))).toBe(false);
  });
});
