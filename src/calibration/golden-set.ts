import type { ConfidenceLevel } from "../domain/work-event.js";
import type { PullRequestData } from "../domain/types.js";

/**
 * Caso del golden-set de calibración: un PR de fixture con el nivel de confianza
 * esperado. El harness (Incremento C) evalúa la heurística contra este set para
 * medir aciertos/errores sin necesidad de un repo real.
 */
export interface GoldenCase {
  name: string;
  description: string;
  pr: PullRequestData;
  expectedLevel: ConfidenceLevel;
}

interface PrOverrides {
  body?: string | null;
  commits?: PullRequestData["commits"];
  files?: PullRequestData["files"];
}

function makePr(number: number, overrides: PrOverrides = {}): PullRequestData {
  return {
    repository: "acme/pilot",
    number,
    title: `Caso de calibración ${number}`,
    body:
      overrides.body === undefined
        ? "Descripción rica del cambio, con contexto y motivación suficientes."
        : overrides.body,
    author: "jose",
    state: "closed",
    url: `https://github.com/acme/pilot/pull/${number}`,
    baseBranch: "main",
    headBranch: `feature/${number}`,
    createdAt: "2026-08-18T00:00:00Z",
    mergedAt: "2026-08-19T00:00:00Z",
    commits:
      overrides.commits === undefined
        ? [
            {
              sha: `sha-${number}`,
              message: "Implementa el manejo de caché con expiración por TTL",
              author: "jose",
              url: `https://x/${number}`,
            },
          ]
        : overrides.commits,
    files:
      overrides.files === undefined
        ? [
            {
              filename: "src/cache.ts",
              status: "added",
              additions: 40,
              deletions: 2,
              changes: 42,
              patch: "+ implementación real de la caché",
            },
          ]
        : overrides.files,
    reviews: [],
  };
}

const poorCommits: PullRequestData["commits"] = [
  { sha: "p1", message: "wip", author: null, url: "https://x/p1" },
  { sha: "p2", message: "fix", author: null, url: "https://x/p2" },
];

const fileWithoutPatch: PullRequestData["files"] = [
  {
    filename: "src/cache.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
  },
];

/**
 * Golden-set del piloto: casos de señal buena vs pobre con su nivel esperado.
 * Los scores son deterministas con los defaults de `DEFAULT_CONFIDENCE_CONFIG`:
 *
 * - Señal completa → 1.00 (high)
 * - Buena, sin commits → 0.90 (high)
 * - Sin descripción, resto bien → 0.65 (medium)
 * - Descripción breve + commits pobres → 0.65 (medium)
 * - Señal pobre (sin descripción + commits pobres + sin diff) → 0.35 (low)
 * - Casi vacío (sin descripción + sin commits + sin archivos) → 0.45 (low)
 *
 * Para alimentar PRs reales del repo piloto más adelante: exportá el PR con el
 * `GitHubClient`, construí el `PullRequestData`, asigná el `expectedLevel` que
 * un humano considere correcto y agregá el caso a este arreglo.
 */
export const CONFIDENCE_GOLDEN_SET: GoldenCase[] = [
  {
    name: "senal-completa",
    description: "Descripción rica, commit descriptivo y diff presente.",
    pr: makePr(1),
    expectedLevel: "high",
  },
  {
    name: "buena-sin-commits",
    description: "Buena descripción y diff, pero sin commits registrados.",
    pr: makePr(2, { commits: [] }),
    expectedLevel: "high",
  },
  {
    name: "sin-descripcion",
    description: "Sin descripción, pero commit descriptivo y diff presente.",
    pr: makePr(3, { body: "" }),
    expectedLevel: "medium",
  },
  {
    name: "breve-y-commits-pobres",
    description: "Descripción muy breve y mayoría de commits genéricos.",
    pr: makePr(4, { body: "arregla bug", commits: poorCommits }),
    expectedLevel: "medium",
  },
  {
    name: "senal-pobre",
    description: "Sin descripción, commits genéricos y sin diff.",
    pr: makePr(5, { body: "", commits: poorCommits, files: fileWithoutPatch }),
    expectedLevel: "low",
  },
  {
    name: "casi-vacio",
    description: "Sin descripción, sin commits y sin archivos modificados.",
    pr: makePr(6, { body: "", commits: [], files: [] }),
    expectedLevel: "low",
  },
];
