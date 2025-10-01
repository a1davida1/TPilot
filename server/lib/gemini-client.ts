import { GoogleGenAI, type GoogleGenAIOptions, type types } from "@google/genai";
import { env } from "./config.js";

const apiKey =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  env.GOOGLE_GENAI_API_KEY ||
  env.GEMINI_API_KEY ||
  "";

const apiVersion = process.env.GEMINI_API_VERSION || env.GEMINI_API_VERSION || undefined;
const textModelName = process.env.GEMINI_TEXT_MODEL || env.GEMINI_TEXT_MODEL;
const visionModelName = process.env.GEMINI_VISION_MODEL || env.GEMINI_VISION_MODEL;

export type GeminiGenerateContentInput =
  | types.ContentListUnion
  | (Partial<types.GenerateContentParameters> & { contents: types.ContentListUnion });

export interface GeminiModel {
  generateContent: (input: GeminiGenerateContentInput) => Promise<types.GenerateContentResponse>;
}

let client: GoogleGenAI | null = null;
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

const ensureClient = (): GoogleGenAI => {
  if (!isGeminiAvailable()) {
    warnMissingKey();
    throw new Error("Gemini API key is not configured");
  }

  if (!client) {
    const options: GoogleGenAIOptions = { apiKey };
    if (apiVersion && apiVersion.trim().length > 0) {
      options.apiVersion = apiVersion;
    }
    client = new GoogleGenAI(options);
  }

  return client;
};

export const getGoogleGenerativeAI = (): GoogleGenAI => ensureClient();

const hasContents = (
  value: unknown
): value is Partial<types.GenerateContentParameters> & { contents: types.ContentListUnion } =>
  typeof value === "object" &&
  value !== null &&
  "contents" in value &&
  (value as { contents?: unknown }).contents !== undefined;

const normalizeGenerateContentInput = (
  modelName: string,
  input: GeminiGenerateContentInput
): types.GenerateContentParameters => {
  if (hasContents(input)) {
    const candidate = input as Partial<types.GenerateContentParameters> & {
      contents: types.ContentListUnion;
      model?: string;
    };
    const selectedModel = typeof candidate.model === "string" && candidate.model.trim().length > 0
      ? candidate.model
      : modelName;
    const { model: _ignored, ...rest } = candidate;
    return {
      model: selectedModel,
      ...(rest as Omit<types.GenerateContentParameters, "model">)
    };
  }

  return {
    model: modelName,
    contents: input as types.ContentListUnion
  };
};

const createModelAdapter = (modelName: string): GeminiModel => ({
  generateContent: async (input: GeminiGenerateContentInput) => {
    const request = normalizeGenerateContentInput(modelName, input);
    const response = await ensureClient().models.generateContent(request);
    const legacy = { ...response, response: { text: () => response.text ?? "" } };
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
