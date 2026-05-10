import { logUsage, UsageType } from "./usage";
import { OPENROUTER_MODELS } from "./openrouterModels";
import { getOpenRouterRoutingState } from "./openrouterMonitor";

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type GeminiContent = {
  role: "user" | "model" | "system";
  parts: GeminiPart[];
};

type GenerationConfig = {
  temperature?: number;
  max_tokens?: number;
  maxOutputTokens?: number;
  top_p?: number;
  stop?: string | string[];
  seed?: number;
  response_format?: unknown;
};

type OpenRouterUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type OpenRouterTextResponse = {
  text: string;
  usage: OpenRouterUsage;
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY =
  import.meta.env.VITE_OPENROUTER_API_KEY ||
  import.meta.env.OPENROUTER_API_KEY ||
  "";

const OPENROUTER_REFERER =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const MODELS = OPENROUTER_MODELS;

function hasImageContent(contents: GeminiContent[]) {
  return contents.some(content =>
    content.parts.some(part => Boolean(part.inlineData))
  );
}

function partToOpenRouterContent(part: GeminiPart): OpenRouterContentPart {
  if (part.inlineData) {
    return {
      type: "image_url",
      image_url: {
        url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      },
    };
  }

  return {
    type: "text",
    text: part.text || "",
  };
}

function convertMessages(contents: GeminiContent[], systemInstruction?: string) {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string | OpenRouterContentPart[] }> = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const content of contents) {
    if (content.role === "system") {
      messages.push({
        role: "system",
        content: content.parts.map(part => part.text || "").join("\n").trim(),
      });
      continue;
    }

    const openRouterRole = content.role === "model" ? "assistant" : "user";
    const parts = content.parts
      .map(partToOpenRouterContent)
      .filter((part): part is OpenRouterContentPart =>
        part.type === "text" ? Boolean(part.text) : Boolean(part.image_url?.url)
      );

    if (parts.length === 0) continue;

    messages.push({
      role: openRouterRole,
      content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
    });
  }

  return messages;
}

function buildOfflineFallback(contents: GeminiContent[]) {
  const lastUserMessage = [...contents].reverse().find(content => content.role !== "system");
  const prompt = lastUserMessage?.parts
    .map(part => part.text || "")
    .join(" ")
    .trim();

  if (prompt) {
    return `I'm running in offline mode right now, so I can't reach the legal AI service yet.\n\nYou asked: ${prompt}\n\nPlease add VITE_OPENROUTER_API_KEY to .env.local to restore live answers.`;
  }

  return "I'm running in offline mode right now, so I can't reach the legal AI service yet. Please add VITE_OPENROUTER_API_KEY to .env.local to restore live answers.";
}

function isOpenRouterAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("unauthorized") ||
    normalized.includes("user not found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("permission denied")
  );
}

async function requestOpenRouterText(params: {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
}): Promise<OpenRouterTextResponse> {
  if (!OPENROUTER_API_KEY) {
    return {
      text: buildOfflineFallback(params.contents),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  const { model, contents, systemInstruction, generationConfig } = params;
  const payload: Record<string, unknown> = {
    model,
    messages: convertMessages(contents, systemInstruction),
    temperature: generationConfig?.temperature ?? 0.7,
    stream: false,
  };

  if (generationConfig?.max_tokens ?? generationConfig?.maxOutputTokens) {
    payload.max_tokens = generationConfig.max_tokens ?? generationConfig.maxOutputTokens;
  }

  if (generationConfig?.top_p !== undefined) {
    payload.top_p = generationConfig.top_p;
  }

  if (generationConfig?.stop !== undefined) {
    payload.stop = generationConfig.stop;
  }

  if (generationConfig?.seed !== undefined) {
    payload.seed = generationConfig.seed;
  }

  if (generationConfig?.response_format !== undefined) {
    payload.response_format = generationConfig.response_format;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": "Huqiqiyy UAE Legal Copilot",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as any)?.error?.message ||
      (data as any)?.error ||
      `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  const usage = (data as any)?.usage || {};
  const promptTokens = Number(usage.prompt_tokens || usage.promptTokens || 0);
  const completionTokens = Number(usage.completion_tokens || usage.completionTokens || 0);
  const totalTokens = Number(usage.total_tokens || usage.totalTokens || promptTokens + completionTokens);
  const content = (data as any)?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return {
      text: content,
      usage: { promptTokens, completionTokens, totalTokens },
    };
  }
  if (Array.isArray(content)) {
    return {
      text: content
      .map((chunk: any) => (typeof chunk?.text === "string" ? chunk.text : ""))
      .join("")
      .trim(),
      usage: { promptTokens, completionTokens, totalTokens },
    };
  }

  return {
    text: "",
    usage: { promptTokens, completionTokens, totalTokens },
  };
}

async function runWithFallback(params: {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  usageLabel?: UsageType;
}) {
  const { model, contents, systemInstruction, generationConfig, usageLabel = "openrouter_query" } = params;
  const wantsVision = hasImageContent(contents);
  const routing = getOpenRouterRoutingState(model, wantsVision);
  const uniqueCandidates = [...new Set(routing.candidates.filter(Boolean))];
  let lastError: unknown = null;

  if (!OPENROUTER_API_KEY) {
    logUsage(usageLabel, "error");
    return buildOfflineFallback(contents);
  }

  for (const candidate of uniqueCandidates) {
    try {
      const result = await requestOpenRouterText({
        model: candidate,
        contents,
        systemInstruction,
        generationConfig,
      });
      logUsage(usageLabel, "success", result.usage.totalTokens, {
        model: candidate,
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        utilizationPct: routing.utilizationPct,
        usageStage: routing.isWarning ? "fallback" : "primary",
      });
      return result.text;
    } catch (error) {
      lastError = error;
      if (isOpenRouterAuthError(error)) {
        logUsage(usageLabel, "error", 0, { model: candidate, usageStage: "error" });
        return `${buildOfflineFallback(contents)}\n\nNote: OpenRouter rejected the API key (401). Please replace VITE_OPENROUTER_API_KEY with a valid key from your OpenRouter dashboard.`;
      }
      console.warn(`OpenRouter model ${candidate} failed, trying next fallback`, error);
    }
  }

  logUsage(usageLabel, "error", 0, { usageStage: "error" });
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "OpenRouter request failed"));
}

export async function generateGeminiContent(params: {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  usageLabel?: UsageType;
}) {
  return runWithFallback(params);
}
