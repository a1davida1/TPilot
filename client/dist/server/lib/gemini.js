import { GoogleGenerativeAI } from "@google/generative-ai";
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // keep consistent
