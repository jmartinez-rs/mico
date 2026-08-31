/**
 * Núcleo del dominio (Opción B, ADR-0002): la entidad central es el evento de
 * trabajo (`WorkEvent`) con su evidencia (`Evidence`) y las afirmaciones
 * (`Claim`) que derivan de ella. El documento/digest es una VISTA renderizada
 * sobre este modelo, no la entidad primaria.
 *
 * Estos tipos son dominio puro: sin dependencias de I/O, red ni framework.
 */

export type WorkEventType = "pull_request";

export type EvidenceKind = "pull_request" | "commit" | "review";

/**
 * Artefacto verificable con su link. En el piloto, el link al PR es la unidad
 * mínima de trazabilidad suficiente; los commits y reviews se agregan cuando
 * existen.
 */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  url: string;
  detail?: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Confianza como objeto de primera clase: score numérico (0..1), nivel derivado
 * y motivos legibles que explican por qué. Alimenta el gate de revisión humana.
 */
export interface Confidence {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
}

export type ClaimCategory =
  | "what_was_done"
  | "decision"
  | "pending"
  | "narrative";

/** Afirmación derivada de la evidencia, trazable vía `evidenceIds`. */
export interface Claim {
  id: string;
  category: ClaimCategory;
  text: string;
  confidence: Confidence;
  evidenceIds: string[];
}

/** Unidad de trabajo observada. Entidad central del dominio. */
export interface WorkEvent {
  id: string;
  type: WorkEventType;
  repository: string;
  title: string;
  author: string | null;
  url: string;
  occurredAt: string;
  evidenceIds: string[];
}

/**
 * Agregado de render: el documento/digest es una proyección de esto. Un mismo
 * `WorkEvent` puede proyectarse en distintas vistas (resumen por PR hoy; digest
 * semanal a futuro).
 */
export interface WorkEventDocumentView {
  workEvent: WorkEvent;
  evidence: Evidence[];
  claims: Claim[];
  confidence: Confidence;
  needsHumanReview: boolean;
  narrative: string;
}
