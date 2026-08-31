import {
  DEFAULT_CONFIDENCE_CONFIG,
  computeConfidence,
  type ConfidenceConfig,
} from "../domain/confidence.js";
import type { ConfidenceLevel } from "../domain/work-event.js";
import type { GoldenCase } from "./golden-set.js";

export interface CalibrationCaseResult {
  name: string;
  expected: ConfidenceLevel;
  actual: ConfidenceLevel;
  score: number;
  ok: boolean;
}

export interface CalibrationReport {
  total: number;
  hits: number;
  misses: number;
  accuracy: number;
  results: CalibrationCaseResult[];
}

/**
 * Evalúa la heurística de confianza contra el golden-set con una configuración
 * dada. No usa red ni LLM: es determinista, apto para test y para un script de
 * calibración manual (Incremento C).
 */
export function evaluateGoldenSet(
  cases: GoldenCase[],
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG,
): CalibrationReport {
  const results: CalibrationCaseResult[] = cases.map((testCase) => {
    const confidence = computeConfidence(testCase.pr, config);
    return {
      name: testCase.name,
      expected: testCase.expectedLevel,
      actual: confidence.level,
      score: confidence.score,
      ok: confidence.level === testCase.expectedLevel,
    };
  });

  const hits = results.filter((result) => result.ok).length;
  const total = results.length;

  return {
    total,
    hits,
    misses: total - hits,
    accuracy: total === 0 ? 0 : Number((hits / total).toFixed(2)),
    results,
  };
}

/** Formatea el reporte como texto legible para el script de calibración. */
export function formatReport(report: CalibrationReport): string {
  const lines: string[] = [
    "Calibración del gate de confianza",
    "=================================",
    "",
  ];
  for (const result of report.results) {
    const mark = result.ok ? "OK " : "XX ";
    lines.push(
      `${mark} ${result.name.padEnd(26)} esperado=${result.expected.padEnd(6)} obtenido=${result.actual.padEnd(6)} score=${result.score}`,
    );
  }
  lines.push(
    "",
    `Aciertos: ${report.hits}/${report.total} (accuracy ${report.accuracy})`,
    `Errores: ${report.misses}`,
  );
  return lines.join("\n");
}
