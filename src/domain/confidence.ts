import type { PullRequestData } from "./types.js";
import type { Confidence, ConfidenceLevel } from "./work-event.js";

/**
 * Pesos y umbrales de la heurística de confianza. Son configurables (Incremento
 * C) para poder calibrar el gate contra un golden-set / repo real sin tocar
 * código. Los defaults reproducen exactamente el comportamiento previo.
 */
export interface ConfidenceWeights {
  noBody: number;
  shortBody: number;
  noCommits: number;
  poorCommits: number;
  noFiles: number;
  noDiff: number;
}

export interface ConfidenceConfig {
  /** Umbral del gate: por debajo, se marca revisión humana. */
  reviewThreshold: number;
  /** Score a partir del cual el nivel es `high`. */
  highThreshold: number;
  /** Longitud mínima (chars) para no penalizar una descripción por breve. */
  minBodyLength: number;
  /** Proporción de commits pobres a partir de la cual se penaliza. */
  poorCommitRatio: number;
  weights: ConfidenceWeights;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  reviewThreshold: 0.5,
  highThreshold: 0.75,
  minBodyLength: 30,
  poorCommitRatio: 0.5,
  weights: {
    noBody: 0.35,
    shortBody: 0.15,
    noCommits: 0.1,
    poorCommits: 0.2,
    noFiles: 0.1,
    noDiff: 0.1,
  },
};

/**
 * Umbral por defecto por debajo del cual una afirmación/evento se marca para
 * revisión humana en lugar de afirmar con seguridad falsa (gate del moat,
 * ADR-0002). Se conserva como export para compatibilidad; el valor efectivo es
 * configurable vía `ConfidenceConfig.reviewThreshold`.
 */
export const CONFIDENCE_REVIEW_THRESHOLD =
  DEFAULT_CONFIDENCE_CONFIG.reviewThreshold;

/** Mensajes de commit genéricos que no aportan señal descriptiva. */
const GENERIC_COMMIT_MESSAGES = new Set([
  "wip",
  "fix",
  "fixes",
  "fixed",
  "update",
  "updates",
  "updated",
  "changes",
  "change",
  "changed",
  "misc",
  "stuff",
  "cleanup",
  "tmp",
  "temp",
  "asdf",
  ".",
]);

function classifyLevel(score: number, config: ConfidenceConfig): ConfidenceLevel {
  if (score >= config.highThreshold) {
    return "high";
  }
  if (score >= config.reviewThreshold) {
    return "medium";
  }
  return "low";
}

function isPoorCommitMessage(message: string): boolean {
  const firstLine = (message.split("\n")[0] ?? "").trim().toLowerCase();
  if (firstLine.length === 0) {
    return true;
  }
  if (GENERIC_COMMIT_MESSAGES.has(firstLine)) {
    return true;
  }
  return firstLine.split(/\s+/).filter(Boolean).length <= 1;
}

/**
 * Heurística de confianza para un commit local (daemon). Es el análogo de
 * `computeConfidence` para la señal de un commit: penaliza mensaje genérico,
 * descripción ausente/breve, sin archivos y sin diff. Reutiliza los mismos
 * pesos y umbrales configurables.
 */
export function computeCommitConfidence(
  commit: { message: string; filesChanged: string[]; diff: string },
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): Confidence {
  let score = 1;
  const reasons: string[] = [];
  const { weights } = config;

  const lines = commit.message.split("\n");
  const firstLine = lines[0] ?? "";
  const body = lines.slice(1).join("\n").trim();

  if (body.length === 0) {
    score -= weights.noBody;
    reasons.push("El commit no tiene descripción.");
  } else if (body.length < config.minBodyLength) {
    score -= weights.shortBody;
    reasons.push("La descripción del commit es muy breve.");
  }

  if (isPoorCommitMessage(firstLine)) {
    score -= weights.poorCommits;
    reasons.push("El mensaje del commit es poco descriptivo.");
  }

  if (commit.filesChanged.length === 0) {
    score -= weights.noFiles;
    reasons.push("El commit no modifica archivos.");
  }

  if ((commit.diff ?? "").trim().length === 0) {
    score -= weights.noDiff;
    reasons.push("No hay contexto de diff en el commit.");
  }

  score = Math.max(0, Math.min(1, score));

  if (reasons.length === 0) {
    reasons.push("Señal fuerte: mensaje descriptivo y diff presente.");
  }

  return {
    score: Number(score.toFixed(2)),
    level: classifyLevel(score, config),
    reasons,
  };
}

