import { describe, expect, it } from "vitest";
import type { Confidence, Evidence } from "../domain/work-event.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PullRequestData } from "../models/index.js";
import { extractClaims } from "./claim-extractor.js";

const pr: PullRequestData = {
  repository: "acme/web",
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer",
  author: "jose",
  state: "closed",
  url: "https://github.com/acme/web/pull/42",
  baseBranch: "main",
  headBranch: "feature/cache",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: "2026-08-19T00:00:00Z",
  commits: [],
  files: [],
  reviews: [],
};

const evidence: Evidence[] = [
  {
    id: "pr-42",
    kind: "pull_request",
    label: "PR #42",
    url: "https://github.com/acme/web/pull/42",
  },
];

const confidence: Confidence = {
  score: 0.9,
  level: "high",
  reasons: ["Señal fuerte."],
};

function llmReturning(text: string): LLMProvider {
  return { generate: async () => text };
}

describe("extractClaims", () => {
  it("extrae claims estructurados cuando el LLM devuelve JSON", async () => {
    const llm = llmReturning(
      JSON.stringify({
        overview: "Se agregó una capa de caché con TTL.",
        did: ["Se implementó la caché en memoria", "Se agregaron tests"],
        decisions: ["Se eligió TTL fijo de 60s"],
        pending: ["Falta métrica de hit-rate"],
      }),
    );

    const result = await extractClaims({
      llm,
      pr,
      workEventId: "pr-acme-web-42",
      evidence,
      confidence,
    });

    expect(result.structured).toBe(true);
    expect(result.narrative).toContain("caché");
    expect(result.claims.filter((c) => c.category === "what_was_done")).toHaveLength(2);
    expect(result.claims.filter((c) => c.category === "decision")).toHaveLength(1);
    expect(result.claims.filter((c) => c.category === "pending")).toHaveLength(1);
    expect(result.claims[0]?.evidenceIds).toContain("pr-42");
  });

  it("tolera JSON envuelto en fences de código", async () => {
    const llm = llmReturning(
      '```json\n{ "did": ["hizo algo"], "decisions": [], "pending": [] }\n```',
    );
    const result = await extractClaims({
      llm,
      pr,
      workEventId: "pr-acme-web-42",
      evidence,
      confidence,
    });
    expect(result.structured).toBe(true);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]?.category).toBe("what_was_done");
  });

  it("degrada a un claim narrativo cuando el LLM no devuelve JSON válido", async () => {
    const llm = llmReturning("## Resumen\nSe agregó una capa de caché.");
    const result = await extractClaims({
      llm,
      pr,
      workEventId: "pr-acme-web-42",
      evidence,
      confidence,
    });

    expect(result.structured).toBe(false);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]?.category).toBe("narrative");
    expect(result.narrative).toContain("Se agregó una capa de caché.");
  });
});
