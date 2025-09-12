import { GoogleGenerativeAI } from "@google/generative-ai";

// Validate API key is present
const apiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENAI_API_KEY environment variable is not set. " +
    "Please set this variable to use Gemini AI features."
  );
}

export const genAI = new GoogleGenerativeAI(apiKey);
export const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // keep consistent