/**
 * Calcula la confianza de forma heurística y determinista a partir de la fuerza
 * de la señal del PR (descripción, calidad de commits, presencia de diff). No
 * usa el LLM. Parte de 1.0 y penaliza, acumulando motivos legibles. Los pesos y
 * umbrales provienen de `config` (por defecto, `DEFAULT_CONFIDENCE_CONFIG`).
 */
export function computeConfidence(
  pr: PullRequestData,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): Confidence {
  let score = 1;
  const reasons: string[] = [];
  const { weights } = config;

  const body = (pr.body ?? "").trim();
  if (body.length === 0) {
    score -= weights.noBody;
    reasons.push("El PR no tiene descripción.");
  } else if (body.length < config.minBodyLength) {
    score -= weights.shortBody;
    reasons.push("La descripción del PR es muy breve.");
  }

  if (pr.commits.length === 0) {
    score -= weights.noCommits;
    reasons.push("El PR no registra commits.");
  } else {
    const poorCommits = pr.commits.filter((commit) =>
      isPoorCommitMessage(commit.message),
    ).length;
    if (poorCommits / pr.commits.length > config.poorCommitRatio) {
      score -= weights.poorCommits;
      reasons.push(
        "La mayoría de los mensajes de commit son poco descriptivos.",
      );
    }
  }

  if (pr.files.length === 0) {
    score -= weights.noFiles;
    reasons.push("El PR no modifica archivos.");
  } else {
    const filesWithPatch = pr.files.filter(
      (file) => (file.patch ?? "").trim().length > 0,
    ).length;
    if (filesWithPatch === 0) {
      score -= weights.noDiff;
      reasons.push("No hay contexto de diff en los archivos.");
    }
  }

  score = Math.max(0, Math.min(1, score));

  if (reasons.length === 0) {
    reasons.push(
      "Señal fuerte: descripción, commits descriptivos y diffs presentes.",
    );
  }

  return {
    score: Number(score.toFixed(2)),
    level: classifyLevel(score, config),
    reasons,
  };
}

/** Gate: por debajo del umbral, el resultado se marca para revisión humana. */
export function needsHumanReview(
  confidence: Confidence,
  threshold: number = DEFAULT_CONFIDENCE_CONFIG.reviewThreshold,
): boolean {
  return confidence.score < threshold;
}

/**
 * Agrega varias confianzas (p. ej. la de cada `WorkEvent` de una semana) en una
 * sola para el digest. El score agregado es el promedio; el nivel se deriva con
 * los mismos umbrales. Marca revisión humana si CUALQUIER evento cae por debajo
 * del umbral (un digest con eventos dudosos no debe presentarse como cierto).
 */
export function aggregateConfidence(
  items: Confidence[],
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): { confidence: Confidence; needsHumanReview: boolean } {
  if (items.length === 0) {
    return {
      confidence: {
        score: 0,
        level: "low",
        reasons: ["No hay eventos en la ventana para estimar confianza."],
      },
      needsHumanReview: true,
    };
  }

  const avg =
    items.reduce((total, item) => total + item.score, 0) / items.length;
  const score = Number(avg.toFixed(2));
  const lowCount = items.filter(
    (item) => item.score < config.reviewThreshold,
  ).length;

  const reasons: string[] = [
    `Confianza promedio de ${items.length} evento(s): ${score}.`,
  ];
  if (lowCount > 0) {
    reasons.push(
      `${lowCount} evento(s) por debajo del umbral (${config.reviewThreshold}); el digest requiere revisión humana.`,
    );
  } else {
    reasons.push("Todos los eventos superan el umbral de confianza.");
  }

  return {
    confidence: { score, level: classifyLevel(score, config), reasons },
    needsHumanReview: lowCount > 0,
  };
}
