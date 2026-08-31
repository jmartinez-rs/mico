<div align="center">

<img src="public/img/mico-logo.png" alt="Logo de Mico: mono kawaii con cuaderno y lápiz sobre fondo azul" width="140" />

# Mico 🐒

### Tu proyecto cambia. Mico lo observa y lo recuerda.

**Mico observa lo que construís, entiende los cambios con IA y transforma tu actividad de desarrollo en evidencia, documentación y memoria de proyecto.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-REST-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 💡 ¿Qué es Mico?

Mico es un agente autónomo de desarrollo escrito en **Node.js + TypeScript** que observa la actividad de un repositorio Git y construye una **memoria estructurada de lo que realmente ocurrió en el proyecto**.

En lugar de obligarte a escribir documentación manualmente, Mico toma la evidencia disponible —commits, mensajes, archivos y diffs— y utiliza un LLM para convertirla en información útil:

<div align="center">

<img src="public/img/diagrama.png" alt="Flujo de Mico: tu repositorio Git → commits → Mico (Git + LLM + memoria local) → docs diarias, memoria WorkEvents y digests semanales" width="700" />

</div>

### Mico tiene dos formas de trabajar

**`mico start` — Daemon**

Mico comprueba periódicamente tu repositorio local, detecta nuevos commits, los analiza con IA y actualiza un informe diario en:

```text
docs/mico/YYYY-MM-DD.md
```

Además, cada commit procesado queda guardado como un `WorkEvent`. Eso permite construir resúmenes semanales a partir de la memoria local, sin depender de volver a consultar GitHub.

**`mico serve` — REST API**

Levanta un servidor Fastify para:

- generar documentación desde Pull Requests de GitHub;
- consultar documentos generados;
- consultar la memoria de eventos;
- generar digests semanales;
- publicar documentación en GitHub de forma opcional.

---

# ⚡ Probalo en menos de 2 minutos

Mico está pensado para que puedas probarlo directamente sobre un repositorio existente.

### 1. Inicializá Mico

Desde la raíz de tu proyecto:

```bash
npx mico init
```

Esto crea:

```text
mico.config.json
docs/mico/
```

### 2. Configurá tu proveedor LLM

Editá `mico.config.json`:

```json
{
  "port": 3000,
  "githubToken": "",
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "TU_API_KEY",
    "model": "gpt-4o-mini"
  },
  "documentsPath": "./data/docs",
  "workEventsPath": "./data/work-events",
  "mico": {
    "watchIntervalMs": 10000,
    "targetRepoPath": "./",
    "outputDir": "./docs/mico",
    "stateFile": "./data/mico-state.json"
  }
}
```

No estás limitado a OpenAI. Mico trabaja con cualquier proveedor que exponga una API compatible con OpenAI, por ejemplo:

- OpenAI
- Ollama
- OpenRouter
- Groq
- LM Studio
- otros proveedores compatibles

### 3. Dejá que Mico observe

```bash
npx mico start
```

A partir de ahí, cada commit nuevo que Mico detecte puede convertirse en documentación y memoria de trabajo.

---

# ✨ ¿Qué hace exactamente?

## 🐒 Observa tu actividad

Mico monitoriza el repositorio local mediante polling configurable y detecta nuevos commits sin cambiar tu flujo de trabajo.

## 🤖 Entiende los cambios

No se limita a copiar el mensaje del commit. Utiliza un LLM para analizar la evidencia disponible y generar un resumen contextual.

## 📅 Construye documentación diaria

Cada día genera o actualiza:

```text
docs/mico/2026-08-31.md
```

Con información como:

- resumen del día;
- commits detectados;
- cambios realizados;
- impacto;
- evidencia asociada.

## 🧠 Mantiene memoria del trabajo

Cada commit procesado por el daemon se persiste como un `WorkEvent`.

Un evento puede contener:

```text
repository
commit / PR
timestamp
evidence
claims
confidence
needsHumanReview
```

Esto permite consultar posteriormente **qué se hizo, cuándo y con qué nivel de confianza**.

## 📊 Genera digests semanales

Mico puede agrupar los eventos de la semana y producir un resumen con:

- avances;
- decisiones;
- pendientes;
- señales de drift;
- actividad relevante.

La idea es simple: **tener una memoria del proyecto basada en evidencia, no en lo que alguien recuerda que ocurrió.**

## 🚦 No todo se acepta ciegamente

Mico incorpora un **Confidence Gate**.

El score de confianza se calcula utilizando heurísticas deterministas basadas, entre otras cosas, en:

- calidad de la descripción;
- calidad de los mensajes de commit;
- presencia de archivos;
- información disponible en los diffs.

Cuando el score queda por debajo de `reviewThreshold`, Mico marca el resultado:

```json
{
  "needsHumanReview": true
}
```

La IA ayuda a interpretar la evidencia; el gate intenta evitar que interpretaciones débiles se presenten como hechos.

---

# 🛠️ Instalación

Podés utilizar Mico sin clonar este repositorio:

```bash
npx mico init
npx mico start
```

O instalarlo globalmente:

```bash
npm install -g mico

mico init
mico start
```

Para ejecutar el servidor REST:

```bash
npx mico serve
```

---

# 🌐 API REST

Con:

```bash
npx mico serve
```

Mico expone:

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio |
| `POST` | `/v1/documents/from-pull-request` | Genera documentación desde un PR |
| `GET` | `/v1/documents` | Lista documentos generados |
| `GET` | `/v1/documents/:id` | Obtiene un documento |
| `GET` | `/v1/work-events` | Consulta la memoria de trabajo |
| `GET` | `/v1/work-events/:id` | Obtiene un evento |
| `POST` | `/v1/digests/weekly` | Genera o recupera un digest semanal |

