export type { AIProvider, AIMessage, ChatOptions } from "./base.ts";
export { AnthropicProvider } from "./anthropic.ts";
export { OpenAIProvider } from "./openai.ts";

import { AnthropicProvider } from "./anthropic.ts";
import { OpenAIProvider } from "./openai.ts";
import type { AIProvider } from "./base.ts";

export interface ProviderConfig {
  provider?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  model?: string;
}

/**
 * Factory: creates the configured AI provider.
 * Provider is selected via `config.provider` (default: "anthropic").
 * API keys must be passed from environment variables — never hardcoded.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  const providerName = (config.provider ?? "anthropic").toLowerCase();

  if (providerName === "openai") {
    if (!config.openaiApiKey) throw new Error("AI_PROVIDER=openai requires OPENAI_API_KEY");
    return new OpenAIProvider(config.openaiApiKey, config.model);
  }

  // Default: Anthropic
  if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required");
  return new AnthropicProvider(config.anthropicApiKey, config.model);
}
