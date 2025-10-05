import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { env } from "./config.js";

// Debug helper
const dbg = (...a: unknown[]) =>
  process.env.CAPTION_DEBUG ? console.error("[gemini]", ...a) : undefined;

// Flatten @google/genai candidates → single text
export const extractTextFromCandidates = (resp: any): string | undefined => {
  if (!resp || !Array.isArray(resp.candidates)) return;
  const out: string[] = [];
  for (const c of resp.candidates) {
    const parts = c?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const p of parts) {
      if (typeof p === "string") out.push(p);
      else if (p && typeof p.text === "string") out.push(p.text);
    }
  }
  const s = out.join("\n").trim();
  return s.length ? s : undefined;
};

// Resolve text from multiple possible Gemini shapes
export async function resolveResponseText(payload: unknown): Promise<string | undefined> {
  const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  if (typeof payload === "string") return clean(payload);
  if (!payload || typeof payload !== "object") return undefined;
  const obj: any = payload;

  // 1) top-level text
  const top = clean(obj.text);
  if (top) return top;

  // 2) nested response.text() or .text
  const r = obj.response;
  if (r) {
    if (typeof r.text === "function") {
      try {
        const t = await Promise.resolve(r.text());
        const ct = clean(t);
        if (ct) return ct;
      } catch {}
    }
    if (typeof r.text === "string") {
      const ct = clean(r.text);
      if (ct) return ct;
    }
  }

  // 3) candidates[].content.parts[].text
  const cand = extractTextFromCandidates(obj);
  if (cand) return cand;

  return undefined;
}

const apiKey =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  env.GOOGLE_GENAI_API_KEY ||
  env.GEMINI_API_KEY ||
  "";

// No model suffix normalization - use env vars directly
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";

console.log(`[Gemini] Text model: ${TEXT_MODEL}`);
console.log(`[Gemini] Vision model: ${VISION_MODEL}`);

type GeminiContentPart = Record<string, unknown> | string | number | boolean | null;

type GeminiContentList = Array<GeminiContentPart>;

export type GeminiGenerateContentInput =
  | GeminiContentList
  | (Partial<GeminiGenerateContentParameters> & { contents: GeminiContentList });

export interface GeminiGenerateContentParameters {
  model?: string;
  contents: GeminiContentList;
  [key: string]: unknown;
}

export interface GeminiGenerateContentResponse {
  text?: string;
  response?: {
    text?: () => string;
    usageMetadata?: { totalTokenCount?: number };
    [key: string]: unknown;
  };
  usageMetadata?: { totalTokenCount?: number };
  [key: string]: unknown;
}

export interface GeminiModel {
  generateContent: (input: GeminiGenerateContentInput) => Promise<GeminiGenerateContentResponse>;
}

export type LegacyGoogleGenAI = GoogleGenAI & {
  getGenerativeModel: (options: { model: string }) => GeminiModel;
};

let client: LegacyGoogleGenAI | null = null;
let cachedVisionModel: GeminiModel | null = null;
let cachedTextModel: GeminiModel | null = null;
let warnedMissingKey = false;

const warnMissingKey = () => {
  if (!warnedMissingKey) {
    console.warn(
      "GEMINI_API_KEY or GOOGLE_GENAI_API_KEY environment variable is not set. Gemini AI features will fall back to OpenAI."
    );
    warnedMissingKey = true;
  }
};

export const isGeminiAvailable = (): boolean => apiKey.length > 0;

const ensureClient = (): LegacyGoogleGenAI => {
  if (!isGeminiAvailable()) {
    warnMissingKey();
    throw new Error("Gemini API key is not configured");
  }

  if (!client) {
    const options: GoogleGenAIOptions = { apiKey, apiVersion: "v1" };
    client = new GoogleGenAI(options) as LegacyGoogleGenAI;
  }

  return client;
};

export const getGoogleGenerativeAI = (): LegacyGoogleGenAI => ensureClient();

const hasContents = (
  value: unknown
): value is Partial<GeminiGenerateContentParameters> & { contents: GeminiContentList } =>
  typeof value === "object" &&
  value !== null &&
  "contents" in value &&
  (value as { contents?: unknown }).contents !== undefined;

const normalizeGenerateContentInput = (
  modelName: string,
  input: GeminiGenerateContentInput
): GeminiGenerateContentParameters => {
  if (hasContents(input)) {
    const candidate = input as Partial<GeminiGenerateContentParameters> & {
      contents: GeminiContentList;
      model?: string;
    };
    const selectedModel = typeof candidate.model === "string" && candidate.model.trim().length > 0
      ? candidate.model
      : modelName;
    const { model: _ignored, contents, ...rest } = candidate;
    return {
      model: selectedModel,
      contents,
      ...(rest as Omit<GeminiGenerateContentParameters, "model" | "contents">)
    };
  }

  return {
    model: modelName,
    contents: input as GeminiContentList
  };
};

const createModelAdapter = (modelName: string): GeminiModel => ({
  generateContent: async (input: GeminiGenerateContentInput) => {
    const request = normalizeGenerateContentInput(modelName, input);
    const client = ensureClient();
    const response = await client.models.generateContent(
      request as unknown as Parameters<typeof client.models.generateContent>[0]
    );
    dbg("resp.keys", response && typeof response === "object" ? Object.keys(response) : typeof response);
    dbg("candidates.len", (response as any)?.candidates?.length);
    const normalizedText = (await resolveResponseText(response)) ?? "";
    dbg("normalized.len", normalizedText.length, normalizedText.slice(0, 160));

    // expose both top-level .text and response.text() for legacy call sites
    const legacy: GeminiGenerateContentResponse = {
      ...response,
      text: normalizedText,
      response: {
        ...(typeof (response as any)?.response === "object" ? (response as any).response : {}),
        text: () => normalizedText,
      },
    };
    return legacy;
  }
});

export const getVisionModel = (): GeminiModel => {
  if (!cachedVisionModel) {
    cachedVisionModel = createModelAdapter(VISION_MODEL);
  }

  return cachedVisionModel;
};

export const getTextModel = (): GeminiModel => {
  if (!cachedTextModel) {
    cachedTextModel = createModelAdapter(TEXT_MODEL);
  }

  return cachedTextModel;
};
