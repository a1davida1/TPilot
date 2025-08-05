import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentGenerationSchema, insertUserImageSchema, insertUserSchema } from "@shared/schema";
import { generateContent } from "./services/content-generator";
import { generateAIContent, analyzeImageForContent } from "./services/ai-generator";
import { generateWithMultiProvider, getProviderStatus } from "./services/multi-ai-provider";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
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
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// JWT secret - in production this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Auth middleware
interface AuthRequest extends express.Request {
  user?: any;
}

const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, username } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        username: username || email.split('@')[0],
        displayName: username || email.split('@')[0]
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = newUser;

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Update last login
      await storage.updateUserProfile(user.id, { lastLoginAt: new Date() });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = user;

      res.json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in' });
    }
  });

  app.get("/api/auth/user", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Error fetching user' });
    }
  });

  app.patch("/api/user/settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const updates = req.body;
      const updatedUser = await storage.updateUserProfile(req.user.userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { password: _, ...userResponse } = updatedUser;
      res.json(userResponse);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ message: 'Error updating settings' });
    }
  });

  app.get("/api/user/subscription", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      res.json({
        plan: user?.subscription || 'free',
        status: 'active'
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching subscription' });
    }
  });

  app.get("/api/user/export", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      const generations = await storage.getUserContentGenerations(req.user.userId);
      const images = await storage.getUserImages(req.user.userId);
      
      const { password: _, ...userResponse } = user || {};
      
      res.json({
        user: userResponse,
        contentGenerations: generations,
        images: images,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error exporting data' });
    }
  });

  app.delete("/api/user/account", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // In a real app, you'd want to delete associated data too
      await storage.deleteUser(req.user.userId);
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting account' });
    }
  });
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
      
      // Generate AI content using multi-provider system (75-98% cost savings)
      const aiContent = await generateWithMultiProvider({
        user: { personalityProfile: parsedProfile, preferences: parsedProfile } as any,
        platform,
        imageDescription: imageDescription || undefined,
        customPrompt: customPrompt || undefined,
        subreddit: subreddit || undefined,
        allowsPromotion: allowsPromotion as 'yes' | 'no',
        baseImageUrl: imageUrl || undefined
      });
      
      // Save to database with provider info
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
      
      // Add provider info to response
      (contentGeneration as any).aiProvider = aiContent.provider;
      (contentGeneration as any).estimatedCost = aiContent.estimatedCost;
      
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

  // Get AI provider status
  app.get("/api/providers", async (req, res) => {
    try {
      const providers = getProviderStatus();
      res.json(providers);
    } catch (error) {
      console.error("Provider status error:", error);
      res.status(500).json({ message: "Failed to get provider status" });
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
