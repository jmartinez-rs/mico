import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DigestService } from "../documents/digest-service.js";

const weeklyDigestSchema = z
  .object({
    repository: z
      .string()
      .regex(/^[^/\s]+\/[^/\s]+$/, 'Se espera el formato "owner/repo"'),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    uploadToRepo: z.boolean().optional(),
  })
  .refine((data) => (data.from ? Boolean(data.to) : !data.to), {
    message: "from y to deben proveerse juntos o ninguno.",
    path: ["to"],
  });

/**
 * Endpoint del digest semanal (Incremento B). Aditivo. Lee la memoria y produce
 * el digest de la ventana (semana por defecto si no se pasa `from`/`to`).
 */
export async function registerDigestRoutes(
  app: FastifyInstance,
  service: DigestService,
): Promise<void> {
  app.post("/v1/digests/weekly", async (request, reply) => {
    const parsed = weeklyDigestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    try {
      const result = await service.generateWeekly({
        repository: parsed.data.repository,
        from: parsed.data.from,
        to: parsed.data.to,
        uploadToRepo: parsed.data.uploadToRepo,
      });
      // Subida best-effort: si falló no rompe el request; se loguea y se
      // responde 201 con `repoUpload.committed=false`.
      if (result.repoUpload?.committed === false && result.repoUpload.error) {
        request.log.error(
          { path: result.repoUpload.path, err: result.repoUpload.error },
          "Falló la subida del digest al repo (best-effort)",
        );
      }
      return reply.status(201).send(result);
    } catch (error: unknown) {
      request.log.error(error);
      return reply
        .status(500)
        .send({ error: "internal_error", message: "Error generando el digest." });
    }
  });
}
