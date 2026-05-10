import type { AIProvider, AIMessage, ChatOptions } from "./base.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    // Anthropic API separates system from user/assistant messages
    const systemMessages = messages.filter(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");

    const systemContent = systemMessages.map(m => m.content).join("\n\n");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: conversationMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemContent) {
      body.system = systemContent;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const textBlock = data.content.find(c => c.type === "text");
    if (!textBlock) throw new Error("Anthropic response contained no text block");

    return textBlock.text;
  }
}
