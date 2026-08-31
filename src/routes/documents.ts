import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DocumentService } from "../documents/document-service.js";
import { GitHubError } from "../github/github-client.js";
import { LLMError } from "../llm/provider.js";

const fromPullRequestSchema = z.object({
  repository: z
    .string()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'Se espera el formato "owner/repo"'),
  pullRequestNumber: z.coerce.number().int().positive(),
  uploadToRepo: z.boolean().optional(),
});

const documentParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function registerDocumentRoutes(
  app: FastifyInstance,
  service: DocumentService,
): Promise<void> {
  app.post("/v1/documents/from-pull-request", async (request, reply) => {
    const parsed = fromPullRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    try {
      const result = await service.generateFromPullRequest({
        repository: parsed.data.repository,
        pullRequestNumber: parsed.data.pullRequestNumber,
        uploadToRepo: parsed.data.uploadToRepo,
      });
      // Subida best-effort: si falló no rompe el request; se loguea y se
      // responde 201 con `repoUpload.committed=false`.
      if (result.repoUpload?.committed === false && result.repoUpload.error) {
        request.log.error(
          { path: result.repoUpload.path, err: result.repoUpload.error },
          "Falló la subida del documento al repo (best-effort)",
        );
      }
      return reply.status(201).send(result);
    } catch (error: unknown) {
      if (error instanceof GitHubError) {
        return reply
          .status(error.status && error.status < 500 ? error.status : 502)
          .send({ error: "github_error", message: error.message });
      }
      if (error instanceof LLMError) {
        return reply.status(502).send({ error: "llm_error", message: error.message });
      }
      request.log.error(error);
      return reply
        .status(500)
        .send({ error: "internal_error", message: "Error generando el documento." });
    }
  });

  app.get("/v1/documents", async () => {
    const documents = await service.listDocuments();
    return { documents };
  });

  app.get("/v1/documents/:id", async (request, reply) => {
    const parsed = documentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        issues: parsed.error.issues,
      });
    }

    const document = await service.getDocument(parsed.data.id);
    if (!document) {
      return reply.status(404).send({ error: "not_found", message: "Documento no encontrado." });
    }
    return document;
  });
}
