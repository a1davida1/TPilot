import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey =
  process.env.GOOGLE_GENAI_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
const textModelName = process.env.GEMINI_TEXT_MODEL ?? "gemini-1.5-flash";
const visionModelName = process.env.GEMINI_VISION_MODEL ?? textModelName;

let genAI: GoogleGenerativeAI | null = null;
let visionModel: GenerativeModel | null = null;
let textModel: GenerativeModel | null = null;

if (!apiKey) {
  console.warn(
    "GOOGLE_GENAI_API_KEY or GEMINI_API_KEY environment variable is not set. " +
      "Gemini AI features will fall back to OpenAI."
  );
} else {
  genAI = new GoogleGenerativeAI(apiKey);
  const requestOptions = { apiVersion: "v1" } as const;
  visionModel = genAI.getGenerativeModel(
    { model: visionModelName },
    requestOptions
  );
  textModel = genAI.getGenerativeModel(
    { model: textModelName },
    requestOptions
  );
}

export const isGeminiAvailable = () => genAI !== null;
export { genAI, visionModel, textModel };