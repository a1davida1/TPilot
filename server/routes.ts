import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentGenerationSchema } from "@shared/schema";
import { generateContent } from "./services/content-generator";

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate content endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      const validatedData = insertContentGenerationSchema.parse(req.body);
      
      const generatedContent = await generateContent(
        validatedData.platform,
        validatedData.style,
        validatedData.theme
      );
      
      const contentGeneration = await storage.createContentGeneration({
        ...validatedData,
        ...generatedContent
      });
      
      res.json(contentGeneration);
    } catch (error) {
      console.error("Content generation error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to generate content" 
      });
    }
  });

  // Get content history
  app.get("/api/content-history", async (req, res) => {
    try {
      const history = await storage.getUserContentGenerations();
      res.json(history);
    } catch (error) {
      console.error("Error fetching content history:", error);
      res.status(500).json({ message: "Failed to fetch content history" });
    }
  });

  // Get statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getContentGenerationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
