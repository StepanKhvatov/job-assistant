import type { DeepSeekChatMessage, VacancyRankModelResult } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
};

export async function deepSeekChatJson<T>(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Promise<T> {
  const res = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  const body = (await res.json()) as ChatCompletionResponse;

  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    throw new Error(`DeepSeek HTTP ${res.status}: ${msg}`);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned empty content");
  }

  return JSON.parse(content) as T;
}

export async function deepSeekChatText(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Promise<string> {
  const res = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      stream: false,
    }),
  });

  const body = (await res.json()) as ChatCompletionResponse;

  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    throw new Error(`DeepSeek HTTP ${res.status}: ${msg}`);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned empty content");
  }

  return content;
}

export async function rankVacancyWithDeepSeek(
  env: { apiKey: string; baseUrl: string; model: string },
  messages: DeepSeekChatMessage[],
): Promise<VacancyRankModelResult> {
  const raw = await deepSeekChatJson<Partial<VacancyRankModelResult>>({
    ...env,
    messages,
  });

  const score = Number(raw.score);
  if (!Number.isFinite(score)) {
    throw new Error("Invalid score in model response");
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    summary: String(raw.summary ?? "").trim(),
    pros: Array.isArray(raw.pros) ? raw.pros.map(String) : [],
    cons: Array.isArray(raw.cons) ? raw.cons.map(String) : [],
  };
}

export async function writeCoverLetterWithDeepSeek(
  env: { apiKey: string; baseUrl: string; model: string },
  messages: DeepSeekChatMessage[],
): Promise<string> {
  const content = await deepSeekChatText({
    ...env,
    messages,
  });

  return content.trim();
}
