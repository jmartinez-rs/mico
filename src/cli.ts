#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { loadConfig } from "./config.js";
import { MicoAgent } from "./agent/agent.js";

const VERSION = "0.1.0";

const HELP_TEXT = `
🐒 MICO AGENT v${VERSION} — El agente curioso de monitoreo de commits

USO:
  $ npx mico [comando] [opciones]

COMANDOS:
  init       Inicializa mico en el proyecto actual creando 'mico.config.json' y la carpeta '/docs/mico'.
  start      Inicia la escucha activa y el análisis de commits (comando por defecto).

OPCIONES:
  -v, --version   Muestra la versión de Mico.
  -h, --help      Muestra este mensaje de ayuda.

EJEMPLOS:
  $ npx mico init
  $ npx mico start
`;

async function runInit(): Promise<void> {
  const cwd = process.cwd();
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
      $schema: "https://json.schemastore.org/tsconfig",
      llmApiKey: "TU_API_KEY_AQUI",
      llmBaseUrl: "https://api.openai.com/v1",
      llmModel: "gpt-4o-mini",
      watchIntervalMs: 10000,
      targetRepoPath: "./",
      outputDir: "./docs/mico",
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
  1. Abre 'mico.config.json' y coloca tu 'llmApiKey'.
  2. Ejecuta 'npx mico start' para que Mico comience a escuchar.
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

  if (!command || command === "start") {
    await runStart();
    return;
  }

  console.error(`❌ Comando no reconocido: '${command}'`);
  console.log(HELP_TEXT);
  process.exit(1);
}

main().catch((err) => {
  console.error("Error inesperado en Mico CLI:", err);
  process.exit(1);
});
