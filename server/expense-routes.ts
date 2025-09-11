import express, { type Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import crypto from 'crypto';
import { authenticateToken } from './middleware/auth.js';
import { storage } from './storage.js';
import { MediaManager } from './lib/media.js';
import { logger } from './bootstrap/logger.js';
import { type InsertExpense, type User } from '@shared/schema.js';

interface AuthRequest extends express.Request {
  user?: User;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ImageShield protection for receipt uploads
interface ProtectionSettings {
  level: string;
  blur: number;
  noise: number;
  resize: number;
  quality: number;
}

const protectionPresets: Record<string, ProtectionSettings> = {
  light: { level: 'light', blur: 0.3, noise: 3, resize: 98, quality: 95 },
  standard: { level: 'standard', blur: 0.5, noise: 5, resize: 95, quality: 92 },
  heavy: { level: 'heavy', blur: 0.8, noise: 8, resize: 90, quality: 88 }
};

// Apply ImageShield protection server-side for receipts
async function applyReceiptImageShieldProtection(
  inputBuffer: Buffer, 
  protectionLevel: 'light' | 'standard' | 'heavy' = 'light',
  addWatermark: boolean = false
): Promise<Buffer> {
  try {
    const settings = protectionPresets[protectionLevel];
    let pipeline = sharp(inputBuffer);

    // Apply protection transformations
    if (settings.blur > 0) {
      pipeline = pipeline.blur(settings.blur);
    }

    if (settings.noise > 0) {
      // Apply noise through modulation instead of deprecated noise() method
      pipeline = pipeline.modulate({
        brightness: 1 + (Math.random() - 0.5) * (settings.noise / 100),
        saturation: 1 + (Math.random() - 0.5) * (settings.noise / 200)
      });
    }

    if (settings.resize < 100) {
      const metadata = await sharp(inputBuffer).metadata();
      if (metadata.width && metadata.height) {
        const newWidth = Math.round(metadata.width * (settings.resize / 100));
        const newHeight = Math.round(metadata.height * (settings.resize / 100));
        pipeline = pipeline.resize(newWidth, newHeight);
      }
    }

    // Add watermark for free users
    if (addWatermark) {
      const metadata = await pipeline.metadata();
      const watermarkText = Buffer.from(`
        <svg width="${metadata.width || 800}" height="${metadata.height || 600}">
          <text x="50%" y="95%" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.6)" text-anchor="middle">
            Protected by ThottoPilot™
          </text>
        </svg>
      `);
      
      pipeline = pipeline.composite([{
        input: watermarkText,
        top: 0,
        left: 0,
      }]);
    }

    return await pipeline
      .jpeg({ quality: settings.quality })
      .toBuffer();
  } catch (error) {
    console.error('Receipt ImageShield protection failed:', error);
    // Return original buffer if protection fails
    return inputBuffer;
  }
}

export function registerExpenseRoutes(app: Express) {
  // Get all expense categories
  app.get('/api/expense-categories', async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching expense categories:', error);
      res.status(500).json({ message: 'Failed to fetch expense categories' });
    }
  });

  // Get user expenses
  app.get('/api/expenses', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const expenses = await storage.getUserExpenses(req.user.id, taxYear);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ message: 'Failed to fetch expenses' });
    }
  });

  // Create new expense
  app.post('/api/expenses', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const currentYear = new Date().getFullYear();
      const expenseData = {
        ...req.body,
        userId: req.user.id,
        taxYear: req.body.taxYear || currentYear,
        amount: Math.round(parseFloat(req.body.amount) * 100)
      };

      const expense = await storage.createExpense(expenseData as InsertExpense);
      res.status(201).json(expense);
    } catch (error) {
      console.error('Error creating expense:', error);
      res.status(500).json({ message: 'Failed to create expense' });
    }
  });

  // Update expense
  app.put('/api/expenses/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const expenseId = parseInt(req.params.id);
      const updates = {
        ...req.body,
        amount: req.body.amount ? Math.round(parseFloat(req.body.amount) * 100) : undefined
      };

      const expense = await storage.updateExpense(expenseId, req.user.id, updates);
      res.json(expense);
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({ message: 'Failed to update expense' });
    }
  });

  // Delete expense
  app.delete('/api/expenses/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const expenseId = parseInt(req.params.id);
      await storage.deleteExpense(expenseId, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ message: 'Failed to delete expense' });
    }
  });

  // Get expense totals and analytics
  app.get('/api/expenses/totals', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const totals = await storage.getExpenseTotals(req.user.id, taxYear);
      res.json(totals);
    } catch (error) {
      console.error('Error fetching expense totals:', error);
      res.status(500).json({ message: 'Failed to fetch expense totals' });
    }
  });

  // Get expenses by date range for calendar view
  app.get('/api/expenses/range', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const expenses = await storage.getExpensesByDateRange(req.user.id, startDate, endDate);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching expenses by date range:', error);
      res.status(500).json({ message: 'Failed to fetch expenses by date range' });
    }
  });

  // Upload receipt for an expense with ImageShield protection
  app.post('/api/expenses/:id/receipt', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const expenseId = parseInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Determine protection level based on user tier (conservative for receipts)
      const userTier = req.user.tier || 'free';
      const protectionLevel = req.body.protectionLevel || 'light';
      const addWatermark = ['free', 'starter'].includes(userTier);
      
      // Apply ImageShield protection to receipt
      logger.info(
        `Applying ImageShield protection (${protectionLevel}) to receipt for user ${req.user.id}, tier: ${userTier}`
      );
      const protectedBuffer = await applyReceiptImageShieldProtection(
        req.file.buffer,
        protectionLevel as 'light' | 'standard' | 'heavy',
        addWatermark
      );

      let receiptUrl: string;
      let receiptFileName = `protected_${req.file.originalname}`;

      if (process.env.S3_BUCKET_MEDIA) {
        const asset = await MediaManager.uploadFile(protectedBuffer, {
          userId: req.user.id,
          filename: receiptFileName,
        });
        receiptUrl = asset.downloadUrl || asset.signedUrl || asset.key;
        receiptFileName = asset.filename;
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
        await fs.mkdir(uploadDir, { recursive: true });
        const fileName = `protected_${Date.now()}-${req.file.originalname}`;
        await fs.writeFile(path.join(uploadDir, fileName), protectedBuffer);
        receiptUrl = `/uploads/receipts/${fileName}`;
        receiptFileName = fileName;
      }

      const expense = await storage.updateExpense(expenseId, req.user.id, {
        receiptUrl,
        receiptFileName,
      });

      logger.info(`Protected receipt uploaded: ${receiptFileName} for expense ${expenseId}`);
      res.json(expense);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ message: 'Failed to upload receipt' });
    }
  });
}