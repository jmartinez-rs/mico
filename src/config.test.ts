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
    expect(config.documentsPath).toBe("./data/docs");
  });

  it("falla si falta GITHUB_TOKEN", () => {
    expect(() => loadConfig({ LLM_API_KEY: "x" } as NodeJS.ProcessEnv)).toThrow(
      /githubToken/,
    );
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
});
