import { GoogleGenerativeAI } from "@google/generative-ai";

// Check if API key is available
const apiKey = process.env.GOOGLE_GENAI_API_KEY;

// Create placeholder exports that will be initialized if API key exists
let genAI: GoogleGenerativeAI | null = null;
let visionModel: any = null;
let textModel: any = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // keep consistent
} else {
  console.warn(
    "GOOGLE_GENAI_API_KEY environment variable is not set. " +
    "Gemini AI features will fall back to OpenAI."
  );
}

// Export helper to check if Gemini is available
export const isGeminiAvailable = () => !!apiKey;
export { genAI, visionModel, textModel };