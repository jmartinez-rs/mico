# Mico 🐒 — Agente Curioso de Monitoreo de Commits y Documentación Viva

**Mico** es un agente autónomo de desarrollo en Node.js y TypeScript empaquetado para ejecutarse fácilmente mediante `npx` o `npm`. Su nombre nace en alusión a los monos pequeños que son curiosos, ágiles y siempre están observando detenidamente lo que hacés en tu repositorio.

Mico se ejecuta en segundo plano (modo daemon) o como microservicio REST, escuchando y analizando los commits de tu repositorio Git. Cuando detecta commits nuevos, analiza las diferencias y metadatos mediante IA (usando cualquier proveedor LLM compatible con OpenAI) y genera o actualiza diariamente informes estructurados en formato Markdown dentro de `/docs/mico/YYYY-MM-DD.md`.

---

## ⚡ Características Principales

- 🐒 **Monitoreo Continuo (Daemon):** Escucha activa de commits en tiempo real sin interrumpir tu flujo de trabajo.
- 🤖 **Análisis con LLM:** Soporta cualquier proveedor compatible con la API de OpenAI (OpenAI, Ollama, OpenRouter, Groq, LM Studio, etc.).
- 📅 **Informes Diarios Automáticos:** Registra avances y resúmenes diarios organizados por fecha (`/docs/mico/YYYY-MM-DD.md`).
- 🌐 **Servidor REST Integrado:** Endpoints HTTP Fastify para consulta de documentos, eventos de trabajo y generación desde Pull Requests de GitHub.
- 🛠️ **Cero Configuración Compleja:** Inicialización instantánea con `npx mico init`.

---

## 📦 Instalación y Uso Rápido

No necesitas clonar este repositorio para usar Mico en tu proyecto. Podés ejecutarlo directamente en la raíz de cualquier repositorio Git:

### 1. Inicializar Mico en tu proyecto
Ejecutá el comando de inicialización en la raíz del repositorio:

```bash
npx mico init
```

Este comando creará automáticamente:
- El archivo de configuración **`mico.config.json`**.
- La carpeta **`/docs/mico`** donde se guardarán los informes diarios.

---

### 2. Configurar las credenciales

Abre el archivo `mico.config.json` generado e ingresá tu API Key del proveedor LLM:

```json
{
  "llmApiKey": "TU_API_KEY_AQUI",
  "llmBaseUrl": "https://api.openai.com/v1",
  "llmModel": "gpt-4o-mini",
  "watchIntervalMs": 10000,
  "outputDir": "./docs/mico"
}
```

*(También podés usar un archivo `.env` o variables de entorno tradicionales si preferís)*.

---

### 3. Iniciar la escucha del agente

Inicia Mico en segundo plano:

```bash
npx mico start
```

O si preferís instalarlo de manera global:

```bash
npm install -g mico
mico start
```

---

## ⚙️ Opciones de Configuración (`mico.config.json` o `.env`)

Mico resuelve las configuraciones siguiendo este orden de prioridad: **Variables de Entorno > `mico.config.json` > Valores por defecto**.

| Campo en `mico.config.json` | Variable de Entorno | Descripción | Default |
| --- | --- | --- | --- |
| `llmApiKey` | `LLM_API_KEY` | API Key de tu proveedor LLM | *(Obligatorio)* |
| `llmBaseUrl` | `LLM_BASE_URL` | Base URL compatible con OpenAI | `https://api.openai.com/v1` |
| `llmModel` | `LLM_MODEL` | Modelo LLM a utilizar | `gpt-4o-mini` |
| `watchIntervalMs` | `MICO_WATCH_INTERVAL_MS` | Intervalo de chequeo de commits (ms) | `10000` (10s) |
| `targetRepoPath` | `MICO_TARGET_REPO_PATH` | Ruta local del repositorio Git | `./` |
| `outputDir` | `MICO_OUTPUT_DIR` | Carpeta de salida para archivos Markdown | `./docs/mico` |
| `stateFile` | `MICO_STATE_FILE` | Archivo JSON de persistencia de estado | `./data/mico-state.json` |
| `port` | `PORT` | Puerto para el servidor REST HTTP | `3000` |

---

## 🌐 Endpoints REST (Microservicio)

Cuando se ejecuta el servidor HTTP, Mico expone los siguientes endpoints:

- `GET  /health` — Verificación de estado del servicio.
- `POST /v1/documents/from-pull-request` — Genera documentación Markdown desde un PR de GitHub.
- `GET  /v1/documents` — Lista los documentos generados.
- `GET  /v1/documents/:id` — Obtiene un documento específico.
- `GET  /v1/work-events` — Obtiene eventos de trabajo parseados.
- `POST /v1/digests/weekly` — Genera o recupera resúmenes semanales.

### Ejemplo: Generar documentación desde un PR

```bash
curl -X POST http://localhost:3000/v1/documents/from-pull-request \
  -H "Content-Type: application/json" \
  -d '{ "repository": "owner/repo", "pullRequestNumber": 123 }'
```

---

## 📂 Estructura del Informe Diario (`/docs/mico/YYYY-MM-DD.md`)

Cada día, Mico crea o actualiza automáticamente el documento del día:

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

Para contribuir o desarrollar sobre Mico:

```bash
# Instalar dependencias
npm install

# Iniciar modo desarrollo con hot-reload
npm run dev

# Ejecutar la suite de tests (Vitest)
npm test

# Compilar proyecto a dist/
npm run build
```

---

## 🐳 Despliegue con Docker

```bash
# Construir la imagen
docker build -t mico .

# Ejecutar el contenedor
docker run --rm -p 3000:3000 --env-file .env mico
```

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE).
