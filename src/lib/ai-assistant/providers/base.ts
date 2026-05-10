export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>;
}
