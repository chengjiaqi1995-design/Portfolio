// Client-safe AI configuration types and constants
// This file can be safely imported in both client and server components

export interface AIProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  enabled: boolean;
  baseUrl?: string;
  defaultModel: string;
}

export interface AIProvidersSettings {
  providers: AIProviderConfig[];
  selectedProviderId: string;
  selectedModel: string;
}

export const PROVIDER_DEFINITIONS: {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  needsBaseUrl?: boolean;
  defaultBaseUrl?: string;
}[] = [
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-5-haiku-20241022",
    ],
  },
  {
    id: "google",
    name: "Gemini (Google)",
    defaultModel: "gemini-2.5-flash-preview-04-17",
    models: [
      "gemini-2.5-flash-preview-04-17",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.0-flash",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsBaseUrl: true,
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    defaultModel: "qwen-plus",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"],
    needsBaseUrl: true,
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
];
