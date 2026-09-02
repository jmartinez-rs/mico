import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LLMProvider } from "../llm/provider.js";
import { WorkEventStore } from "../memory/work-event-store.js";
import type { StoredWorkEvent } from "../memory/work-event-store.js";
import { DigestService } from "./digest-service.js";

const fakeLlm: LLMProvider = {
  generate: async () => "Resumen semanal generado por el LLM fake.",
};

function makeStoredEvent(repository: string, title: string, occurredAt: string): StoredWorkEvent {
  const slug = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const id = `commit-${repository.replace("/", "-")}-${slug}`;
  return {
    workEvent: {
      id,
      type: "commit",
      repository,
      title,
      author: "Test Dev",
      url: `https://github.com/${repository}/commit/${slug}`,
      occurredAt,
      evidenceIds: [`evidence-${id}-commit`],
    },
    evidence: [
      {
        id: `evidence-${id}-commit`,
        kind: "commit",
        label: `${slug} — ${title}`,
        url: `https://github.com/${repository}/commit/${slug}`,
        detail: title,
      },
    ],
    claims: [
      {
        id: `claim-${id}-narrative`,
        category: "narrative",
        text: title,
        confidence: { score: 1, level: "high", reasons: ["Señal fuerte."] },
        evidenceIds: [`evidence-${id}-commit`],
      },
    ],
    confidence: { score: 1, level: "high", reasons: ["Señal fuerte."] },
    needsHumanReview: false,
    narrative: title,
    storedAt: new Date().toISOString(),
  };
}

describe("DigestService", () => {
  let tempDir: string;
  let memory: WorkEventStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mico-digest-test-"));
    memory = new WorkEventStore(join(tempDir, "work-events"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("genera el digest semanal desde la memoria local", async () => {
    const now = new Date().toISOString();
    await memory.save(makeStoredEvent("acme/eaos-app", "feat: tarea de la semana", now));

    const service = new DigestService(memory, fakeLlm, join(tempDir, "docs"));
    const result = await service.generateWeekly({ repository: "acme/eaos-app" });

    expect(result.status).toBe("completed");
    expect(result.eventCount).toBe(1);
    expect(result.weekLabel).toMatch(/^\d{4}-W\d{1,2}$/);
    expect(result.needsHumanReview).toBe(false);

    const digest = await readFile(result.filePath, "utf-8");
    expect(digest).toContain("feat: tarea de la semana");
    expect(digest).toContain("acme/eaos-app");
    expect(digest).toContain("Resumen semanal generado por el LLM fake.");
  });

  it("respeta la ventana from/to provista", async () => {
    await memory.save(
      makeStoredEvent("acme/eaos-app", "feat: dentro de la ventana", "2026-08-03T10:00:00.000Z"),
    );
    await memory.save(
      makeStoredEvent("acme/eaos-app", "feat: fuera de la ventana", "2026-07-01T10:00:00.000Z"),
    );

    const service = new DigestService(memory, fakeLlm, join(tempDir, "docs"));
    const result = await service.generateWeekly({
      repository: "acme/eaos-app",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
    });

    expect(result.eventCount).toBe(1);
    const digest = await readFile(result.filePath, "utf-8");
    expect(digest).toContain("feat: dentro de la ventana");
    expect(digest).not.toContain("feat: fuera de la ventana");
  });

  it("degrada a overview determinista si el LLM falla", async () => {
    const now = new Date().toISOString();
    await memory.save(makeStoredEvent("acme/eaos-app", "feat: evento", now));

    const failingLlm: LLMProvider = {
      generate: async () => {
        throw new Error("LLM caído");
      },
    };

    const service = new DigestService(memory, failingLlm, join(tempDir, "docs"));
    const result = await service.generateWeekly({ repository: "acme/eaos-app" });

    expect(result.status).toBe("completed");
    const digest = await readFile(result.filePath, "utf-8");
    expect(digest).toContain("feat: evento");
  });
});