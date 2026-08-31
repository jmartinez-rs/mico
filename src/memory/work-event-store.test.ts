import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Confidence } from "../domain/work-event.js";
import { WorkEventStore, type StoredWorkEvent } from "./work-event-store.js";

const confidence: Confidence = {
  score: 0.9,
  level: "high",
  reasons: ["Señal fuerte."],
};

function makeRecord(
  overrides: Partial<StoredWorkEvent> = {},
): StoredWorkEvent {
  return {
    workEvent: {
      id: "pr-acme-web-42",
      type: "pull_request",
      repository: "acme/web",
      title: "Add caching",
      author: "jose",
      url: "https://github.com/acme/web/pull/42",
      occurredAt: "2026-08-19T00:00:00Z",
      evidenceIds: ["pr-42"],
    },
    evidence: [
      {
        id: "pr-42",
        kind: "pull_request",
        label: "PR #42",
        url: "https://github.com/acme/web/pull/42",
      },
    ],
    claims: [],
    confidence,
    needsHumanReview: false,
    narrative: "Se agregó caché.",
    storedAt: "2026-08-19T01:00:00Z",
    ...overrides,
  };
}

let basePath: string;

beforeEach(async () => {
  basePath = await mkdtemp(join(tmpdir(), "wd-memory-"));
});

afterEach(async () => {
  await rm(basePath, { recursive: true, force: true });
});

describe("WorkEventStore", () => {
  it("persiste y recupera un evento por id", async () => {
    const store = new WorkEventStore(basePath);
    await store.save(makeRecord());

    const found = await store.get("pr-acme-web-42");
    expect(found?.workEvent.title).toBe("Add caching");
    expect(await store.list()).toHaveLength(1);
  });

  it("deduplica por workEvent.id: guardar el mismo PR no duplica (upsert)", async () => {
    const store = new WorkEventStore(basePath);
    await store.save(makeRecord({ narrative: "v1" }));
    await store.save(makeRecord({ narrative: "v2" }));

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.narrative).toBe("v2");
  });

  it("filtra por repository", async () => {
    const store = new WorkEventStore(basePath);
    await store.save(makeRecord());
    await store.save(
      makeRecord({
        workEvent: {
          ...makeRecord().workEvent,
          id: "pr-other-repo-1",
          repository: "other/repo",
        },
      }),
    );

    const acme = await store.list({ repository: "acme/web" });
    expect(acme).toHaveLength(1);
    expect(acme[0]?.workEvent.repository).toBe("acme/web");
  });

  it("filtra por rango de fechas from/to (inclusive) sobre occurredAt", async () => {
    const store = new WorkEventStore(basePath);
    const base = makeRecord();
    await store.save(base); // 2026-08-19
    await store.save(
      makeRecord({
        workEvent: {
          ...base.workEvent,
          id: "pr-acme-web-43",
          occurredAt: "2026-08-25T00:00:00Z",
        },
      }),
    );

    const inWindow = await store.list({
      from: "2026-08-18T00:00:00Z",
      to: "2026-08-20T00:00:00Z",
    });
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0]?.workEvent.id).toBe("pr-acme-web-42");
  });
});
