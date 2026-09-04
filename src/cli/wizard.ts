/**
 * Asistente interactivo de configuración de Mico (`mico init` / `mico config`).
 *
 * Usa `readline/promises` nativo de Node.js (sin dependencias pesadas). La
 * lógica de preguntas está separada de la I/O (`Questioner`) para poder testear
 * el wizard con mocks y reutilizarlo en modo no interactivo (`--yes`).
 */
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type ProviderId = "openai" | "groq" | "ollama" | "custom";

export interface ProviderPreset {
  baseUrl: string;
  model: string;
}

/** Presets por proveedor (defaults del plan). */
export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "qwen2.5-coder:7b" },
  custom: { baseUrl: "", model: "" },
};

export interface WizardAnswers {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  targetRepoPath: string;
  outputDir: string;
  language: "es" | "en";
  installHook: boolean;
  startDaemon: boolean;
}

/** Abstracción de I/O para el wizard (testeable con mocks). */
export interface Questioner {
  select<T extends string>(
    question: string,
    choices: { value: T; label: string }[],
    defaultValue?: T,
  ): Promise<T>;
  ask(question: string, defaultValue?: string, isSecret?: boolean): Promise<string>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
}

/** Implementación real con readline/promises sobre stdin/stdout. */
export function createReadlineQuestioner(): Questioner {
  const rl = createInterface({ input, output });

  return {
    async select(question, choices, defaultValue) {
      console.log(`\n${question}`);
      choices.forEach((choice, index) => {
        const marker = choice.value === defaultValue ? " (default)" : "";
        console.log(`  ${index + 1}. ${choice.label}${marker}`);
      });
      const answer = await rl.question(
        `Elegí una opción [1-${choices.length}]${defaultValue ? ` (default: ${defaultValue})` : ""}: `,
      );
      const index = parseInt(answer.trim(), 10) - 1;
      const choice = choices[index];
      if (choice) return choice.value;
      const fallback = choices.find((c) => c.value === defaultValue);
      return (fallback ?? choices[0]!).value;
    },

    async ask(question, defaultValue, isSecret = false) {
      const displayDefault = isSecret && defaultValue ? "***" : defaultValue;
      const suffix = defaultValue ? ` [${displayDefault}]` : "";
      const answer = await rl.question(`${question}${suffix}: `);
      return answer.trim() || defaultValue || "";
    },

    async confirm(question, defaultYes = false) {
      const hint = defaultYes ? "Y/n" : "y/N";
      const answer = await rl.question(`${question} (${hint}): `);
      const normalized = answer.trim().toLowerCase();
      if (normalized === "") return defaultYes;
      return normalized === "y" || normalized === "yes" || normalized === "s" || normalized === "si";
    },
  };
}

/**
 * Ejecuta el asistente interactivo y devuelve las respuestas. No escribe nada
 * en disco: eso lo hace `writeConfigFile`.
 */
export async function runWizard(
  questioner: Questioner,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WizardAnswers> {
  const provider = await questioner.select<ProviderId>(
    "Proveedor de IA",
    [
      { value: "openai", label: "OpenAI (gpt-4o-mini)" },
      { value: "groq", label: "Groq (llama-3.3-70b-versatile)" },
      { value: "ollama", label: "Ollama / Local (qwen2.5-coder:7b)" },
      { value: "custom", label: "Personalizado (URL base + modelo)" },
    ],
    "openai",
  );

  const preset = PROVIDER_PRESETS[provider];
  let baseUrl = preset.baseUrl;
  let model = preset.model;

  if (provider === "custom") {
    baseUrl = await questioner.ask("Base URL del endpoint (compatible OpenAI)", "");
    model = await questioner.ask("Modelo", "");
  }

  const envDefault = env.LLM_API_KEY || env.OPENAI_API_KEY || "";
  const apiKey = await questioner.ask("API Key", envDefault || undefined, true);

  const targetRepoPath = await questioner.ask(
    "Repositorio a monitorear (ruta local)",
    "./",
  );
  let outputDir = await questioner.ask(
    "Directorio de salida de informes",
    "./docs/mico",
  );
  if (path.basename(outputDir).toLowerCase() !== "mico") {
    outputDir = path.join(outputDir, "mico");
  }
  const language = await questioner.select<"es" | "en">(
    "Idioma de los informes (Language for reports)",
    [
      { value: "es", label: "Español" },
      { value: "en", label: "English" },
    ],
    "es",
  );

  const installHook = await questioner.confirm(
    "¿Instalar hook de git post-commit para documentar en cada commit?",
    false,
  );
  const startDaemon = await questioner.confirm(
    "¿Iniciar el daemon en segundo plano ahora?",
    false,
  );

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    targetRepoPath,
    outputDir,
    language,
    installHook,
    startDaemon,
  };
}

/** Template base de mico.config.json (mismos defaults que `mico init`). */
export function defaultConfigTemplate(): Record<string, any> {
  return {
    githubToken: "",
    llm: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4o-mini",
    },
    documentsPath: "./data/docs",
    workEventsPath: "./data/work-events",
    mico: {
      language: "es",
      watchIntervalMs: 10000,
      targetRepoPath: "./",
      outputDir: "./docs/mico",
      stateFile: "./data/mico-state.json",
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
}

/**
 * Escribe `mico.config.json` en `cwd` a partir de las respuestas del wizard.
 * No sobrescribe un archivo existente (devuelve null en ese caso).
 */
export function writeConfigFile(
  cwd: string,
  answers: WizardAnswers,
): string | null {
  const configPath = path.join(cwd, "mico.config.json");
  if (fs.existsSync(configPath)) {
    return null;
  }

  const config = defaultConfigTemplate();
  config.llm = {
    baseUrl: answers.baseUrl,
    apiKey: answers.apiKey,
    model: answers.model,
  };
  config.mico.targetRepoPath = answers.targetRepoPath;
  config.mico.outputDir = answers.outputDir;
  config.mico.language = answers.language;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  return configPath;
}