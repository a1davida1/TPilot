import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { env } from "./config.js";

type EnvRecord = Record<string, string | undefined>;

const envConfig = env as EnvRecord;

const apiKey =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  envConfig.GOOGLE_GENAI_API_KEY ||
  envConfig.GEMINI_API_KEY ||
  "";

const apiVersion = process.env.GEMINI_API_VERSION || envConfig.GEMINI_API_VERSION || undefined;
const textModelName =
  process.env.GEMINI_TEXT_MODEL ||
  envConfig.GEMINI_TEXT_MODEL ||
  "gemini-1.5-flash";
const visionModelName =
  process.env.GEMINI_VISION_MODEL ||
  envConfig.GEMINI_VISION_MODEL ||
  textModelName;

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
    const options: GoogleGenAIOptions = { apiKey };
    if (apiVersion && apiVersion.trim().length > 0) {
      options.apiVersion = apiVersion;
    }
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
    const legacy: GeminiGenerateContentResponse = {
      ...response,
      response: {
        ...(typeof response === "object" && response && "response" in response
          ? (response as { response?: Record<string, unknown> }).response
          : undefined),
        text: () => (response as { text?: string }).text ?? ""
      }
    };
    return legacy;
  }
});

export const getVisionModel = (): GeminiModel => {
  if (!cachedVisionModel) {
    cachedVisionModel = createModelAdapter(visionModelName);
  }

  return cachedVisionModel;
};

export const getTextModel = (): GeminiModel => {
  if (!cachedTextModel) {
    cachedTextModel = createModelAdapter(textModelName);
  }

  return cachedTextModel;
};