## Generar documentación desde un Pull Request

```bash
curl -X POST http://localhost:3000/v1/documents/from-pull-request \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "owner/repo",
    "pullRequestNumber": 123
  }'
```

## Generar un digest semanal

```bash
curl -X POST http://localhost:3000/v1/digests/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "owner/repo"
  }'
```

> El digest utiliza `workEventsPath` como memoria. Esto permite resumir los eventos capturados por el daemon sin depender de consultar GitHub nuevamente.

---

# 📄 Un informe generado por Mico

Por ejemplo:

```markdown
# Informe de Desarrollo - 2026-08-31 🐒

> Documento generado por **Mico**, el agente observador de desarrollo.

## 📌 Visión General del Día

Este informe documenta las tareas y cambios realizados durante el día
2026-08-31.

## 📜 Registro de Commits e Implementaciones

### 🔨 Commit `a1b2c3d`
**feat: agregar autenticación de usuarios**

- **Hora:** `14:30:15`
- **Autor:** Jose
- **Hash:** `a1b2c3d4e5f6...`

#### Resumen Ejecutivo

Se implementó el servicio de autenticación y gestión de sesiones.

#### Cambios Realizados

- Middleware de verificación de tokens
- Rutas de login y logout

#### Impacto

El módulo de seguridad y determinados endpoints de la API
quedan protegidos mediante autenticación.
```

---

# ⚙️ Configuración

Mico resuelve la configuración en este orden:

```text
Variables de entorno
        ↓
mico.config.json
        ↓
valores por defecto
```

| Configuración | Variable de entorno | Default |
|---|---|---|
| `llm.apiKey` | `LLM_API_KEY` | **Obligatorio** |
| `llm.baseUrl` | `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `llm.model` | `LLM_MODEL` | `gpt-4o-mini` |
| `githubToken` | `GITHUB_TOKEN` | vacío |
| `port` | `PORT` | `3000` |
| `mico.watchIntervalMs` | `MICO_WATCH_INTERVAL_MS` | `10000` |
| `mico.targetRepoPath` | `MICO_TARGET_REPO_PATH` | `./` |
| `mico.outputDir` | `MICO_OUTPUT_DIR` | `./docs/mico` |
| `mico.stateFile` | `MICO_STATE_FILE` | `./data/mico-state.json` |
| `documentsPath` | `DOCUMENTS_PATH` | `./data/docs` |
| `workEventsPath` | `WORK_EVENTS_PATH` | `./data/work-events` |
| `publish.toRepo` | `PUBLISH_TO_REPO` | `false` |
| `publish.repo` | `PUBLISH_REPO` | vacío |
| `publish.branch` | `PUBLISH_BRANCH` | vacío |
| `publish.pathPrefix` | `PUBLISH_PATH_PREFIX` | `docs/mico` |
| `confidence.*` | `CONFIDENCE_*` | ver calibración |

### Publicación en GitHub

La publicación al repositorio está desactivada por defecto.

Para habilitarla:

```json
{
  "publish": {
    "toRepo": true,
    "repo": "owner/repo",
    "branch": "main",
    "pathPrefix": "docs/mico"
  }
}
```

Esto permite que la documentación generada por Mico quede almacenada en el repositorio como evidencia del trabajo realizado.

---

# 🎯 Calibración del Confidence Gate

La lógica de confianza es determinista y configurable.

Podés evaluarla contra el golden set del proyecto:

```bash
npm run calibrate
```

El harness utiliza:

```text
src/calibration/golden-set.ts
```

La idea es ampliar ese conjunto con casos reales y ajustar los pesos/umbrales para que el sistema distinga mejor entre resultados confiables y resultados que necesitan revisión humana.

---

# 🧪 Desarrollo local

Cloná el repositorio e instalá las dependencias:

```bash
npm install
```

Desarrollo del daemon:

```bash
npm run dev
```

Servidor REST:

```bash
npx tsx src/cli.ts serve
```

Tests:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Calibración:

```bash
npm run calibrate
```

---

# 🐳 Docker

Construir la imagen:

```bash
docker build -t mico .
```

Daemon:

```bash
docker run --rm --env-file .env mico
```

Servidor REST:

```bash
docker run --rm \
  -p 3000:3000 \
  --env-file .env \
  -e MICO_MODE=server \
  mico
```

`MICO_MODE` acepta:

```text
daemon   # default
server
```

---

# 🏗️ Filosofía

Mico parte de una idea bastante concreta:

> **El código cambia constantemente. La documentación, casi nunca.**

Los commits ya contienen una parte importante del contexto de desarrollo. El problema es que esa información suele quedar dispersa entre Git, Pull Requests, mensajes y memoria humana.

Mico intenta cerrar ese espacio:

```text
Código
  ↓
Evidencia
  ↓
Interpretación
  ↓
Memoria
  ↓
Documentación
  ↓
Resumen
```

No intenta reemplazar al desarrollador.

Intenta hacer que **el trabajo que ya hiciste sea más fácil de entender, recuperar y comunicar**.

---

# 🚀 Roadmap

Algunas líneas naturales de evolución del proyecto:

- mejorar la calidad de los resúmenes mediante más contexto;
- enriquecer la memoria de eventos;
- ampliar la integración con GitHub;
- mejorar la detección de drift;
- incorporar más fuentes de evidencia además de Git;
- añadir más controles sobre la confianza y revisión humana.

---

# 📁 Estructura principal

```text
.
├── docs/
│   └── mico/
│       └── YYYY-MM-DD.md
├── data/
│   ├── docs/
│   ├── work-events/
│   └── mico-state.json
├── src/
│   ├── calibration/
│   └── ...
├── mico.config.json
└── package.json
```

---

# 📄 Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE).
