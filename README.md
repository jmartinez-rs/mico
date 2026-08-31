# Mico 🐒 — Agente Curioso de Monitoreo de Commits y Documentación Viva

**Mico** es un agente autónomo de desarrollo en Node.js y TypeScript empaquetado para ejecutarse fácilmente mediante `npx` o `npm`. Su nombre nace en alusión a los monos pequeños que son curiosos, ágiles y siempre están observando detenidamente lo que hacés en tu repositorio.

Mico tiene **dos modos de operación**:

1. **Daemon (`mico start`)** — corre en segundo plano, escucha los commits de tu repositorio Git local, los analiza con IA (cualquier proveedor compatible con OpenAI) y genera informes diarios en `docs/mico/YYYY-MM-DD.md`. Además persiste cada commit como *evento de trabajo* en su memoria local, de modo que los resúmenes semanales funcionan sin depender de GitHub.
2. **Servidor REST (`mico serve`)** — expone endpoints HTTP (Fastify) para generar documentación desde Pull Requests de GitHub, consultar la memoria de eventos de trabajo y producir resúmenes semanales (digests).

---

## ⚡ Características Principales

- 🐒 **Monitoreo Continuo (Daemon):** Escucha activa de commits en tiempo real sin interrumpir tu flujo de trabajo.
- 🤖 **Análisis con LLM:** Soporta cualquier proveedor compatible con la API de OpenAI (OpenAI, Ollama, OpenRouter, Groq, LM Studio, etc.).
- 📅 **Informes Diarios Automáticos:** Registra avances y resúmenes diarios organizados por fecha (`docs/mico/YYYY-MM-DD.md`).
- 🧠 **Memoria de Eventos de Trabajo:** Cada commit (daemon) o PR (servidor) se persiste como `WorkEvent` con evidencia, afirmaciones (`claims`) y un **score de confianza**.
- 🚦 **Gate de Confianza:** La confianza se calcula con heurísticas deterministas y configurables; por debajo del umbral, el resultado se marca para **revisión humana**.
- 📊 **Digests Semanales:** Agregan la memoria de la semana en un Markdown con avances, decisiones, pendientes y señales de drift.
- 🌐 **Servidor REST Integrado:** Endpoints Fastify para consulta de documentos, eventos de trabajo, digests y generación desde PRs de GitHub.
- 📤 **Publicación al Repo (opt-in):** Sube el Markdown generado al repositorio de GitHub como artefacto/evidencia.
- 🛠️ **Cero Configuración Compleja:** Inicialización instantánea con `npx mico init`.

---

## 📦 Instalación y Uso Rápido

No necesitas clonar este repositorio para usar Mico en tu proyecto. Podés ejecutarlo directamente en la raíz de cualquier repositorio Git:

### 1. Inicializar Mico en tu proyecto

```bash
npx mico init
```

Este comando crea automáticamente:
- El archivo de configuración **`mico.config.json`** (con todos los campos: LLM, persistencia, publish, confianza).
- La carpeta **`docs/mico`** donde se guardarán los informes diarios.

### 2. Configurar las credenciales

Abrí `mico.config.json` y completá `llm.apiKey` (obligatorio). Si vas a usar el servidor REST con PRs de GitHub, completá también `githubToken`:

```json
{
  "port": 3000,
  "githubToken": "",
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "TU_API_KEY_AQUI",
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

*(También podés usar un archivo `.env` o variables de entorno tradicionales si preferís)*.

### 3. Iniciar la escucha del agente (daemon)

```bash
npx mico start
```

O si preferís instalarlo de manera global:

```bash
npm install -g mico
mico start
```

### 4. Levantar el servidor REST

```bash
npx mico serve
```

---

## ⚙️ Opciones de Configuración (`mico.config.json` o `.env`)

Mico resuelve las configuraciones siguiendo este orden de prioridad: **Variables de Entorno > `mico.config.json` > Valores por defecto**.

| Campo en `mico.config.json` | Variable de Entorno | Descripción | Default |
| --- | --- | --- | --- |
| `llm.apiKey` | `LLM_API_KEY` | API Key de tu proveedor LLM | *(Obligatorio)* |
| `llm.baseUrl` | `LLM_BASE_URL` | Base URL compatible con OpenAI | `https://api.openai.com/v1` |
| `llm.model` | `LLM_MODEL` | Modelo LLM a utilizar | `gpt-4o-mini` |
| `githubToken` | `GITHUB_TOKEN` | Token de GitHub (PRs y publish al repo) | *(vacío)* |
| `port` | `PORT` | Puerto del servidor REST | `3000` |
| `mico.watchIntervalMs` | `MICO_WATCH_INTERVAL_MS` | Intervalo de chequeo de commits (ms) | `10000` |
| `mico.targetRepoPath` | `MICO_TARGET_REPO_PATH` | Ruta local del repositorio Git | `./` |
| `mico.outputDir` | `MICO_OUTPUT_DIR` | Carpeta de informes diarios del daemon | `./docs/mico` |
| `mico.stateFile` | `MICO_STATE_FILE` | Estado de commits procesados | `./data/mico-state.json` |
| `documentsPath` | `DOCUMENTS_PATH` | Documentos por PR y digests (servidor) | `./data/docs` |
| `workEventsPath` | `WORK_EVENTS_PATH` | Memoria de eventos de trabajo | `./data/work-events` |
| `publish.toRepo` | `PUBLISH_TO_REPO` | Subir Markdown al repo (opt-in) | `false` |
| `publish.repo` | `PUBLISH_REPO` | Repo destino `owner/repo` (vacío ⇒ repo de origen) | *(vacío)* |
| `publish.branch` | `PUBLISH_BRANCH` | Rama destino (vacío ⇒ default) | *(vacío)* |
| `publish.pathPrefix` | `PUBLISH_PATH_PREFIX` | Prefijo de ruta en el repo | `docs/mico` |
| `confidence.*` | `CONFIDENCE_*` | Umbrales y pesos del gate de confianza | *(ver calibración)* |

