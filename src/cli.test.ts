import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { runInit } from "./cli.js";
import { loadConfig } from "./config.js";

describe("CLI init", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-cli-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("crea docs/mico y un mico.config.json con todos los campos", async () => {
    await runInit(tempDir);

    const docsPath = path.join(tempDir, "docs", "mico");
    await expect(fs.access(docsPath)).resolves.toBeUndefined();

    const raw = JSON.parse(
      await fs.readFile(path.join(tempDir, "mico.config.json"), "utf-8"),
    );
    expect(raw.llm.apiKey).toBe("");
    expect(raw.llm.baseUrl).toBe("https://api.openai.com/v1");
    expect(raw.mico.watchIntervalMs).toBe(10000);
    expect(raw.mico.outputDir).toBe("./docs/mico");
    expect(raw.documentsPath).toBe("./data/docs");
    expect(raw.workEventsPath).toBe("./data/work-events");
    expect(raw.confidence.reviewThreshold).toBe(0.5);
    // El template ya no incluye el $schema inválido de tsconfig
    expect(raw.$schema).toBeUndefined();
  });

  it("no sobrescribe un mico.config.json existente", async () => {
    const configPath = path.join(tempDir, "mico.config.json");
    await fs.writeFile(configPath, JSON.stringify({ custom: true }), "utf-8");

    await runInit(tempDir);

    const raw = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(raw.custom).toBe(true);
  });

  it("el template generado carga con loadConfig (falla claro sin apiKey, carga con apiKey)", async () => {
    await runInit(tempDir);

    // Sin apiKey: error de validación claro, no un fallo de runtime confuso
    expect(() => loadConfig({}, tempDir)).toThrow(/LLM_API_KEY es obligatorio/);

    // Con apiKey: carga con los defaults del template
    const config = loadConfig({ LLM_API_KEY: "test-key" }, tempDir);
    expect(config.llm.model).toBe("gpt-4o-mini");
    expect(config.mico.outputDir).toBe("./docs/mico");
    expect(config.confidence.reviewThreshold).toBe(0.5);
  });
});