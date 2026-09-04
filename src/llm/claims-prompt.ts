import { z } from "zod";
import type { PullRequestData } from "../domain/types.js";
import { buildPrompt } from "./prompt.js";

/**
 * System prompt para la extracción de claims ESTRUCTURADOS (Incremento B). Pide
 * salida JSON estricta en tres categorías del digest v1: qué se hizo,
 * decisiones y pendientes. Mantiene la regla de no inventar: si algo no surge de
 * la evidencia, no se afirma.
 */
export function buildClaimsSystemPrompt(language: "es" | "en" = "es"): string {
  const isEn = language === "en";
  if (isEn) {
    return [
      "You are a technical assistant that analyzes Pull Requests and extracts verifiable claims.",
      "Respond ONLY with a valid JSON object, without markdown code blocks or extra text.",
      "The JSON must have this exact shape:",
      '{ "overview": string, "did": string[], "decisions": string[], "pending": string[] }',
      "- overview: a brief paragraph (2-4 sentences) summarizing the work of the PR.",
      "- did: what was done (concrete changes), one sentence per item.",
      "- decisions: technical or design decisions made, one per item.",
      "- pending: what was left unfinished or needs follow-up (TODOs), one per item.",
      "Never make things up: rely solely on evidence (description, commits, diffs, reviews).",
      "If a category lacks evidence-backed content, return an empty array.",
      "Write in English, in a professional and concise tone."
    ].join(" ");
  }

  return [
    "Eres un asistente técnico que analiza Pull Requests y extrae afirmaciones (claims) verificables.",
    "Respondes ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código.",
    "El JSON tiene esta forma exacta:",
    '{ "overview": string, "did": string[], "decisions": string[], "pending": string[] }',
    "- overview: un párrafo breve (2-4 frases) que resume el trabajo del PR.",
    "- did: qué se hizo (cambios concretos), una frase por ítem.",
    "- decisions: decisiones técnicas o de diseño tomadas, una por ítem.",
    "- pending: qué quedó sin terminar o por avanzar (TODOs, seguimiento), una por ítem.",
    "Nunca inventes: básate solo en la evidencia (descripción, commits, diffs, reviews).",
    "Si una categoría no tiene contenido respaldado por evidencia, devuelve un arreglo vacío.",
    "Escribe en español, tono profesional y conciso.",
  ].join(" ");
}

/**
 * Construye el prompt de extracción de claims reutilizando el detalle del PR ya
 * armado por `buildPrompt`, y agrega la instrucción de salida JSON.
 */
export function buildClaimsPrompt(pr: PullRequestData): string {
  const base = buildPrompt(pr);
  return [
    base,
    "",
    "---",
    "Extraé los claims de este Pull Request y devolvé SOLO el JSON con las claves overview, did, decisions y pending.",
  ].join("\n");
}

export const claimsResponseSchema = z.object({
  overview: z.string().optional().default(""),
  did: z.array(z.string()).optional().default([]),
  decisions: z.array(z.string()).optional().default([]),
  pending: z.array(z.string()).optional().default([]),
});

export type ClaimsResponse = z.infer<typeof claimsResponseSchema>;

/**
 * Intenta parsear la respuesta cruda del LLM como el JSON de claims. Es
 * tolerante: quita fences de código y aísla el primer objeto `{...}`. Devuelve
 * `null` si no se puede parsear/validar, para que el llamador degrade de forma
 * segura a la narrativa (comportamiento previo) sin romper el flujo.
 */
export function parseClaimsResponse(raw: string): ClaimsResponse | null {
  const candidate = extractJsonObject(raw);
  if (!candidate) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    return null;
  }
  const parsed = claimsResponseSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function extractJsonObject(raw: string): string | null {
  const withoutFences = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return withoutFences.slice(start, end + 1);
}
