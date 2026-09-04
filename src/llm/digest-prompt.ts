import type { StoredWorkEvent } from "../memory/work-event-store.js";

/**
 * System prompt para el OVERVIEW del digest semanal. A diferencia de la
 * extracción de claims, acá se pide texto plano (un párrafo), no JSON: es un
 * resumen ejecutivo para el manager. No debe inventar: se basa en los claims ya
 * derivados y persistidos.
 */
export function buildDigestSystemPrompt(language: "es" | "en" = "es"): string {
  const isEn = language === "en";
  if (isEn) {
    return [
      "You are an assistant that writes the executive summary of a weekly digest for a manager.",
      "Write in English, in a professional and concise tone, in a single paragraph (2-5 sentences).",
      "Rely exclusively on the provided events and claims; do not invent work that is not listed.",
      "Do not use Markdown or lists: just the summary paragraph.",
    ].join(" ");
  }

  return [
    "Eres un asistente que redacta el resumen ejecutivo de un digest semanal para un manager.",
    "Escribes en español, tono profesional y conciso, en un único párrafo (2-5 frases).",
    "Te basas únicamente en los eventos y claims provistos; no inventas trabajo que no figure.",
    "No uses Markdown ni listas: solo el párrafo de resumen.",
  ].join(" ");
}

/** Arma el prompt del overview a partir de los eventos + claims de la ventana. */
export function buildDigestPrompt(
  repository: string,
  events: StoredWorkEvent[],
  language: "es" | "en" = "es"
): string {
  const isEn = language === "en";
  const lines: string[] = [
    isEn ? `# Weekly Digest for ${repository}` : `# Digest semanal de ${repository}`,
    "",
    isEn ? `Work events in this window: ${events.length}.` : `Eventos de trabajo en la ventana: ${events.length}.`,
    "",
  ];

  for (const stored of events) {
    lines.push(`## ${stored.workEvent.title} (${stored.workEvent.occurredAt})`);
    const did = stored.claims.filter((c) => c.category === "what_was_done");
    const decisions = stored.claims.filter((c) => c.category === "decision");
    const pending = stored.claims.filter((c) => c.category === "pending");
    const narrative = stored.claims.filter((c) => c.category === "narrative");

    if (did.length > 0) {
      lines.push("Qué se hizo:");
      for (const c of did) lines.push(`- ${c.text}`);
    }
    if (decisions.length > 0) {
      lines.push("Decisiones:");
      for (const c of decisions) lines.push(`- ${c.text}`);
    }
    if (pending.length > 0) {
      lines.push("Pendientes:");
      for (const c of pending) lines.push(`- ${c.text}`);
    }
    if (did.length === 0 && decisions.length === 0 && pending.length === 0) {
      for (const c of narrative) lines.push(c.text);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "Redactá un único párrafo de resumen ejecutivo del trabajo de la semana.",
  );
  return lines.join("\n");
}
