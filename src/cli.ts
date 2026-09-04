#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { loadConfig } from "./config.js";
import { MicoAgent } from "./agent/agent.js";
import { GitHubClient } from "./github/github-client.js";
import { OpenAICompatibleProvider } from "./llm/openai-provider.js";
import { WorkEventStore } from "./memory/work-event-store.js";
import {
  createReadlineQuestioner,
  defaultConfigTemplate,
  runWizard,
  writeConfigFile,
} from "./cli/wizard.js";
import { installGitHook, uninstallGitHook } from "./cli/git-hooks.js";
import {
  startDaemon,
  statusDaemon,
  stopDaemon,
} from "./cli/daemon-manager.js";

const VERSION = "0.1.3";

const HELP_TEXT = `
🐒 MICO AGENT v${VERSION} — El agente curioso de monitoreo de commits

USO:
  $ npx mico-agent [comando] [opciones]
  (o simplemente 'mico [comando]' si está instalado globalmente)

COMANDOS:
  init       Inicializa mico en el proyecto actual (interactivo en TTY, o con --yes usa defaults).
  config     Alias de 'init': asistente interactivo de configuración.
  start      Inicia la escucha activa y el análisis de commits (comando por defecto).
  run-once   Ejecuta una única pasada de verificación y procesa commits pendientes.
  document   Genera documentación desde un PR de GitHub: mico document <owner/repo> <pr-number>.
  digest     Genera el digest semanal desde la memoria local: mico digest [--repo owner/repo] [--from YYYY-MM-DD] [--to YYYY-MM-DD].
  daemon     Gestiona el daemon en segundo plano: start | stop | status.
  hook       Instala/desinstala el hook de git post-commit: install | uninstall.

OPCIONES:
  -v, --version   Muestra la versión de Mico.
  -h, --help      Muestra este mensaje de ayuda.
  --yes, --defaults  Inicializa con valores por defecto sin preguntar.

EJEMPLOS:
  $ npx mico init
  $ npx mico init --yes
  $ npx mico start
  $ npx mico run-once
  $ npx mico document owner/repo 123
  $ npx mico digest --repo owner/repo
  $ npx mico daemon start
  $ npx mico daemon status
  $ npx mico daemon stop
  $ npx mico hook install
  $ npx mico hook uninstall
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

  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(path.join(cwd, ".git"))) {
    const relativeDocs = path.relative(cwd, docsPath);
    if (!relativeDocs.startsWith("..") && !path.isAbsolute(relativeDocs)) {
      const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
      const ignoreEntry = `\n# Mico reports\n/${relativeDocs}/\n`;
      if (!gitignoreContent.includes(`/${relativeDocs}/`) && !gitignoreContent.includes(`${relativeDocs}/`)) {
        fs.appendFileSync(gitignorePath, ignoreEntry, "utf-8");
        console.log(`  ✓ Carpeta de informes agregada a .gitignore`);
      }
    }
  }

  // 2. Crear mico.config.json
  if (!fs.existsSync(configPath)) {
    const defaultConfig = defaultConfigTemplate();

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
    console.log(`  ✓ Archivo de configuración creado: ${configPath}`);
  } else {
    console.log(`  ℹ El archivo 'mico.config.json' ya existe.`);
  }

  console.log(`
 🐒 =======================================================
    ¡INICIALIZACIÓN COMPLETADA!
 =======================================================
   1. Abre 'mico.config.json' y completa 'llm.apiKey' (y 'githubToken' si vas a documentar PRs).
   2. Ejecuta 'npx mico start' para que Mico comience a escuchar.
   3. O 'npx mico document owner/repo 123' para documentar un PR.
 =======================================================
`);
}

/**
 * Asistente interactivo de configuración (`mico init` en TTY / `mico config`).
 * Pregunta proveedor, API key, rutas y automatización; guarda la config y
 * opcionalmente instala el hook y/o inicia el daemon según las respuestas.
 */
export async function runConfig(cwd: string = process.cwd()): Promise<void> {
  console.log("\n 🐒 Asistente de configuración de Mico\n");

  const questioner = createReadlineQuestioner();
  const answers = await runWizard(questioner);

  const configPath = writeConfigFile(cwd, answers);
  if (!configPath) {
    console.log("  ℹ 'mico.config.json' ya existe. No se sobrescribió.");
  } else {
    console.log(`  ✓ Configuración guardada en ${configPath}`);
  }

  const docsPath = path.resolve(cwd, answers.outputDir);
  fs.mkdirSync(docsPath, { recursive: true });
  console.log(`  ✓ Carpeta de informes: ${docsPath}`);

  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(path.join(cwd, ".git"))) {
    const relativeDocs = path.relative(cwd, docsPath);
    if (!relativeDocs.startsWith("..") && !path.isAbsolute(relativeDocs)) {
      const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
      const ignoreEntry = `\n# Mico reports\n/${relativeDocs}/\n`;
      if (!gitignoreContent.includes(`/${relativeDocs}/`) && !gitignoreContent.includes(`${relativeDocs}/`)) {
        fs.appendFileSync(gitignorePath, ignoreEntry, "utf-8");
        console.log(`  ✓ Carpeta de informes agregada a .gitignore`);
      }
    }
  }

  if (answers.installHook) {
    try {
      const hook = await installGitHook(cwd);
      console.log(`  ✓ Hook post-commit instalado: ${hook}`);
    } catch (error: any) {
      console.error(`  ⚠ No se pudo instalar el hook: ${error.message}`);
    }
  }

  if (answers.startDaemon) {
    try {
      const { pid } = await startDaemon({ cwd });
      console.log(`  ✓ Daemon iniciado en segundo plano (PID ${pid}).`);
    } catch (error: any) {
      console.error(`  ⚠ No se pudo iniciar el daemon: ${error.message}`);
    }
  }

  console.log(`
 🐒 =======================================================
    ¡CONFIGURACIÓN COMPLETADA!
 =======================================================
   • 'npx mico start'      → escucha continua en primer plano.
   • 'npx mico run-once'   → procesa commits pendientes una vez.
   • 'npx mico daemon'     → start | stop | status (segundo plano).
   • 'npx mico hook'       → install | uninstall (post-commit).
 =======================================================
`);
  process.exit(0);
}

