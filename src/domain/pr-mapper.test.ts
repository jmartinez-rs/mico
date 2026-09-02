import { describe, expect, it } from "vitest";
import type { PullRequestData } from "./types.js";
import { mapPullRequestToWorkEvent } from "./pr-mapper.js";

const pr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer to speed up requests",
  author: "jose",
  state: "closed",
  url: "https://github.com/acme/web/pull/42",
  baseBranch: "main",
  headBranch: "feature/cache",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: "2026-08-19T00:00:00Z",
  commits: [
    {
      sha: "abc1234def",
      message: "Add cache layer\n\nmore detail",
      author: "jose",
      url: "https://github.com/acme/web/commit/abc1234def",
    },
  ],
  files: [
    {
      filename: "src/cache.ts",
      status: "added",
      additions: 10,
      deletions: 0,
      changes: 10,
      patch: "+ cache",
    },
  ],
  reviews: [
    { author: "ana", state: "APPROVED", body: "LGTM" },
  ],
};

describe("mapPullRequestToWorkEvent", () => {
  it("mapea un PR a un WorkEvent con id estable y ventana temporal", () => {
    const { workEvent } = mapPullRequestToWorkEvent(pr);
    expect(workEvent.id).toBe("pr-acme-web-42");
    expect(workEvent.type).toBe("pull_request");
    expect(workEvent.repository).toBe("acme/web");
    expect(workEvent.author).toBe("jose");
    expect(workEvent.occurredAt).toBe("2026-08-19T00:00:00Z");
  });

  it("registra la evidencia: PR primero, luego commits y reviews", () => {
    const { workEvent, evidence } = mapPullRequestToWorkEvent(pr);

    const prEvidence = evidence.find((item) => item.kind === "pull_request");
    expect(prEvidence).toMatchObject({
      id: "pr-42",
      url: "https://github.com/acme/web/pull/42",
    });

    const commitEvidence = evidence.find((item) => item.kind === "commit");
    expect(commitEvidence).toMatchObject({
      id: "commit-abc1234def",
      label: "abc1234",
      detail: "Add cache layer",
    });

    expect(evidence.some((item) => item.kind === "review")).toBe(true);
    expect(evidence[0]?.kind).toBe("pull_request");
    expect(workEvent.evidenceIds).toEqual(evidence.map((item) => item.id));
  });

  it("usa createdAt cuando el PR no está mergeado", () => {
    const openPr: PullRequestData = { ...pr, mergedAt: null };
    const { workEvent } = mapPullRequestToWorkEvent(openPr);
    expect(workEvent.occurredAt).toBe("2026-08-18T00:00:00Z");
  });
});
