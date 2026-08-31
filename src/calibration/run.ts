import {
  evaluateGoldenSet,
  formatReport,
} from "./confidence-harness.js";
import { CONFIDENCE_GOLDEN_SET } from "./golden-set.js";

/**
 * Script de calibración manual: evalúa la heurística de confianza contra el
 * golden-set y reporta aciertos/errores. Correr con:
 *
 *   npx tsx src/calibration/run.ts
 *
 * Para calibrar con PRs reales, ampliá `CONFIDENCE_GOLDEN_SET` con casos del
 * repo piloto (ver instrucciones en golden-set.ts) y ajustá los pesos/umbral vía
 * variables de entorno `CONFIDENCE_*` hasta maximizar los aciertos.
 */
const report = evaluateGoldenSet(CONFIDENCE_GOLDEN_SET);
process.stdout.write(`${formatReport(report)}\n`);
if (report.misses > 0) {
  process.exitCode = 1;
}