/** Ejecuta una única pasada de verificación (para run-once y el git hook). */
async function runRunOnce(): Promise<void> {
  const config = loadConfig(process.env, process.cwd());
  const agent = new MicoAgent(config);
  await agent.runOnce();
  console.log("[Mico 🐒] Pasada única completada.");
}

async function runDaemonStart(): Promise<void> {
  const cwd = process.cwd();
  try {
    const { pid, paths } = await startDaemon({ cwd });
    console.log(`\n ✓ Daemon de Mico iniciado en segundo plano (PID ${pid}).`);
    console.log(`   Logs: ${paths.logFile}\n`);
  } catch (error: any) {
    console.error(`\n ✗ ${error.message}\n`);
    process.exit(1);
  }
}

async function runDaemonStop(): Promise<void> {
  const { stopped, pid } = await stopDaemon({ cwd: process.cwd() });
  if (stopped) {
    console.log(`\n ✓ Daemon de Mico detenido (PID ${pid}).\n`);
  } else {
    console.log("\n ℹ No había un daemon de Mico corriendo.\n");
  }
}

async function runDaemonStatus(): Promise<void> {
  const status = await statusDaemon({ cwd: process.cwd() });
  if (status.running) {
    console.log(`\n ✓ Mico está corriendo en segundo plano (PID ${status.pid}).\n`);
    if (status.logTail) {
      console.log("--- Últimas líneas del log ---\n");
      console.log(status.logTail);
      console.log("");
    }
  } else {
    console.log("\n ✗ Mico no está corriendo en segundo plano.\n");
  }
}

async function runHookInstall(): Promise<void> {
  const cwd = process.cwd();
  try {
    const hook = await installGitHook(cwd);
    console.log(`\n ✓ Hook post-commit instalado en ${hook}\n`);
  } catch (error: any) {
    console.error(`\n ✗ ${error.message}\n`);
    process.exit(1);
  }
}

async function runHookUninstall(): Promise<void> {
  const removed = await uninstallGitHook(process.cwd());
  if (removed) {
    console.log("\n ✓ Hook post-commit de Mico desinstalado.\n");
  } else {
    console.log("\n ℹ No había un hook de Mico instalado.\n");
  }
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

import { runDocument } from "./cli/commands/document.js";
import { runDigest } from "./cli/commands/digest.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags = args.slice(1);

  if (command === "-v" || command === "--version") {
    console.log(`Mico v${VERSION}`);
    return;
  }

  if (command === "-h" || command === "--help") {
    console.log(HELP_TEXT);
    return;
  }

  if (command === "init" || command === "config") {
    const nonInteractive =
      flags.includes("--yes") ||
      flags.includes("--defaults") ||
      !process.stdin.isTTY;
    if (nonInteractive) {
      await runInit();
    } else {
      await runConfig();
    }
    return;
  }

  if (command === "run-once") {
    await runRunOnce();
    return;
  }

  if (command === "document") {
    await runDocument();
    return;
  }

  if (command === "digest") {
    await runDigest();
    return;
  }

  if (command === "daemon") {
    const sub = args[1];
    if (sub === "start") {
      await runDaemonStart();
      return;
    }
    if (sub === "stop") {
      await runDaemonStop();
      return;
    }
    if (sub === "status") {
      await runDaemonStatus();
      return;
    }
    console.error(`❌ Subcomando daemon no reconocido: '${sub}'`);
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (command === "hook") {
    const sub = args[1];
    if (sub === "install") {
      await runHookInstall();
      return;
    }
    if (sub === "uninstall") {
      await runHookUninstall();
      return;
    }
    console.error(`❌ Subcomando hook no reconocido: '${sub}'`);
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (command === "serve" || command === "server") {
    console.error(`❌ El comando 'serve' fue eliminado. Usá 'mico document' o 'mico digest' en su lugar.`);
    console.log(HELP_TEXT);
    process.exit(1);
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
// importar el módulo desde tests u otros entry points. Se resuelve la ruta real
// de argv[1] para que funcione también cuando el binario se invoca a través de
// un symlink (p. ej. instalación global con `npm link` / `npm install -g`).
const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("Error inesperado en Mico CLI:", err);
    process.exit(1);
  });
}
