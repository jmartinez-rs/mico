import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIDENCE_CONFIG } from "../domain/confidence.js";
import { evaluateGoldenSet } from "./confidence-harness.js";
import { CONFIDENCE_GOLDEN_SET } from "./golden-set.js";

describe("calibración del gate de confianza", () => {
  it("la heurística acierta todo el golden-set con la config por defecto", () => {
    const report = evaluateGoldenSet(CONFIDENCE_GOLDEN_SET);
    if (report.misses > 0) {
      const fails = report.results
        .filter((r) => !r.ok)
        .map((r) => `${r.name}: esperado ${r.expected}, obtenido ${r.actual} (score ${r.score})`)
        .join("\n");
      throw new Error(`Casos fallidos:\n${fails}`);
    }
    expect(report.hits).toBe(report.total);
    expect(report.accuracy).toBe(1);
  });

  it("un umbral más exigente reclasifica casos medium como low", () => {
    const strict = {
      ...DEFAULT_CONFIDENCE_CONFIG,
      reviewThreshold: 0.7,
      highThreshold: 0.9,
    };
    const report = evaluateGoldenSet(CONFIDENCE_GOLDEN_SET, strict);
    // Con umbral 0.7, los casos de score 0.65 (medium por defecto) caen a low.
    const sinDescripcion = report.results.find((r) => r.name === "sin-descripcion");
    expect(sinDescripcion?.actual).toBe("low");
  });
});
