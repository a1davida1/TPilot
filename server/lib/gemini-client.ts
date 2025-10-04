import { GoogleGenAI, type GoogleGenAIOptions } from "@google/genai";
import { env } from "./config.js";

const apiKey =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  env.GOOGLE_GENAI_API_KEY ||
  env.GEMINI_API_KEY ||
  "";

const DEFAULT_TEXT_MODEL = "gemini-1.5-flash";

const normalizeModelName = (name: string): string => {
  const trimmed = name.trim();
  const withoutPrefix = trimmed.startsWith("models/")
    ? trimmed.slice("models/".length)
    : trimmed;
  const baseName = withoutPrefix.length > 0 ? withoutPrefix : DEFAULT_TEXT_MODEL;
  const hasVersionSuffix = /-(?:latest|\d[\w]*)$/i.test(baseName);
  const candidate = hasVersionSuffix ? baseName : `${baseName}-latest`;
  return `models/${candidate}`;
};

const apiVersion = process.env.GEMINI_API_VERSION || env.GEMINI_API_VERSION || undefined;
const textModelNameSource =
  process.env.GEMINI_TEXT_MODEL || env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
const textModelName = normalizeModelName(textModelNameSource);
const visionModelNameSource =
  process.env.GEMINI_VISION_MODEL || env.GEMINI_VISION_MODEL || textModelNameSource;
const visionModelName = normalizeModelName(visionModelNameSource);

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
    const rawCandidateMetadata = (response as { candidates?: unknown }).candidates;
    const candidates = Array.isArray(rawCandidateMetadata)
      ? (rawCandidateMetadata as Array<Record<string, unknown>>)
      : [];
    const textSegments: string[] = [];

    for (const candidate of candidates) {
      if (typeof candidate !== "object" || candidate === null) {
        continue;
      }

      const directCandidateText =
        "text" in candidate ? (candidate as { text?: unknown }).text : undefined;

      if (typeof directCandidateText === "string" && directCandidateText.length > 0) {
        textSegments.push(directCandidateText);
      }

      const content = "content" in candidate ? (candidate as { content?: unknown }).content : undefined;
      if (typeof content === "string" && content.length > 0) {
        textSegments.push(content);
        continue;
      }

      if (typeof content !== "object" || content === null) {
        continue;
      }

      const parts = Array.isArray((content as { parts?: unknown }).parts)
        ? (((content as { parts?: unknown }).parts ?? []) as Array<Record<string, unknown>>)
        : [];

      for (const part of parts) {
        if (typeof part !== "object" || part === null) {
          continue;
        }

        const value = "text" in part ? (part as { text?: unknown }).text : undefined;
        if (typeof value === "string" && value.length > 0) {
          textSegments.push(value);
        }
      }
    }

    const joinedText = textSegments.join("");
    const fallbackText =
      typeof (response as { text?: unknown }).text === "string"
        ? (response as { text: string }).text
        : "";
    const selectedText = joinedText.length > 0 ? joinedText : fallbackText;
    const normalizedText = selectedText.trim().length > 0 ? selectedText : "";

    const legacy: GeminiGenerateContentResponse = {
      ...response,
      candidates: rawCandidateMetadata ?? candidates,
      text: normalizedText,
      response: {
        ...(typeof response === "object" && response && "response" in response
          ? (response as { response?: Record<string, unknown> }).response
          : undefined),
        text: () => normalizedText
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
