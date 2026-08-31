#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { loadConfig } from "./config.js";
import { MicoAgent } from "./agent/agent.js";
import { buildServer } from "./server.js";

const VERSION = "0.1.0";

const HELP_TEXT = `
🐒 MICO AGENT v${VERSION} — El agente curioso de monitoreo de commits

USO:
  $ npx mico [comando] [opciones]

COMANDOS:
  init       Inicializa mico en el proyecto actual creando 'mico.config.json' y la carpeta '/docs/mico'.
  start      Inicia la escucha activa y el análisis de commits (comando por defecto).
  serve      Levanta el servidor REST (endpoints /health, /v1/*).

OPCIONES:
  -v, --version   Muestra la versión de Mico.
  -h, --help      Muestra este mensaje de ayuda.

EJEMPLOS:
  $ npx mico init
  $ npx mico start
  $ npx mico serve
`;

export async function runInit(cwd: string = process.cwd()): Promise<void> {
  const configPath = path.join(cwd, "mico.config.json");
  const docsPath = path.join(cwd, "docs", "mico");

  console.log(`\n 🐒 Inicializando Mico en ${cwd}...\n`);

  // 1. Crear carpeta docs/mico
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
    console.log(`  ✓ Carpeta creada: ${docsPath}`);
  } else {
    console.log(`  ✓ Carpeta existente: ${docsPath}`);
  }

  // 2. Crear mico.config.json
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      port: 3000,
      githubToken: "",
      llm: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
      },
      documentsPath: "./data/docs",
      workEventsPath: "./data/work-events",
      mico: {
        watchIntervalMs: 10000,
        targetRepoPath: "./",
        outputDir: "./docs/mico",
        stateFile: "./data/mico-state.json",
      },
      publish: {
        toRepo: false,
        repo: "",
        branch: "",
        pathPrefix: "docs/mico",
      },
      confidence: {
        reviewThreshold: 0.5,
        highThreshold: 0.75,
        minBodyLength: 30,
        poorCommitRatio: 0.5,
        weights: {
          noBody: 0.35,
          shortBody: 0.15,
          noCommits: 0.1,
          poorCommits: 0.2,
          noFiles: 0.1,
          noDiff: 0.1,
        },
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
    console.log(`  ✓ Archivo de configuración creado: ${configPath}`);
  } else {
    console.log(`  ℹ El archivo 'mico.config.json' ya existe.`);
  }

  console.log(`
 🐒 =======================================================
    ¡INICIALIZACIÓN COMPLETADA!
 =======================================================
   1. Abre 'mico.config.json' y completa 'llm.apiKey' (y 'githubToken' si vas a usar el servidor REST).
   2. Ejecuta 'npx mico start' para que Mico comience a escuchar.
   3. O 'npx mico serve' para levantar el servidor REST.
 =======================================================
`);
}

async function runStart(): Promise<void> {
  try {
    const config = loadConfig(process.env, process.cwd());
    const agent = new MicoAgent(config);

    const shutdown = () => {
      console.log("\n[Mico 🐒] Recibida señal de apagado. Deteniendo...");
      agent.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await agent.start();
  } catch (error: any) {
    console.error(`\n[Mico 🐒] Error al iniciar: ${error.message}\n`);
    console.error(`💡 Tip: Si es la primera vez, ejecuta 'npx mico init' para crear la configuración básica.\n`);
    process.exit(1);
  }
}

async function runServe(): Promise<void> {
  try {
    const config = loadConfig(process.env, process.cwd());
    const app = await buildServer(config);

    const shutdown = async () => {
      console.log("\n[Mico 🐒] Recibida señal de apagado. Deteniendo servidor...");
      await app.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`\n[Mico 🐒] Servidor REST escuchando en http://localhost:${config.port}`);
    console.log(`  GET  /health`);
    console.log(`  POST /v1/documents/from-pull-request`);
    console.log(`  GET  /v1/documents`);
    console.log(`  GET  /v1/documents/:id`);
    console.log(`  GET  /v1/work-events`);
    console.log(`  GET  /v1/work-events/:id`);
    console.log(`  POST /v1/digests/weekly`);
  } catch (error: any) {
    console.error(`\n[Mico 🐒] Error al iniciar el servidor: ${error.message}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "-v" || command === "--version") {
    console.log(`Mico v${VERSION}`);
    return;
  }

  if (command === "-h" || command === "--help") {
    console.log(HELP_TEXT);
    return;
  }

  if (command === "init") {
    await runInit();
    return;
  }

  if (command === "serve" || command === "server") {
    await runServe();
    return;
  }

  if (!command || command === "start") {
    await runStart();
    return;
  }

  console.error(`❌ Comando no reconocido: '${command}'`);
  console.log(HELP_TEXT);
  process.exit(1);
}

// Solo ejecutar el CLI cuando se invoca directamente (node dist/cli.js), no al
// importar el módulo desde tests u otros entry points.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("Error inesperado en Mico CLI:", err);
    process.exit(1);
  });
}
