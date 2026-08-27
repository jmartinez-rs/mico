# WorkingDocs — MVP: Microservicio REST (GitHub → Markdown)

# WorkingDocs — MVP: Microservicio REST (GitHub → Markdown)

## Visión del MVP

Microservicio REST ligero, en TypeScript sobre Node.js, que genera documentación Markdown a partir de pull requests de GitHub.

## Arquitectura

```
Cliente REST
    ↓
API Node.js + TypeScript
    ↓
GitHub API / Octokit
    ↓
Proveedor LLM
    ↓
Generador Markdown
    ↓
Carpeta /docs
```

## Stack recomendado

- **Runtime:** Node.js + TypeScript
- **API:** Fastify
- **Validación:** Zod
- **GitHub:** Octokit
- **LLM:** SDK de Anthropic u OpenAI
- **Markdown:** Handlebars o generado directamente
- **Tests:** Vitest
- **Despliegue:** Docker

## Endpoint principal

**POST /v1/documents/from-pull-request**

Request:

```json
{
  "repository": "owner/repository",
  "pullRequestNumber": 123,
  "outputDirectory": "./docs"
}
```

Response:

```json
{
  "status": "completed",
  "filePath": "docs/pull-requests/123-feature-login.md",
  "documentUrl": null
}
```

## Endpoints mínimos

```
GET  /health
POST /v1/documents/from-pull-request
GET  /v1/documents
GET  /v1/documents/:id
```

Los documentos se persisten inicialmente en un volumen local (`/data/docs/`). Más adelante se podrá reemplazar por S3, PostgreSQL u otro almacenamiento.

## Configuración

```bash
PORT=3000
GITHUB_TOKEN=...
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
LLM_MODEL=...
DOCUMENTS_PATH=/data/docs
```

> Las API keys **nunca** se envían desde el frontend ni se almacenan en los documentos.

## Estructura del proyecto

```
src/
├── server.ts
├── routes/
│   ├── health.ts
│   └── documents.ts
├── github/
│   └── github-client.ts
├── llm/
│   ├── provider.ts
│   └── anthropic-provider.ts
├── documents/
│   ├── document-service.ts
│   └── markdown-writer.ts
├── models/
└── config.ts
```

## Criterio de éxito

El usuario puede hacer `POST /v1/documents/from-pull-request` con un repo y PR, recibir la ruta del Markdown generado, y verificar que el archivo existe con contenido útil y trazable.

## Evolución

La primera versión será síncrona y simple. Posteriormente se podrán añadir trabajos asíncronos, colas, autenticación de usuarios, webhooks y una interfaz web.