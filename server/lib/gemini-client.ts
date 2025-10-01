import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiModel = GenerativeModel;

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

let client: GoogleGenerativeAI | null = null;
let cachedVisionModel: GenerativeModel | null = null;
let cachedTextModel: GenerativeModel | null = null;
let warnedMissingKey = false;

const warnMissingKey = () => {
  if (!warnedMissingKey) {
    console.warn(
      "GOOGLE_GENAI_API_KEY or GEMINI_API_KEY environment variable is not set. Gemini AI features will fall back to OpenAI."
    );
    warnedMissingKey = true;
  }
};

export const isGeminiAvailable = (): boolean => apiKey.length > 0;

const ensureClient = (): GoogleGenerativeAI => {
  if (!isGeminiAvailable()) {
    warnMissingKey();
    throw new Error("Gemini API key is not configured");
  }

  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }

  return client;
};

export const getGoogleGenerativeAI = (): GoogleGenerativeAI => ensureClient();

export const getVisionModel = (): GenerativeModel => {
  if (!cachedVisionModel) {
    const instance = ensureClient();
    cachedVisionModel = instance.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  return cachedVisionModel;
};

export const getTextModel = (): GenerativeModel => {
  if (!cachedTextModel) {
    const instance = ensureClient();
    cachedTextModel = instance.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  return cachedTextModel;
};
