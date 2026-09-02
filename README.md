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

**`mico document` / `mico digest` — Comandos CLI**

- `mico document <owner/repo> <pr>` genera documentación desde un Pull Request de GitHub;
- `mico digest --repo owner/repo` genera el digest semanal desde la memoria local de eventos.

---

# ⚡ Probalo en menos de 2 minutos

Mico está pensado para que puedas configurarlo y ponerlo a funcionar en cualquier repositorio en cuestión de segundos:

### 1. Inicializá Mico con el asistente interactivo

Desde la raíz de tu proyecto:

```bash
npx mico init
```

El asistente te guiará en consola para:
- Seleccionar tu proveedor de IA (**OpenAI**, **Groq**, **Ollama/Local** o personalizado).
- Ingresar tu API Key (o autodetectar tus variables de entorno si ya existen).
- Configurar el repositorio y la carpeta de informes (por defecto `docs/mico`).
- Opcionalmente activar el **Git Hook automático** o iniciar el **daemon en segundo plano**.

> 💡 Si preferís inicializarlo sin preguntas interactivas usando los valores por defecto, ejecutá:  
> `npx mico init --yes`

### 2. Elegí cómo querés que Mico escuche los cambios

Tenés 3 modalidades disponibles según tu preferencia:

- **Modo Git Hook (Recomendado — 0 MB de RAM en reposo):**  
  Documenta automáticamente cada vez que hacés un commit:
  ```bash
  npx mico hook install
  ```
- **Modo Daemon en segundo plano (proceso desasociado):**  
  Monitorea continuamente sin bloquear tu terminal:
  ```bash
  npx mico daemon start
  ```
- **Modo en primer plano (ideal para desarrollo y logs en vivo):**  
  ```bash
  npx mico start
  ```

---

# 🤖 Automatización mediante Git Hook y Daemon en segundo plano

Mico puede documentar tus commits **sin que tengas que dejar un proceso corriendo**. Dos opciones, o ambas:

## Opción A — Git Hook `post-commit` (cero consumo en reposo)

Instala un hook que procesa cada commit automáticamente al hacer `git commit`:

```bash
npx mico hook install
```

A partir de ahí, cada `git commit` dispara `mico run-once` en segundo plano (sin bloquear git) y la documentación se genera al instante. Para desinstalarlo:

```bash
npx mico hook uninstall
```

> El hook solo se ejecuta si Mico está disponible como `npx mico` (instalado globalmente o vía `npx`).

## Opción B — Daemon en segundo plano

Ejecuta Mico como proceso desasociado (guarda PID y logs en `data/`):

```bash
npx mico daemon start     # inicia en segundo plano
npx mico daemon status    # estado + últimas líneas del log
npx mico daemon stop      # detiene el daemon
```

## Pasada única

Procesa los commits pendientes una sola vez y termina (útil para cron o el hook):

```bash
npx mico run-once
```

## Asistente interactivo de configuración

`npx mico init` en una terminal interactiva abre un **wizard** que pregunta proveedor de IA (OpenAI, Groq, Ollama/Local, Personalizado), API key, repo a monitorear, carpeta de informes y si querés instalar el hook y/o iniciar el daemon:

```bash
npx mico init            # interactivo (TTY)
npx mico init --yes      # no interactivo, valores por defecto
npx mico config          # alias del asistente
```

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

# 🛠️ Comandos CLI

Podés utilizar Mico sin clonar este repositorio usando `npx`:

```bash
npx mico <comando>
```

O instalarlo globalmente en tu máquina:

```bash
npm install -g mico
mico <comando>
```

### Tabla de referencia de comandos

| Comando | Descripción |
|---|---|
| `npx mico init` | Inicia el asistente interactivo de configuración (o con `--yes` aplica defaults). |
| `npx mico config` | Alias del asistente interactivo de configuración. |
| `npx mico hook install` | Instala el Git Hook `post-commit` (documentación automática sin procesos en memoria). |
| `npx mico hook uninstall` | Desinstala el Git Hook de Mico. |
| `npx mico daemon start` | Inicia el daemon continuo en segundo plano (guarda PID y logs en `data/`). |
| `npx mico daemon status` | Muestra el estado del daemon en background y las últimas líneas de log. |
| `npx mico daemon stop` | Detiene el daemon en segundo plano. |
| `npx mico run-once` | Ejecuta una única pasada para procesar commits pendientes y finaliza de inmediato. |
| `npx mico start` | Inicia el daemon en primer plano (ideal para desarrollo y debugging). |
| `npx mico document owner/repo 123` | Genera documentación desde un PR de GitHub. |
| `npx mico digest --repo owner/repo` | Genera el digest semanal desde la memoria local. |
| `npx mico --version` | Muestra la versión actual de Mico. |
| `npx mico --help` | Muestra la ayuda de comandos. |

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
| `mico.watchIntervalMs` | `MICO_WATCH_INTERVAL_MS` | `10000` |
| `mico.targetRepoPath` | `MICO_TARGET_REPO_PATH` | `./` |
| `mico.outputDir` | `MICO_OUTPUT_DIR` | `./docs/mico` |
| `mico.stateFile` | `MICO_STATE_FILE` | `./data/mico-state.json` |
| `documentsPath` | `DOCUMENTS_PATH` | `./data/docs` |
| `workEventsPath` | `WORK_EVENTS_PATH` | `./data/work-events` |
| `confidence.*` | `CONFIDENCE_*` | ver calibración |

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

Documentar un PR o generar un digest:

```bash
npx tsx src/cli.ts document owner/repo 123
npx tsx src/cli.ts digest --repo owner/repo
```

Tests:

```bash
npm test
```

Tests de integración (infraestructura real: git, stores y server; LLM fake):

```bash
npm run test:integration
```

Tests de integración con el LLM real (OpenCode Go / mimo-v2.5 del `.env`):

```bash
npm run test:integration:real
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
