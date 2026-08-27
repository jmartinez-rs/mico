# WorkingDocs — MVP

Microservicio REST ligero, en TypeScript sobre Node.js, que genera documentación Markdown **trazable** a partir de Pull Requests de GitHub usando un LLM.

Es la Fase 1 del producto WorkingDocs (ver `docs/`): convertir el trabajo real (PRs, commits, diffs) en documentación viva.

## Arquitectura

```
Cliente REST
    ↓
API Fastify + TypeScript
    ↓
GitHub API (Octokit)
    ↓
Proveedor LLM (compatible OpenAI)
    ↓
Generador Markdown
    ↓
Carpeta /data/docs
```

El proveedor LLM es **compatible con la API de OpenAI**: basta con configurar `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL`, por lo que funciona con Opencode, OpenAI o cualquier endpoint compatible.

## Requisitos

- Node.js >= 20
- Un token de GitHub (`GITHUB_TOKEN`)
- API key de un proveedor LLM compatible con OpenAI

## Configuración

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Descripción | Default |
| --- | --- | --- |
| `PORT` | Puerto HTTP | `3000` |
| `GITHUB_TOKEN` | Token de acceso a GitHub | — (obligatorio) |
| `LLM_BASE_URL` | Base URL del endpoint compatible con OpenAI | `https://api.openai.com/v1` |
| `LLM_API_KEY` | API key del proveedor LLM | — (obligatorio) |
| `LLM_MODEL` | Modelo a utilizar | `gpt-4o-mini` |
| `DOCUMENTS_PATH` | Carpeta donde se guardan los documentos | `./data/docs` |

> Las API keys **nunca** se envían desde el frontend ni se almacenan en los documentos.

## Uso

```bash
npm install
npm run dev      # desarrollo con recarga
npm run build    # compila a dist/
npm start        # ejecuta la build
npm test         # corre los tests
```

## Endpoints

```
GET  /health
POST /v1/documents/from-pull-request
GET  /v1/documents
GET  /v1/documents/:id
```

### Generar documentación desde un PR

```bash
curl -X POST http://localhost:3000/v1/documents/from-pull-request \
  -H "Content-Type: application/json" \
  -d '{ "repository": "owner/repo", "pullRequestNumber": 123 }'
```

Respuesta:

```json
{
  "status": "completed",
  "id": "…",
  "filePath": "data/docs/pull-requests/123-feature-login.md",
  "documentUrl": null
}
```

## Estructura del proyecto

```
src/
├── index.ts              # Entry point
├── server.ts             # Construcción del servidor Fastify + wiring
├── config.ts             # Carga y validación de env (Zod)
├── routes/
│   ├── health.ts
│   └── documents.ts
├── github/
│   └── github-client.ts  # Lectura de PRs con Octokit
├── llm/
│   ├── provider.ts       # Abstracción LLMProvider
│   ├── openai-provider.ts# Provider compatible con OpenAI
│   └── prompt.ts         # Construcción del prompt
├── documents/
│   ├── document-service.ts
│   ├── markdown-writer.ts
│   └── document-store.ts # Índice persistente (JSON)
└── models/
    └── index.ts          # Tipos compartidos
```

## Docker

```bash
docker build -t workingdocs .
docker run --rm -p 3000:3000 --env-file .env workingdocs
```

## Roadmap

Según los PRD en `docs/`:

- **Fase 1 (este MVP):** generación de docs desde PRs
- **Fase 2:** sesiones de documentación activa (polling de commits/PRs por rama)
- **Fase 3:** web app (dashboard, editor, búsqueda, versionado)
- **Fase 4:** integraciones (Jira, Confluence) y MCP para Claude Code / Cursor
```
