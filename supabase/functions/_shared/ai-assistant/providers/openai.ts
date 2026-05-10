import type { AIProvider, AIMessage, ChatOptions } from "./base";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_TOKENS = 4096;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string | null } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI response contained no content");

    return content;
  }
}
