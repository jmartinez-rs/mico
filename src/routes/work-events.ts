import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { WorkEventStore } from "../memory/work-event-store.js";

const listQuerySchema = z.object({
  repository: z
    .string()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'Se espera el formato "owner/repo"')
    .optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

const paramsSchema = z.object({
  id: z.string().min(1),
});

/**
 * Endpoints de consulta de la MEMORIA de eventos de trabajo (Incremento A).
 * Aditivos: no alteran los endpoints de documentos existentes.
 */
export async function registerWorkEventRoutes(
  app: FastifyInstance,
  memory: WorkEventStore,
): Promise<void> {
  app.get("/v1/work-events", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const workEvents = await memory.list({
      repository: parsed.data.repository,
      from: parsed.data.from,
      to: parsed.data.to,
    });
    return { workEvents };
  });

  app.get("/v1/work-events/:id", async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const workEvent = await memory.get(parsed.data.id);
    if (!workEvent) {
      return reply
        .status(404)
        .send({ error: "not_found", message: "Evento de trabajo no encontrado." });
    }
    return workEvent;
  });
}
