// Server-only AI provider utilities
// Do NOT import this file in client components - use ai-config.ts instead

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { queryOne, run } from "@/lib/db";
import {
  PROVIDER_DEFINITIONS,
  type AIProviderConfig,
  type AIProvidersSettings,
} from "@/lib/ai-config";

// Re-export types for convenience in server code
export type { AIProviderConfig, AIProvidersSettings } from "@/lib/ai-config";
export { PROVIDER_DEFINITIONS } from "@/lib/ai-config";

// --- DB helpers ---

export function getAIProviders(): AIProvidersSettings {
  const row = queryOne<{ value: string }>(
    "SELECT value FROM AppSettings WHERE key = 'ai_providers'"
  );
  if (row) {
    try {
      return JSON.parse(row.value);
    } catch {
      // corrupted, fall through
    }
  }
  // Return default (empty) config
  return {
    providers: PROVIDER_DEFINITIONS.map((d) => ({
      id: d.id,
      name: d.name,
      apiKey: "",
      enabled: false,
      baseUrl: d.defaultBaseUrl,
      defaultModel: d.defaultModel,
    })),
    selectedProviderId: "anthropic",
    selectedModel: "claude-sonnet-4-20250514",
  };
}

export function saveAIProviders(settings: AIProvidersSettings): void {
  run(
    "INSERT OR REPLACE INTO AppSettings (key, value) VALUES (?, ?)",
    ["ai_providers", JSON.stringify(settings)]
  );
}

// --- Provider factory ---

export function createProviderInstance(config: AIProviderConfig) {
  switch (config.id) {
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey });
    case "openai":
      return createOpenAI({ apiKey: config.apiKey });
    case "deepseek":
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || "https://api.deepseek.com/v1",
      });
    default:
      throw new Error(`Unknown provider: ${config.id}`);
  }
}

export function getProviderAndModel(providerId: string, model: string) {
  const settings = getAIProviders();
  const providerConfig = settings.providers.find((p) => p.id === providerId);
  if (!providerConfig) {
    throw new Error(`Provider "${providerId}" not found`);
  }
  if (!providerConfig.apiKey) {
    throw new Error(`Provider "${providerConfig.name}" has no API key configured`);
  }
  const provider = createProviderInstance(providerConfig);
  return provider(model);
}

// --- Legacy config helper ---

export function getLegacyAIConfig(): {
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  const settings = getAIProviders();
  const enabledProvider = settings.providers.find(
    (p) => p.enabled && p.apiKey
  );
  if (enabledProvider) {
    return {
      apiKey: enabledProvider.apiKey,
      model: enabledProvider.defaultModel,
      baseUrl:
        enabledProvider.id === "deepseek"
          ? enabledProvider.baseUrl || "https://api.deepseek.com/v1"
          : enabledProvider.id === "openai"
          ? "https://api.openai.com/v1"
          : "",
    };
  }

  const rows = [
    queryOne<{ value: string }>(
      "SELECT value FROM AppSettings WHERE key = 'ai_api_key'"
    ),
    queryOne<{ value: string }>(
      "SELECT value FROM AppSettings WHERE key = 'ai_model'"
    ),
    queryOne<{ value: string }>(
      "SELECT value FROM AppSettings WHERE key = 'ai_base_url'"
    ),
  ];
  return {
    apiKey: rows[0]?.value || "",
    model: rows[1]?.value || "gpt-4o",
    baseUrl: rows[2]?.value || "https://api.openai.com/v1",
  };
}
