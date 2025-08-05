import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentGenerationSchema, insertUserImageSchema } from "@shared/schema";
import { generateContent } from "./services/content-generator";
import { generateAIContent, analyzeImageForContent } from "./services/ai-generator";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  // Generate content endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      const validatedData = insertContentGenerationSchema.parse(req.body);
      
      const generatedContent = await generateContent(
        validatedData.platform,
        validatedData.style,
        validatedData.theme,
        req.body.timing,
        req.body.allowsPromotion
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

  // Get last generated content for browser extension
  app.get("/api/last-generated", async (req, res) => {
    try {
      const lastGenerated = await storage.getLastGenerated();
      if (lastGenerated) {
        res.json(lastGenerated);
      } else {
        res.status(404).json({ message: "No content generated yet" });
      }
    } catch (error) {
      console.error("Error fetching last generated content:", error);
      res.status(500).json({ message: "Failed to fetch last generated content" });
    }
  });

  // AI Content Generation
  app.post("/api/generate-ai", upload.single('image'), async (req, res) => {
    try {
      const { generationType, platform, customPrompt, subreddit, allowsPromotion, userProfile, style, theme } = req.body;
      
      // Parse userProfile if it's a string
      const parsedProfile = typeof userProfile === 'string' ? JSON.parse(userProfile) : userProfile;
      
      let imageDescription = '';
      let imageUrl = '';
      
      // If image was uploaded, analyze it
      if (req.file && generationType === 'ai-image') {
        imageUrl = `/uploads/${req.file.filename}`;
        const fullImageUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
        imageDescription = await analyzeImageForContent(fullImageUrl, { personalityProfile: parsedProfile } as any);
      }
      
      // Generate AI content
      const aiContent = await generateAIContent({
        user: { personalityProfile: parsedProfile, preferences: parsedProfile } as any,
        platform,
        imageDescription: imageDescription || undefined,
        customPrompt: customPrompt || undefined,
        subreddit: subreddit || undefined,
        allowsPromotion: allowsPromotion as 'yes' | 'no',
        baseImageUrl: imageUrl || undefined
      });
      
      // Save to database
      const contentGeneration = await storage.createContentGeneration({
        platform,
        style: style || 'ai-generated',
        theme: theme || 'personalized',
        titles: aiContent.titles,
        content: aiContent.content,
        photoInstructions: aiContent.photoInstructions,
        generationType: 'ai',
        prompt: customPrompt || imageDescription,
        subreddit,
        allowsPromotion
      });
      
      res.json(contentGeneration);
    } catch (error) {
      console.error("AI generation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate AI content" 
      });
    }
  });

  // Upload user image
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      const { tags } = req.body;
      const imageUrl = `/uploads/${req.file.filename}`;
      
      const userImage = await storage.createUserImage('temp-user', {
        originalFileName: req.file.originalname,
        originalUrl: imageUrl,
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
        protectionSettings: undefined
      });
      
      res.json(userImage);
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Get user images
  app.get("/api/user-images", async (req, res) => {
    try {
      const images = await storage.getUserImages('temp-user');
      res.json(images);
    } catch (error) {
      console.error("Error fetching user images:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Protect image
  app.post("/api/protect-image/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { protectionLevel } = req.body;
      
      const image = await storage.getImageById(imageId);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      // For now, just mark as protected. In a real implementation,
      // you'd apply the actual protection processing here
      const protectedUrl = image.originalUrl + '?protected=true';
      const settings = { level: protectionLevel };
      
      const updatedImage = await storage.updateImageProtection(imageId, protectedUrl, settings);
      res.json(updatedImage);
    } catch (error) {
      console.error("Image protection error:", error);
      res.status(500).json({ message: "Failed to protect image" });
    }
  });

  // Delete user image
  app.delete("/api/user-images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      await storage.deleteUserImage(imageId);
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Image deletion error:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
