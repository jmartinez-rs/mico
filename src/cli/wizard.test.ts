import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROVIDER_PRESETS,
  defaultConfigTemplate,
  runWizard,
  writeConfigFile,
  type Questioner,
  type WizardAnswers,
} from "./wizard.js";

/** Questioner mock: devuelve respuestas preprogramadas. */
function mockQuestioner(answers: Partial<WizardAnswers>): Questioner {
  // Orden de preguntas del wizard:
  //   custom => 1.baseUrl 2.model | 3.apiKey 4.repo 5.outputDir
  //   preset => 1.apiKey 2.repo 3.outputDir
  const queue =
    answers.provider === "custom"
      ? [answers.baseUrl ?? "", answers.model ?? "", answers.apiKey ?? "", answers.targetRepoPath ?? "./", answers.outputDir ?? "./docs/mico"]
      : [answers.apiKey ?? "", answers.targetRepoPath ?? "./", answers.outputDir ?? "./docs/mico"];

  return {
    select: async (_q, choices, defaultValue) => {
      const match = choices.find((c) => c.value === answers.provider);
      return (match ?? choices.find((c) => c.value === defaultValue) ?? choices[0]!)
        .value as any;
    },
    ask: async (_q, defaultValue) => {
      const value = queue.shift() ?? "";
      return value || defaultValue || "";
    },
    confirm: async (_q, defaultYes) => {
      if (defaultYes === false) return answers.installHook ?? false;
      return answers.startDaemon ?? false;
    },
  };
}

describe("runWizard", () => {
  it("usa los presets del proveedor elegido", async () => {
    const answers = await runWizard(
      mockQuestioner({ provider: "groq", apiKey: "key-groq" }),
      {},
    );
    expect(answers.provider).toBe("groq");
    expect(answers.baseUrl).toBe(PROVIDER_PRESETS.groq.baseUrl);
    expect(answers.model).toBe(PROVIDER_PRESETS.groq.model);
    expect(answers.apiKey).toBe("key-groq");
    expect(answers.targetRepoPath).toBe("./");
    expect(answers.outputDir).toBe("./docs/mico");
  });

  it("para provider custom pide baseUrl y modelo", async () => {
    const answers = await runWizard(
      mockQuestioner({
        provider: "custom",
        baseUrl: "https://mi-proveedor.example/v1",
        model: "mi-modelo",
        apiKey: "key",
      }),
      {},
    );
    expect(answers.baseUrl).toBe("https://mi-proveedor.example/v1");
    expect(answers.model).toBe("mi-modelo");
  });

  it("ofrece LLM_API_KEY del entorno como default", async () => {
    const answers = await runWizard(
      mockQuestioner({ provider: "openai", apiKey: "key-env" }),
      { LLM_API_KEY: "key-env" },
    );
    expect(answers.apiKey).toBe("key-env");
  });
});

describe("writeConfigFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mico-wizard-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("escribe mico.config.json con las respuestas del wizard", async () => {
    const answers: WizardAnswers = {
      provider: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5-coder:7b",
      apiKey: "ollama",
      targetRepoPath: "/tmp/mi-repo",
      outputDir: "./informes",
      installHook: false,
      startDaemon: false,
    };

    const configPath = writeConfigFile(tempDir, answers);
    expect(configPath).toBe(join(tempDir, "mico.config.json"));

    const raw = JSON.parse(await fs.readFile(configPath!, "utf-8"));
    expect(raw.llm).toEqual({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "ollama",
      model: "qwen2.5-coder:7b",
    });
    expect(raw.mico.targetRepoPath).toBe("/tmp/mi-repo");
    expect(raw.mico.outputDir).toBe("./informes");
    // El resto conserva los defaults
    expect(raw.mico.watchIntervalMs).toBe(10000);
  });

  it("no sobrescribe un mico.config.json existente", async () => {
    const existing = join(tempDir, "mico.config.json");
    await fs.writeFile(existing, JSON.stringify({ custom: true }), "utf-8");

    const answers: WizardAnswers = {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "key",
      targetRepoPath: "./",
      outputDir: "./docs/mico",
      installHook: false,
      startDaemon: false,
    };

    expect(writeConfigFile(tempDir, answers)).toBeNull();
    const raw = JSON.parse(await fs.readFile(existing, "utf-8"));
    expect(raw.custom).toBe(true);
  });

  it("defaultConfigTemplate genera un config válido y completo", () => {
    const template = defaultConfigTemplate();
    expect(template.llm.apiKey).toBe("");
    expect(template.llm.baseUrl).toBe("https://api.openai.com/v1");
    expect(template.mico.outputDir).toBe("./docs/mico");
    expect(template.confidence.reviewThreshold).toBe(0.5);
    expect(template.$schema).toBeUndefined();
  });
});