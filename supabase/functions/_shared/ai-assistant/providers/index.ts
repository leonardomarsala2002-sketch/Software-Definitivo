export type { AIProvider, AIMessage, ChatOptions } from "./base.ts";
export { AnthropicProvider } from "./anthropic.ts";
export { OpenAIProvider } from "./openai.ts";
export { LovableProvider } from "./lovable.ts";

import { AnthropicProvider } from "./anthropic.ts";
import { OpenAIProvider } from "./openai.ts";
import { LovableProvider } from "./lovable.ts";
import type { AIProvider } from "./base.ts";

export interface ProviderConfig {
  provider?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  lovableApiKey?: string;
  model?: string;
}

/**
 * Factory: creates the configured AI provider.
 * Priority: explicit AI_PROVIDER env var > auto-detect from available keys.
 * If no AI_PROVIDER set, prefers LOVABLE_API_KEY (already available in the project).
 */
export function createProvider(config: ProviderConfig): AIProvider {
  const providerName = (config.provider ?? "").toLowerCase();

  if (providerName === "openai") {
    if (!config.openaiApiKey) throw new Error("AI_PROVIDER=openai requires OPENAI_API_KEY");
    return new OpenAIProvider(config.openaiApiKey, config.model);
  }

  if (providerName === "anthropic") {
    if (!config.anthropicApiKey) throw new Error("AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
    return new AnthropicProvider(config.anthropicApiKey, config.model);
  }

  if (providerName === "lovable") {
    if (!config.lovableApiKey) throw new Error("AI_PROVIDER=lovable requires LOVABLE_API_KEY");
    return new LovableProvider(config.lovableApiKey, config.model);
  }

  // Auto-detect: prefer LOVABLE_API_KEY (already in the project), then anthropic, then openai
  if (config.lovableApiKey) return new LovableProvider(config.lovableApiKey, config.model);
  if (config.anthropicApiKey) return new AnthropicProvider(config.anthropicApiKey, config.model);
  if (config.openaiApiKey) return new OpenAIProvider(config.openaiApiKey, config.model);

  throw new Error("Nessuna chiave AI configurata. Aggiungi LOVABLE_API_KEY (già disponibile), ANTHROPIC_API_KEY o OPENAI_API_KEY nei segreti Supabase.");
}
