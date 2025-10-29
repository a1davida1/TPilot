// OpenRouter client using OpenAI SDK for InternVL3-78B
import OpenAI from "openai";
import { logger } from "../bootstrap/logger.js";
import { FRONTEND_URL } from "../config.js";

const baseURL = "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  logger.warn("[OpenRouter] OPENROUTER_API_KEY not set. Provider will be disabled.");
}

const site = process.env.OPENROUTER_SITE_URL || FRONTEND_URL || "https://thottopilot.com";
const appName = process.env.OPENROUTER_APP_NAME || "ThottoPilot";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "x-ai/grok-4-fast";

// Model constants for easy reference
export const GROK_2_FAST = "x-ai/grok-2-fast";
export const GROK_4_FAST = "x-ai/grok-4-fast";
export const INTERNVL_78B = "opengvlab/internvl3-78b";

logger.info(`[OpenRouter] Default model: ${DEFAULT_MODEL}`);

export const openrouter = apiKey ? new OpenAI({
  apiKey,
  baseURL,
  timeout: 60000, // 60 second timeout - allow enough time for caption generation
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
  logger.debug(`[OpenRouter] Text generation with model: ${model}`);
  
  try {
    const resp = await openrouter.chat.completions.create({
      model,
      messages: [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.7,
    });
    const content = resp.choices?.[0]?.message?.content ?? "";
    logger.debug(`[OpenRouter] Text generation successful`, { contentLength: content.length });
    return content;
  } catch (error) {
    logger.error(`[OpenRouter] Text generation failed`, {
      model,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
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
  logger.info(`[OpenRouter] Vision generation starting`, { 
    model, 
    imageUrl: opts.imageUrl.substring(0, 100) + '...',
    promptLength: opts.prompt.length
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  try {
    const resp = await openrouter.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      frequency_penalty: opts.frequencyPenalty ?? 0.7,
      presence_penalty: opts.presencePenalty ?? 1.5,
      // @ts-ignore - OpenRouter-specific provider settings
      provider: {
        allow_fallbacks: true,
        data_collection: "allow",
      },
    });
    
    const content = resp.choices?.[0]?.message?.content ?? "";
    logger.info(`[OpenRouter] Vision generation successful`, { 
      contentLength: content.length,
      model: resp.model,
      finishReason: resp.choices?.[0]?.finish_reason
    });
    return content;
  } catch (error: unknown) {
    logger.error(`[OpenRouter] Vision generation failed`, {
      model,
      imageUrl: opts.imageUrl,
      error: error instanceof Error ? error.message : String(error),
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
    });
    throw error;
  }
}

export function isOpenRouterEnabled(): boolean {
  return Boolean(apiKey && openrouter);
}
