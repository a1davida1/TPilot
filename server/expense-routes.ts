import { type Request, type Response, type Express } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken, type AuthRequest } from './middleware/auth.js';
import { storage } from './storage.js';
import { MediaManager } from './lib/media.js';
import { logger } from './bootstrap/logger.js';
import { applyImageShieldToBuffer, protectionPresets } from './images/imageShield.js';
import { buildUploadUrl } from './lib/uploads.js';
import { type Expense, type ExpenseCategory, type InsertExpense } from '@shared/schema';

type ExpenseCategoryWithDefaults = ExpenseCategory & {
  defaultBusinessPurpose?: string | null;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const knownImageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.tiff'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const hasImageMimeType = file.mimetype.startsWith('image/');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const hasKnownImageExtension = knownImageExtensions.has(fileExtension);
    const isPdfMimeType = file.mimetype === 'application/pdf';

    if (hasImageMimeType || hasKnownImageExtension || isPdfMimeType) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Apply ImageShield protection server-side for receipts
// Now uses centralized imageShield module
async function applyReceiptImageShieldProtection(
  inputBuffer: Buffer, 
  protectionLevel: 'light' | 'standard' | 'heavy' = 'light',
  addWatermark: boolean = false
): Promise<Buffer> {
  try {
    const preset = protectionPresets[protectionLevel];
    return await applyImageShieldToBuffer(inputBuffer, preset, addWatermark, 'receipt-protection');
  } catch (error) {
    logger.error('Receipt ImageShield protection failed:', error);
    // Return original buffer if protection fails
    return inputBuffer;
  }
}

export function registerExpenseRoutes(app: Express) {
  // Get all expense categories
  app.get('/api/expense-categories', async (req: Request, res: Response) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      logger.error('Error fetching expense categories:', error);
      res.status(500).json({ message: 'Failed to fetch expense categories' });
    }
  });

  // Get user expenses
  app.get('/api/expenses', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const expenses = await storage.getUserExpenses(req.user.id, taxYear);
      res.json(expenses);
    } catch (error) {
      logger.error('Error fetching expenses:', error);
      res.status(500).json({ message: 'Failed to fetch expenses' });
    }
  });

  // Create new expense
  app.post('/api/expenses', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const currentYear = new Date().getFullYear();
      const requestBody = req.body as Record<string, unknown>;
      const expenseDate = new Date(String(requestBody.expenseDate));
      if (Number.isNaN(expenseDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expense date' });
      }

      const rawAmount = Number.parseFloat(String(requestBody.amount));
      if (Number.isNaN(rawAmount)) {
        return res.status(400).json({ message: 'Invalid expense amount' });
      }
      const amountInCents = Math.round(rawAmount * 100);

      const parsedCategoryId = Number.parseInt(String(requestBody.categoryId), 10);
      if (!Number.isInteger(parsedCategoryId)) {
        return res.status(400).json({ message: 'Invalid expense category' });
      }

      const category = await storage.getExpenseCategory(parsedCategoryId);
      if (!category) {
        return res.status(400).json({ message: 'Invalid expense category' });
      }

      const categoryDefaults: ExpenseCategoryWithDefaults = category;
      const rawBusinessPurpose = requestBody.businessPurpose;
      const trimmedBusinessPurpose =
        typeof rawBusinessPurpose === 'string' ? rawBusinessPurpose.trim() : undefined;
      const businessPurposeToApply =
        trimmedBusinessPurpose && trimmedBusinessPurpose.length > 0
          ? trimmedBusinessPurpose
          : categoryDefaults.defaultBusinessPurpose ?? undefined;

      const parsedTaxYear =
        requestBody.taxYear !== undefined
          ? Number.parseInt(String(requestBody.taxYear), 10)
          : currentYear;

      if (Number.isNaN(parsedTaxYear)) {
        return res.status(400).json({ message: 'Invalid tax year' });
      }

      const descriptionValue = requestBody.description;
      if (typeof descriptionValue !== 'string' || descriptionValue.trim().length === 0) {
        return res.status(400).json({ message: 'Description is required' });
      }

      const expensePayload: InsertExpense = {
        userId: req.user.id,
        categoryId: parsedCategoryId,
        description: descriptionValue,
        amount: amountInCents,
        expenseDate,
        taxYear: parsedTaxYear,
        deductionPercentage: category.deductionPercentage,
        businessPurpose: businessPurposeToApply ?? null,
        vendor: typeof requestBody.vendor === 'string' ? requestBody.vendor : null,
        receiptUrl: typeof requestBody.receiptUrl === 'string' ? requestBody.receiptUrl : null,
        receiptFileName: typeof requestBody.receiptFileName === 'string' ? requestBody.receiptFileName : null,
        notes: typeof requestBody.notes === 'string' ? requestBody.notes : null,
        tags: isStringArray(requestBody.tags) ? requestBody.tags : null,
        isRecurring: typeof requestBody.isRecurring === 'boolean' ? requestBody.isRecurring : false,
        recurringPeriod: typeof requestBody.recurringPeriod === 'string' ? requestBody.recurringPeriod : null,
      };

      const expense = await storage.createExpense(expensePayload);
      res.status(201).json(expense);
    } catch (error) {
      logger.error('Error creating expense:', error);
      res.status(500).json({ message: 'Failed to create expense' });
    }
  });

  // Update expense
  app.put('/api/expenses/:id', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const expenseId = Number.parseInt(req.params.id, 10);
      const requestBody = req.body as Record<string, unknown>;
      const updates: Partial<Expense> = {};

      if (typeof requestBody.description === 'string') {
        updates.description = requestBody.description;
      }

      if (typeof requestBody.vendor === 'string') {
        updates.vendor = requestBody.vendor;
      }

      if (typeof requestBody.receiptUrl === 'string') {
        updates.receiptUrl = requestBody.receiptUrl;
      }

      if (typeof requestBody.receiptFileName === 'string') {
        updates.receiptFileName = requestBody.receiptFileName;
      }

      if (typeof requestBody.notes === 'string') {
        updates.notes = requestBody.notes;
      }

      if (isStringArray(requestBody.tags)) {
        updates.tags = requestBody.tags;
      }

      if (typeof requestBody.isRecurring === 'boolean') {
        updates.isRecurring = requestBody.isRecurring;
      }

      if (typeof requestBody.recurringPeriod === 'string') {
        updates.recurringPeriod = requestBody.recurringPeriod;
      }

      if (requestBody.amount !== undefined) {
        const parsedAmount = Number.parseFloat(String(requestBody.amount));
        if (Number.isNaN(parsedAmount)) {
          return res.status(400).json({ message: 'Invalid expense amount' });
        }
        updates.amount = Math.round(parsedAmount * 100);
      }

      if (requestBody.expenseDate !== undefined) {
        const expenseDate = new Date(String(requestBody.expenseDate));
        if (Number.isNaN(expenseDate.getTime())) {
          return res.status(400).json({ message: 'Invalid expense date' });
        }
        updates.expenseDate = expenseDate;
      }

      if (requestBody.taxYear !== undefined) {
        const parsedTaxYear = Number.parseInt(String(requestBody.taxYear), 10);
        if (Number.isNaN(parsedTaxYear)) {
          return res.status(400).json({ message: 'Invalid tax year' });
        }
        updates.taxYear = parsedTaxYear;
      }

      const rawBusinessPurpose = requestBody.businessPurpose;
      const trimmedBusinessPurpose =
        typeof rawBusinessPurpose === 'string' ? rawBusinessPurpose.trim() : undefined;
      const shouldApplyDefaultBusinessPurpose =
        (rawBusinessPurpose === undefined ||
          (typeof rawBusinessPurpose === 'string' && (trimmedBusinessPurpose?.length ?? 0) === 0)) &&
        rawBusinessPurpose !== null;
      const shouldApplyDefaultFromExistingCategory =
        shouldApplyDefaultBusinessPurpose &&
        requestBody.categoryId === undefined &&
        rawBusinessPurpose !== undefined;

      if (rawBusinessPurpose === null) {
        updates.businessPurpose = null;
      } else if (typeof trimmedBusinessPurpose === 'string' && trimmedBusinessPurpose.length > 0) {
        updates.businessPurpose = trimmedBusinessPurpose;
      }

      if (requestBody.categoryId !== undefined) {
        const parsedCategoryId = Number.parseInt(String(requestBody.categoryId), 10);
        if (!Number.isInteger(parsedCategoryId)) {
          return res.status(400).json({ message: 'Invalid expense category' });
        }

        const category = await storage.getExpenseCategory(parsedCategoryId);
        if (!category) {
          return res.status(400).json({ message: 'Invalid expense category' });
        }

        const categoryDefaults: ExpenseCategoryWithDefaults = category;
        updates.categoryId = parsedCategoryId;
        updates.deductionPercentage = category.deductionPercentage;

        if (shouldApplyDefaultBusinessPurpose && categoryDefaults.defaultBusinessPurpose) {
          updates.businessPurpose = categoryDefaults.defaultBusinessPurpose;
        }
      }

      if (shouldApplyDefaultFromExistingCategory) {
        const existingExpense = await storage.getExpense(expenseId, req.user.id);
        const existingCategoryId = existingExpense?.categoryId;
        if (existingCategoryId !== undefined) {
          const existingCategory = await storage.getExpenseCategory(existingCategoryId);
          if (existingCategory?.defaultBusinessPurpose) {
            updates.businessPurpose = existingCategory.defaultBusinessPurpose;
          }
        }
      }

      const expense = await storage.updateExpense(expenseId, req.user.id, updates);
      res.json(expense);
    } catch (error) {
      logger.error('Error updating expense:', error);
      res.status(500).json({ message: 'Failed to update expense' });
    }
  });

  // Delete expense
  app.delete('/api/expenses/:id', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const expenseId = parseInt(req.params.id);
      await storage.deleteExpense(expenseId, req.user.id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting expense:', error);
      res.status(500).json({ message: 'Failed to delete expense' });
    }
  });

  // Get expense totals and analytics
  app.get('/api/expenses/totals', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const taxYear = req.query.taxYear ? parseInt(req.query.taxYear as string) : undefined;
      const totals = await storage.getExpenseTotals(req.user.id, taxYear);
      res.json(totals);
    } catch (error) {
      logger.error('Error fetching expense totals:', error);
      res.status(500).json({ message: 'Failed to fetch expense totals' });
    }
  });

  // Get expenses by date range for calendar view
  app.get('/api/expenses/range', authenticateToken(true), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const expenses = await storage.getExpensesByDateRange(req.user.id, startDate, endDate);
      res.json(expenses);
    } catch (error) {
      logger.error('Error fetching expenses by date range:', error);
      res.status(500).json({ message: 'Failed to fetch expenses by date range' });
    }
  });

  // Get tax deduction guidance with optional category filtering
  app.get('/api/expenses/tax-guidance', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      
      let guidance;
      if (category && category !== 'all') {
        guidance = await storage.getTaxDeductionInfoByCategory(category);
      } else {
        guidance = await storage.getTaxDeductionInfo();
      }
      
      res.json(guidance);
    } catch (error) {
      logger.error('Error fetching tax deduction guidance:', error);
      res.status(500).json({ message: 'Failed to fetch tax deduction guidance' });
    }
  });

  // Upload receipt for an expense with ImageShield protection
  app.post('/api/expenses/:id/receipt', authenticateToken(true), upload.single('receipt'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const expenseId = parseInt(req.params.id);
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const safeOriginalName = path.basename(req.file.originalname);
      const fileExtension = path.extname(safeOriginalName).toLowerCase();
      const isPdf = req.file.mimetype === 'application/pdf' || fileExtension === '.pdf';

      let receiptBuffer: Buffer;
      let desiredFileName: string;

      if (isPdf) {
        receiptBuffer = req.file.buffer;
        desiredFileName = safeOriginalName;
        logger.info(`Storing PDF receipt for user ${req.user.id} without ImageShield processing.`);
      } else {
        const userTier = req.user.tier || 'free';
        const protectionLevel = req.body.protectionLevel || 'light';
        const addWatermark = ['free', 'starter'].includes(userTier);

        // Apply ImageShield protection to receipt
        logger.info(
          `Applying ImageShield protection (${protectionLevel}) to receipt for user ${req.user.id}, tier: ${userTier}`
        );
        receiptBuffer = await applyReceiptImageShieldProtection(
          req.file.buffer,
          protectionLevel as 'light' | 'standard' | 'heavy',
          addWatermark
        );
        desiredFileName = `protected_${safeOriginalName}`;
      }

      let receiptUrl: string;
      let receiptFileName = desiredFileName;

      if (process.env.S3_BUCKET_MEDIA) {
        const asset = await MediaManager.uploadFile(receiptBuffer, {
          userId: req.user.id,
          filename: desiredFileName,
        });
        receiptUrl = asset.downloadUrl || asset.signedUrl || asset.key;
        receiptFileName = asset.filename;
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
        await fs.mkdir(uploadDir, { recursive: true });
        const timestampedFileName = `protected_${Date.now()}-${safeOriginalName}`;
        const fileName = timestampedFileName;
        await fs.writeFile(path.join(uploadDir, fileName), receiptBuffer);
        receiptUrl = buildUploadUrl('receipts', fileName);
        receiptFileName = fileName;
      }

      const expense = await storage.updateExpense(expenseId, req.user.id, {
        receiptUrl,
        receiptFileName,
      });

      const uploadDescriptor = isPdf ? 'PDF receipt stored' : 'Protected receipt uploaded';
      logger.info(`${uploadDescriptor}: ${receiptFileName} for expense ${expenseId}`);
      res.json(expense);
    } catch (error) {
      logger.error('Error uploading receipt:', error);
      res.status(500).json({ message: 'Failed to upload receipt' });
    }
  });
}