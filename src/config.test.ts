import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const baseEnv = {
  GITHUB_TOKEN: "gh_token",
  LLM_API_KEY: "llm_key",
};

describe("loadConfig", () => {
  it("aplica valores por defecto", () => {
    const config = loadConfig(baseEnv as NodeJS.ProcessEnv);
    expect(config.port).toBe(3000);
    expect(config.llm.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.llm.model).toBe("gpt-4o-mini");
    expect(config.mico.watchIntervalMs).toBe(10000);
    expect(config.mico.outputDir).toBe("./docs/mico");
    expect(config.mico.targetRepoPath).toBe("./");
  });

  it("permite omitir GITHUB_TOKEN y asigna string vacío", () => {
    const config = loadConfig({ LLM_API_KEY: "x" } as NodeJS.ProcessEnv);
    expect(config.githubToken).toBe("");
  });

  it("lee opciones desde mico.config.json", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-config-test-"));
    const configPath = path.join(tempDir, "mico.config.json");

    await fs.writeFile(
      configPath,
      JSON.stringify({
        llmApiKey: "key_desde_json",
        llmModel: "model_desde_json",
        outputDir: "./docs/json-custom",
      }),
      "utf-8"
    );

    const config = loadConfig({} as NodeJS.ProcessEnv, tempDir);
    expect(config.llm.apiKey).toBe("key_desde_json");
    expect(config.llm.model).toBe("model_desde_json");
    expect(config.mico.outputDir).toBe("./docs/json-custom");

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("respeta overrides de entorno", () => {
    const config = loadConfig({
      ...baseEnv,
      PORT: "8080",
      LLM_BASE_URL: "https://opencode.example/v1",
      LLM_MODEL: "custom-model",
    } as NodeJS.ProcessEnv);
    expect(config.port).toBe(8080);
    expect(config.llm.baseUrl).toBe("https://opencode.example/v1");
    expect(config.llm.model).toBe("custom-model");
  });

  it("aplica defaults de confianza iguales al comportamiento actual", () => {
    const config = loadConfig(baseEnv as NodeJS.ProcessEnv);
    expect(config.confidence.reviewThreshold).toBe(0.5);
    expect(config.confidence.highThreshold).toBe(0.75);
    expect(config.confidence.weights.noBody).toBe(0.35);
    expect(config.workEventsPath).toBe("./data/work-events");
  });

  it("permite calibrar umbral y pesos de confianza por entorno", () => {
    const config = loadConfig({
      ...baseEnv,
      CONFIDENCE_REVIEW_THRESHOLD: "0.6",
      CONFIDENCE_WEIGHT_NO_BODY: "0.5",
    } as NodeJS.ProcessEnv);
    expect(config.confidence.reviewThreshold).toBe(0.6);
    expect(config.confidence.weights.noBody).toBe(0.5);
  });

  it("deja la subida al repo APAGADA por defecto (no-breaking)", () => {
    const config = loadConfig(baseEnv as NodeJS.ProcessEnv);
    expect(config.publish.toRepo).toBe(false);
    expect(config.publish.repo).toBeUndefined();
    expect(config.publish.branch).toBeUndefined();
    expect(config.publish.pathPrefix).toBe("docs/mico");
  });

  it("parsea PUBLISH_TO_REPO como booleano y respeta overrides de publish", () => {
    const config = loadConfig({
      ...baseEnv,
      PUBLISH_TO_REPO: "true",
      PUBLISH_REPO: "acme/docs-mirror",
      PUBLISH_BRANCH: "docs",
      PUBLISH_PATH_PREFIX: "evidencia/mico",
    } as NodeJS.ProcessEnv);
    expect(config.publish.toRepo).toBe(true);
    expect(config.publish.repo).toBe("acme/docs-mirror");
    expect(config.publish.branch).toBe("docs");
    expect(config.publish.pathPrefix).toBe("evidencia/mico");
  });

  it("no interpreta PUBLISH_TO_REPO='false' como verdadero", () => {
    const config = loadConfig({
      ...baseEnv,
      PUBLISH_TO_REPO: "false",
    } as NodeJS.ProcessEnv);
    expect(config.publish.toRepo).toBe(false);
  });
});