---

## 🌐 Endpoints REST (Microservicio)

Cuando se ejecuta `mico serve`, Mico expone los siguientes endpoints:

- `GET  /health` — Verificación de estado del servicio.
- `POST /v1/documents/from-pull-request` — Genera documentación Markdown desde un PR de GitHub.
- `GET  /v1/documents` — Lista los documentos generados.
- `GET  /v1/documents/:id` — Obtiene un documento específico.
- `GET  /v1/work-events` — Obtiene eventos de trabajo (memoria) con filtros opcionales `repository`, `from`, `to`.
- `GET  /v1/work-events/:id` — Obtiene un evento de trabajo específico.
- `POST /v1/digests/weekly` — Genera o recupera resúmenes semanales desde la memoria.

### Ejemplo: Generar documentación desde un PR

```bash
curl -X POST http://localhost:3000/v1/documents/from-pull-request \
  -H "Content-Type: application/json" \
  -d '{ "repository": "owner/repo", "pullRequestNumber": 123 }'
```

### Ejemplo: Digest semanal desde la memoria local

```bash
curl -X POST http://localhost:3000/v1/digests/weekly \
  -H "Content-Type: application/json" \
  -d '{ "repository": "owner/repo" }'
```

> El digest lee la **memoria de eventos de trabajo** (`workEventsPath`). Si el daemon estuvo corriendo sobre tu repo, los commits locales ya están ahí y el digest funciona sin GitHub.

---

## 🚦 Gate de Confianza y Calibración

Cada evento (PR o commit) recibe un **score de confianza** (0..1) calculado con heurísticas deterministas: presencia/calidad de la descripción, calidad de los mensajes de commit, presencia de archivos y diffs. Por debajo del umbral `reviewThreshold`, el resultado se marca para **revisión humana** (`needsHumanReview: true`).

Los pesos y umbrales son configurables vía `confidence.*` (o `CONFIDENCE_*`). Para calibrarlos contra un golden-set:

```bash
npm run calibrate
```

El harness evalúa la heurística contra `src/calibration/golden-set.ts` y reporta aciertos/errores. Ampliá el golden-set con casos reales y ajustá los pesos hasta maximizar los aciertos.

---

## 📂 Estructura del Informe Diario (`docs/mico/YYYY-MM-DD.md`)

Cada día, el daemon crea o actualiza automáticamente el documento del día:

```markdown
# Informe de Desarrollo - 2026-08-31 🐒

> Documento generado por **Mico**, el agente observador de desarrollo.

## 📌 Visión General del Día
Este informe documenta las tareas y cambios realizados durante el día **2026-08-31**.

## 📜 Registro de Commits e Implementaciones

---

### 🔨 Commit `a1b2c3d` — feat: agregar autenticación de usuarios

- **Hora:** `14:30:15`
- **Autor:** Jose
- **Hash:** `a1b2c3d4e5f6...`

#### 1. Resumen Ejecutivo
Se implementó el servicio de autenticación y gestión de sesiones.

#### 2. Cambios Realizados
- Adición de middleware de verificación de tokens
- Creación de rutas de login y logout

#### 3. Impacto
Módulo de seguridad y endpoints de API protegidos.
```

---

## 💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar modo desarrollo con hot-reload (daemon)
npm run dev

# Levantar el servidor REST en desarrollo
npx tsx src/cli.ts serve

# Ejecutar la suite de tests (Vitest)
npm test

# Typecheck
npm run typecheck

# Compilar proyecto a dist/
npm run build

# Calibrar el gate de confianza
npm run calibrate
```

---

## 🐳 Despliegue con Docker

```bash
# Construir la imagen
docker build -t mico .

# Ejecutar el daemon (modo por defecto)
docker run --rm --env-file .env mico

# Ejecutar el servidor REST
docker run --rm -p 3000:3000 --env-file .env -e MICO_MODE=server mico
```

`MICO_MODE` acepta `daemon` (default) o `server`.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE).