export interface GenerationInput {
  system: string;
  prompt: string;
}

export interface LLMProvider {
  generate(input: GenerationInput): Promise<string>;
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}
