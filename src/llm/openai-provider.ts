import OpenAI from "openai";
import { LLMError, type GenerationInput, type LLMProvider } from "./provider.js";

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Provider compatible con la API de OpenAI. Al ser configurable la baseUrl,
 * funciona con OpenAI, Opencode o cualquier endpoint que respete el mismo
 * contrato de chat completions.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAICompatibleOptions) {
    this.client = new OpenAI({
      baseURL: options.baseUrl,
      apiKey: options.apiKey,
    });
    this.model = options.model;
  }

  async generate(input: GenerationInput): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content || content.trim().length === 0) {
        throw new LLMError("El proveedor LLM devolvió una respuesta vacía.");
      }
      return content;
    } catch (error: unknown) {
      if (error instanceof LLMError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMError(`Error llamando al proveedor LLM: ${message}`);
    }
  }
}

export { OpenAICompatibleProvider as OpenAIProvider };
