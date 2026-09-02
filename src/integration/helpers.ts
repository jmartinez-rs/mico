/**
 * Helpers compartidos para los tests de integración.
 *
 * Los tests de integración usan infraestructura REAL (repos git reales en
 * directorios temporales, stores reales, servidor Fastify real) pero un LLM
 * FAKE determinista por defecto, para que corran rápido y sin depender de una
 * API key en CI.
 *
 * Para ejecutar con el LLM real (OpenCode Go / mimo-v2.5 configurado en .env):
 *   MICO_INTEGRATION_REAL_LLM=1 npm test
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "../config.js";
import type { AppConfig } from "../config.js";
import { DEFAULT_CONFIDENCE_CONFIG } from "../domain/confidence.js";
import type { LLMProvider } from "../llm/provider.js";
import { OpenAICompatibleProvider } from "../llm/openai-provider.js";

const execFileAsync = promisify(execFile);

/** Ejecuta un comando git en un directorio. */
export async function runGit(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: dir });
  return stdout.trim();
}

export interface TempGitRepo {
  /** Directorio raíz del repo git real. */
  dir: string;
  /** Hash del HEAD tras crear los commits. */
  headHash: string;
}

/**
 * Crea un repo git REAL en un directorio temporal con N commits.
 * Cada commit toca un archivo distinto (a.txt, b.txt, ...).
 */
export async function createTempGitRepo(
  commitMessages: string[] = ["feat: primer commit"],
): Promise<TempGitRepo> {
  const dir = await mkdtemp(join(tmpdir(), "mico-int-repo-"));
  await runGit(dir, ["init", "-b", "main"]);
  await runGit(dir, ["config", "user.email", "test@example.com"]);
  await runGit(dir, ["config", "user.name", "Test Dev"]);

  let headHash = "";
  for (let i = 0; i < commitMessages.length; i++) {
    const message = commitMessages[i]!;
    const file = `${String.fromCharCode(97 + i)}.txt`;
    await writeFile(join(dir, file), `contenido ${i}\n`, "utf-8");
    await runGit(dir, ["add", file]);
    await runGit(dir, ["commit", "-m", message]);
    headHash = await runGit(dir, ["rev-parse", "HEAD"]);
  }

  return { dir, headHash };
}

/**
 * Crea un commit adicional en el repo con una fecha controlada (para probar
 * documentos por día). Devuelve el hash del nuevo commit.
 */
export async function addCommitWithDate(
  dir: string,
  message: string,
  dateIso: string,
): Promise<string> {
  const file = `extra-${Date.now()}.txt`;
  await writeFile(join(dir, file), "extra\n", "utf-8");
  await runGit(dir, ["add", file]);
  await runGit(dir, [
    "commit",
    "-m",
    message,
    "--date",
    dateIso,
  ]);
  return runGit(dir, ["rev-parse", "HEAD"]);
}

/** Config de integración apuntando a directorios temporales. */
export function makeIntegrationConfig(overrides: {
  repoDir: string;
  dataDir: string;
}): AppConfig {
  return {
    port: 0,
    githubToken: "",
    llm: { baseUrl: "https://x/v1", apiKey: "key", model: "fake" },
    documentsPath: join(overrides.dataDir, "docs"),
    workEventsPath: join(overrides.dataDir, "work-events"),
    mico: {
      watchIntervalMs: 10000,
      targetRepoPath: overrides.repoDir,
      outputDir: join(overrides.dataDir, "docs", "mico"),
      stateFile: join(overrides.dataDir, "state.json"),
    },
    publish: { toRepo: false, pathPrefix: "docs/mico" },
    confidence: DEFAULT_CONFIDENCE_CONFIG,
  };
}

/** LLM fake determinista: devuelve un análisis fijo y trazable. */
export const fakeLlm: LLMProvider = {
  generate: async ({ prompt }) =>
    `### Resumen Ejecutivo\nAnálisis determinista de integración.\n\n### Cambios Realizados\n- Verificado por el harness de integración.\n\n### Impacto\nFlujo completo validado.`,
};

/**
 * Devuelve el LLM a usar en los tests: fake por defecto, o el real
 * (OpenCode Go / mimo-v2.5 del .env) si MICO_INTEGRATION_REAL_LLM=1.
 */
export function makeLlm(): LLMProvider {
  if (process.env.MICO_INTEGRATION_REAL_LLM === "1") {
    const config = loadConfig(process.env, process.cwd());
    return new OpenAICompatibleProvider(config.llm);
  }
  return fakeLlm;
}

/** Limpia un directorio temporal (no falla si no existe). */
export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}