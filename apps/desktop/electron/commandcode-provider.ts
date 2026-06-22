/**
 * Inline Command Code provider for pi-gui desktop.
 *
 * Registers the `commandcode` provider with pi, connecting to
 * Command Code's Provider API (https://commandcode.ai).
 *
 * Authentication (priority order):
 *   1. COMMANDCODE_API_KEY environment variable
 *   2. ~/.commandcode/auth.json  → { apiKey: "..." }
 *   3. ~/.pi/agent/auth.json     → { commandcode: "..." }
 *
 * Models are fetched live from Command Code's Provider API at startup.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

// ponytail: no deps – the provider registration is done via pi's built-in provider API.
// The ExtensionFactory wraps pi extension lifecycle so commandcode models show up.

const COMMANDCODE_API_BASE = process.env.COMMANDCODE_API_BASE ?? "https://api.commandcode.ai/alpha";
const COMMANDCODE_MODELS_URL = process.env.COMMANDCODE_MODELS_URL ?? "https://api.commandcode.ai/alpha/models";

interface CommandCodeModel {
  readonly id: string;
  readonly name: string;
  readonly contextWindow: number;
  readonly maxTokens: number;
  readonly reasoning?: boolean;
}

interface CommandCodeModelResponse {
  readonly models?: CommandCodeModel[];
}

async function fetchCommandCodeModels(): Promise<CommandCodeModel[]> {
  const response = await fetch(COMMANDCODE_MODELS_URL, {
    headers: { "User-Agent": "pi-gui-desktop/0.1" },
  });
  if (!response.ok) {
    console.warn(`[commandcode] Models endpoint returned ${response.status}, using static model list.`);
    return getDefaultModels();
  }
  const data = (await response.json()) as CommandCodeModelResponse;
  if (!Array.isArray(data.models) || data.models.length === 0) {
    console.warn("[commandcode] Models endpoint returned empty list, using static model list.");
    return getDefaultModels();
  }
  return data.models;
}

async function resolveCommandCodeApiKey(): Promise<string | undefined> {
  // 1. Environment variable
  const envKey = process.env.COMMANDCODE_API_KEY?.trim();
  if (envKey) return envKey;

  // 2. ~/.commandcode/auth.json
  try {
    const authPath = resolve(homedir(), ".commandcode", "auth.json");
    const raw = await readFile(authPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : undefined;
    if (key) return key;
  } catch {
    // File doesn't exist or invalid — ignore
  }

  // 3. ~/.pi/agent/auth.json
  try {
    const agentAuthPath = resolve(homedir(), ".pi", "agent", "auth.json");
    const raw = await readFile(agentAuthPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = typeof parsed.commandcode === "string" ? parsed.commandcode.trim() : undefined;
    if (key) return key;
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : undefined;
    if (apiKey) return apiKey;
  } catch {
    // File doesn't exist or invalid — ignore
  }

  return undefined;
}

function getDefaultModels(): CommandCodeModel[] {
  return [
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", contextWindow: 272_000, maxTokens: 8_192 },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 272_000, maxTokens: 8_192 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200_000, maxTokens: 8_192 },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", contextWindow: 200_000, maxTokens: 8_192 },
    { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", contextWindow: 128_000, maxTokens: 8_192 },
  ];
}

export async function createCommandCodeExtension(): Promise<ReturnType<ExtensionFactory>> {
  const apiKey = await resolveCommandCodeApiKey();

  return {
    name: "commandcode-provider",
    description: "Command Code provider for pi-gui",
    async activate(pi) {
      const models = await fetchCommandCodeModels();

      // ponytail: using pi's native provider registration
      pi.registerProvider("commandcode", {
        name: "Command Code",
        baseUrl: COMMANDCODE_API_BASE,
        apiKey: apiKey ?? "$COMMANDCODE_API_KEY",
        authHeader: true,
        api: "anthropic",
        headers: {
          "User-Agent": "pi-gui-desktop/0.1",
        },
        // ponytail: OAuth with browser redirect, add when interactive auth is needed
        models: models.map((model) => ({
          id: model.id,
          name: model.name,
          reasoning: model.reasoning ?? false,
          input: ["text"] as const,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
          contextWindow: model.contextWindow,
          maxTokens: model.maxTokens,
        })),
      });
    },
    deactivate() {
      // Nothing to clean up.
    },
  };
}
