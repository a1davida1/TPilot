// OpenRouter client using OpenAI SDK for InternVL3-78B
import OpenAI from "openai";
import { FRONTEND_URL } from "../config.js";

const baseURL = "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.warn("[OpenRouter] OPENROUTER_API_KEY not set. Provider will be disabled.");
}

const site = process.env.OPENROUTER_SITE_URL || FRONTEND_URL || "https://thottopilot.com";
const appName = process.env.OPENROUTER_APP_NAME || "ThottoPilot";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "opengvlab/internvl3-78b";

// Model constants for easy reference
export const GROK_4_FAST = "x-ai/grok-4-fast";
export const INTERNVL_78B = "opengvlab/internvl3-78b";

console.log(`[OpenRouter] Default model: ${DEFAULT_MODEL}`);

export const openrouter = apiKey ? new OpenAI({
  apiKey,
  baseURL,
  defaultHeaders: {
    "HTTP-Referer": site,
    "X-Title": appName,
  },
}) : null;

export async function generateText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}) {
  if (!openrouter) {
    throw new Error("OpenRouter client not initialized - API key missing");
  }

  const model = opts.model || DEFAULT_MODEL;
  console.log(`[OpenRouter] Text generation with model: ${model}`);
  
  const resp = await openrouter.chat.completions.create({
    model,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: opts.prompt },
    ],
    temperature: opts.temperature ?? 0.7,
  });
  return resp.choices?.[0]?.message?.content ?? "";
}

export async function generateVision(opts: {
  prompt: string;
  imageUrl: string; // supports https:// or data:
  model?: string;
  temperature?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  system?: string;
}) {
  if (!openrouter) {
    throw new Error("OpenRouter client not initialized - API key missing");
  }

  const model = opts.model || DEFAULT_MODEL;
  console.log(`[OpenRouter] Vision generation with model: ${model}`);

  const messages: any[] = [];
  
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }

  messages.push({
    role: "user",
    content: [
      { type: "text", text: opts.prompt },
      { type: "image_url", image_url: { url: opts.imageUrl } },
    ],
  });

  const resp = await openrouter.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    frequency_penalty: opts.frequencyPenalty ?? 0.7,
    presence_penalty: opts.presencePenalty ?? 1.5,
    // @ts-ignore - OpenRouter-specific provider settings
    provider: {
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: "deny",
    },
  });
  
  return resp.choices?.[0]?.message?.content ?? "";
}

export function isOpenRouterEnabled(): boolean {
  return Boolean(apiKey && openrouter);
}
