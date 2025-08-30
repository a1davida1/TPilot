import express, { type Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from './middleware/auth.js';
import { storage } from './storage.js';
import { MediaManager } from './lib/media.js';

interface AuthRequest extends express.Request {
  user?: any;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

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

      const expense = await storage.createExpense(expenseData as any);
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

  // Upload receipt for an expense
  app.post('/api/expenses/:id/receipt', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const expenseId = parseInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      let receiptUrl: string;
      let receiptFileName = req.file.originalname;

      if (process.env.S3_BUCKET_MEDIA) {
        const asset = await MediaManager.uploadFile(req.file.buffer, {
          userId: req.user.id,
          filename: req.file.originalname,
        });
        receiptUrl = asset.downloadUrl || asset.signedUrl || asset.key;
        receiptFileName = asset.filename;
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
        await fs.mkdir(uploadDir, { recursive: true });
        const fileName = `${Date.now()}-${req.file.originalname}`;
        await fs.writeFile(path.join(uploadDir, fileName), req.file.buffer);
        receiptUrl = `/uploads/receipts/${fileName}`;
        receiptFileName = fileName;
      }

      const expense = await storage.updateExpense(expenseId, req.user.id, {
        receiptUrl,
        receiptFileName,
      });

      res.json(expense);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ message: 'Failed to upload receipt' });
    }
  });
}