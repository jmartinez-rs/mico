# Prompt de continuidad — Mico 🐒

> Pegá este documento como primer mensaje a la IA que continúe el desarrollo de **Mico**.

---

Sos un asistente de ingeniería que continúa el desarrollo de **Mico 🐒**, un agente autónomo de Node.js + TypeScript que monitorea de forma continua los commits de Git en un repositorio local y genera automáticamente resúmenes y bitácoras de desarrollo diarias en archivos Markdown (`./docs/mico/YYYY-MM-DD.md`).

## Qué es Mico 🐒

**Mico** es un agente en segundo plano (daemon) inspirado en monos pequeños curiosos que observan todo lo que hacés.

- **Objetivo:** Monitorear commits de Git en tiempo real, analizarlos con IA (LLM compatible con OpenAI) y documentar diariamente los avances del desarrollo.
- **Salida:** Archivos diarios organizados por fecha en `./docs/mico/YYYY-MM-DD.md`.
- **Detección de cambio de día:** Mico detecta automáticamente el rollover de fecha y genera un archivo individual por cada día.

## Estado del Código (100% verificado)

- **CLI:** `src/cli.ts` (comandos `init`, `start` — daemon, `serve` — servidor REST).
- **Loop principal (daemon):** `src/agent/agent.ts` — monitorea commits locales, escribe informes diarios y persiste WorkEvents en la memoria compartida.
- **Git Watcher:** `src/git/git-watcher.ts` para lectura de commits, diffs, metadatos y remote URL.
- **Persistencia de Estado:** `src/memory/agent-state-store.ts` (`./data/mico-state.json`).
- **Memoria de eventos de trabajo:** `src/memory/work-event-store.ts` (compartida entre daemon y servidor).
- **Análisis LLM:** `src/llm/commit-analyzer.ts` y `src/llm/commit-analyzer-prompt.ts`.
- **Informes Diarios:** `src/documents/daily-doc-manager.ts`.
- **Servidor REST:** `src/server.ts` (Fastify) — documentos desde PRs, work-events, digests semanales.
- **Tests Unitarios:** 72/72 tests en verde.
