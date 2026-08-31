import { describe, expect, it } from "vitest";
import type { Claim, Confidence } from "../domain/work-event.js";
import type { StoredWorkEvent } from "../memory/work-event-store.js";
import { buildWeeklyDigestView, detectDrift, isoWeekLabel } from "./digest.js";

function claim(
  id: string,
  category: Claim["category"],
  text: string,
  confidence: Confidence,
): Claim {
  return { id, category, text, confidence, evidenceIds: ["pr-1"] };
}

function storedEvent(
  overrides: Partial<StoredWorkEvent> & { id: string; confidence: Confidence },
): StoredWorkEvent {
  const { id, confidence, ...rest } = overrides;
  return {
    workEvent: {
      id,
      type: "pull_request",
      repository: "acme/web",
      title: `Evento ${id}`,
      author: "jose",
      url: `https://github.com/acme/web/pull/${id}`,
      occurredAt: "2026-08-19T00:00:00Z",
      evidenceIds: ["pr-1"],
    },
    evidence: [
      {
        id: "pr-1",
        kind: "pull_request",
        label: "PR #1",
        url: "https://github.com/acme/web/pull/1",
      },
      {
        id: "commit-a",
        kind: "commit",
        label: "aaaaaaa",
        url: "https://x/a",
      },
    ],
    claims: [],
    confidence,
    needsHumanReview: confidence.score < 0.5,
    narrative: "n",
    storedAt: "2026-08-19T01:00:00Z",
    ...rest,
  };
}

const high: Confidence = { score: 0.9, level: "high", reasons: ["Señal fuerte."] };
const low: Confidence = {
  score: 0.3,
  level: "low",
  reasons: ["El PR no tiene descripción."],
};

describe("buildWeeklyDigestView", () => {
  it("agrega claims de más de un evento por categoría", () => {
    const events: StoredWorkEvent[] = [
      storedEvent({
        id: "pr-acme-web-1",
        confidence: high,
        claims: [
          claim("c1", "what_was_done", "Hizo A", high),
          claim("c2", "decision", "Decidió X", high),
        ],
      }),
      storedEvent({
        id: "pr-acme-web-2",
        confidence: high,
        claims: [
          claim("c3", "what_was_done", "Hizo B", high),
          claim("c4", "pending", "Falta Y", high),
        ],
      }),
    ];

    const view = buildWeeklyDigestView({
      repository: "acme/web",
      from: "2026-08-17T00:00:00Z",
      to: "2026-08-23T23:59:59Z",
      weekLabel: "2026-W34",
      events,
    });

    expect(view.eventCount).toBe(2);
    expect(view.did).toHaveLength(2);
    expect(view.decisions).toHaveLength(1);
    expect(view.pending).toHaveLength(1);
    expect(view.overview.length).toBeGreaterThan(0);
  });

  it("agrega la confianza y marca revisión humana si hay eventos de baja confianza", () => {
    const events: StoredWorkEvent[] = [
      storedEvent({ id: "pr-acme-web-1", confidence: high, claims: [] }),
      storedEvent({ id: "pr-acme-web-2", confidence: low, claims: [] }),
    ];

    const view = buildWeeklyDigestView({
      repository: "acme/web",
      from: "2026-08-17T00:00:00Z",
      to: "2026-08-23T23:59:59Z",
      weekLabel: "2026-W34",
      events,
    });

    expect(view.needsHumanReview).toBe(true);
    expect(view.confidence.score).toBeCloseTo(0.6, 5);
  });

  it("usa el overview provisto (p. ej. del LLM) cuando está presente", () => {
    const view = buildWeeklyDigestView({
      repository: "acme/web",
      from: "2026-08-17T00:00:00Z",
      to: "2026-08-23T23:59:59Z",
      weekLabel: "2026-W34",
      events: [storedEvent({ id: "pr-acme-web-1", confidence: high, claims: [] })],
      overview: "Resumen provisto por el LLM.",
    });
    expect(view.overview).toBe("Resumen provisto por el LLM.");
  });
});

describe("detectDrift", () => {
  it("señala PRs sin descripción y trabajo sin commits", () => {
    const noCommits = storedEvent({
      id: "pr-acme-web-3",
      confidence: low,
      evidence: [
        {
          id: "pr-1",
          kind: "pull_request",
          label: "PR #3",
          url: "https://github.com/acme/web/pull/3",
        },
      ],
      claims: [],
    });
    const signals = detectDrift([noCommits]);
    const reasons = signals.map((s) => s.reason);
    expect(reasons).toContain("Sin descripción.");
    expect(reasons.some((r) => r.includes("No hay commits"))).toBe(true);
  });
});

describe("isoWeekLabel", () => {
  it("calcula la etiqueta ISO de semana", () => {
    expect(isoWeekLabel("2026-08-19T00:00:00Z")).toMatch(/^2026-W\d{2}$/);
  });
});
