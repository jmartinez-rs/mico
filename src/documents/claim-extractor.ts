import type { Claim, Confidence, Evidence } from "../domain/work-event.js";
import type { LLMProvider } from "../llm/provider.js";
import {
  buildClaimsSystemPrompt,
  buildClaimsPrompt,
  parseClaimsResponse,
  type ClaimsResponse,
} from "../llm/claims-prompt.js";
import type { PullRequestData } from "../domain/types.js";

export interface ExtractClaimsInput {
  llm: LLMProvider;
  pr: PullRequestData;
  workEventId: string;
  evidence: Evidence[];
  confidence: Confidence;
  language?: "es" | "en";
}

export interface ExtractedClaims {
  claims: Claim[];
  narrative: string;
  /** `true` si se obtuvieron claims estructurados; `false` si se degradó. */
  structured: boolean;
}

/**
 * Deriva los claims de un PR usando el LLM. Pide JSON estructurado (qué se hizo
 * / decisiones / pendientes) y lo valida con Zod. Si el parseo falla, degrada de
 * forma segura a un ÚNICO claim narrativo (el comportamiento previo), sin romper
 * el flujo. La confianza del evento se propaga a cada claim (piloto).
 */
export async function extractClaims(
  input: ExtractClaimsInput,
): Promise<ExtractedClaims> {
  const { llm, pr, workEventId, evidence, confidence, language = "es" } = input;
  const evidenceIds = evidence.map((item) => item.id);

  const raw = await llm.generate({
    system: buildClaimsSystemPrompt(language),
    prompt: buildClaimsPrompt(pr),
  });

  const parsed = parseClaimsResponse(raw);
  if (!parsed || isEmpty(parsed)) {
    const narrative = raw.trim();
    return {
      structured: false,
      narrative,
      claims: [
        {
          id: `claim-${workEventId}-narrative`,
          category: "narrative",
          text: narrative,
          confidence,
          evidenceIds,
        },
      ],
    };
  }

  const claims: Claim[] = [];
  appendCategory(claims, parsed.did, "what_was_done", workEventId, confidence, evidenceIds);
  appendCategory(claims, parsed.decisions, "decision", workEventId, confidence, evidenceIds);
  appendCategory(claims, parsed.pending, "pending", workEventId, confidence, evidenceIds);

  const narrative = parsed.overview.trim() || composeNarrative(parsed);

  return { structured: true, narrative, claims };
}

function appendCategory(
  claims: Claim[],
  texts: string[],
  category: Claim["category"],
  workEventId: string,
  confidence: Confidence,
  evidenceIds: string[],
): void {
  texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .forEach((text, index) => {
      claims.push({
        id: `claim-${workEventId}-${category}-${index}`,
        category,
        text,
        confidence,
        evidenceIds,
      });
    });
}

function isEmpty(parsed: ClaimsResponse): boolean {
  return (
    parsed.did.length === 0 &&
    parsed.decisions.length === 0 &&
    parsed.pending.length === 0 &&
    parsed.overview.trim().length === 0
  );
}

function composeNarrative(parsed: ClaimsResponse): string {
  if (parsed.did.length > 0) {
    return `Se trabajó en: ${parsed.did.join("; ")}.`;
  }
  return "Sin resumen disponible a partir de la evidencia.";
}
