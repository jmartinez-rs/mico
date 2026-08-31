# Mico 🐒 — Agente de Monitoreo de Commits

**Mico** es un agente autónomo de desarrollo en Node.js y TypeScript empaquetado para ejecutarse fácilmente mediante `npx` o `npm`. Su nombre nace en alusión a los monos pequeños que son curiosos y siempre están viendo lo que haces.

Mico se ejecuta en segundo plano escuchando y analizando todo el tiempo los commits de tu repositorio Git. Cuando detecta un commit nuevo, analiza los cambios mediante IA (usando cualquier proveedor compatible con OpenAI) y genera o actualiza un informe diario en formato Markdown dentro de la carpeta `/docs/mico` (`YYYY-MM-DD.md`).

---

## 📦 Instalación y Uso Rápido en Cualquier Repositorio

No necesitas clonar este repositorio para usar Mico en tus proyectos. Podés ejecutarlo directamente con `npx` en la raíz de cualquier repositorio Git:

### 1. Inicializar Mico en tu proyecto
Ejecutá el comando de inicialización en la raíz de tu proyecto:

```bash
npx mico init
```

Este comando creará automáticamente:
- El archivo de configuración **`mico.config.json`**.
- La carpeta **`/docs/mico`** donde se guardarán los informes diarios.

---

### 2. Configurar tus variables

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

*(También podés usar un archivo `.env` o variables de entorno tradicionales si lo preferís)*.

---

### 3. Iniciar la escucha del agente

Inicia Mico en segundo plano:

```bash
npx mico start
```

O si preferís instalarlo globalmente:

```bash
npm install -g mico
mico start
```

---

## ⚙️ Opciones de Configuración (`mico.config.json` o `.env`)

Mico lee la configuración con la siguiente prioridad: **Variables de Entorno > `mico.config.json` > Valores por defecto**.

| Campo en `mico.config.json` | Variable de Entorno | Descripción | Default |
| --- | --- | --- | --- |
| `llmApiKey` | `LLM_API_KEY` | API Key de tu proveedor LLM | *(Obligatorio)* |
| `llmBaseUrl` | `LLM_BASE_URL` | Base URL compatible con OpenAI | `https://api.openai.com/v1` |
| `llmModel` | `LLM_MODEL` | Modelo LLM a utilizar | `gpt-4o-mini` |
| `watchIntervalMs` | `MICO_WATCH_INTERVAL_MS` | Intervalo de chequeo de commits en ms | `10000` (10s) |
| `targetRepoPath` | `MICO_TARGET_REPO_PATH` | Ruta del repositorio Git | `./` |
| `outputDir` | `MICO_OUTPUT_DIR` | Carpeta de salida para Markdown | `./docs/mico` |
| `stateFile` | `MICO_STATE_FILE` | Archivo JSON de estado de commits | `./data/mico-state.json` |

---

## 📂 Estructura del Informe Diario (`/docs/mico/YYYY-MM-DD.md`)

Cada día, Mico crea o actualiza el archivo correspondiente en `/docs/mico/`:

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
