/* eslint-env node, jest */
import { describe, test, expect, vi, beforeEach, type MockInstance, type Mock } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';

// Mock dependencies
const mockStorage = vi.hoisted(() => ({
  getExpense: vi.fn(),
  getExpenseCategory: vi.fn(),
  updateExpense: vi.fn(),
}));

const mockMediaManager = vi.hoisted(() => ({
  uploadFile: vi.fn(),
}));

const mockAuthenticateToken = vi.hoisted(() => vi.fn());

vi.mock('../../../server/storage.ts', () => ({ storage: mockStorage }));
vi.mock('../../../server/lib/media.js', () => ({ MediaManager: mockMediaManager }));
vi.mock('../../../server/middleware/auth.js', () => ({ authenticateToken: mockAuthenticateToken }));
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

// Import after mocking
import { registerExpenseRoutes } from '../../../server/expense-routes';

describe('Receipt Upload with ImageShield Protection', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to pass through with user
    mockAuthenticateToken.mockImplementation((req: express.Request & { user?: { id: number; tier: string } }, res: express.Response, next: express.NextFunction) => {
      req.user = { id: 1, tier: 'free' };
      next();
    });
    
    registerExpenseRoutes(app);
  });

  describe('ImageShield Protection Application', () => {
    test('should apply light protection for free tier users', async () => {
      const mockExpense = {
        id: 1,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      // Create a valid 1x1 PNG image buffer (smallest valid PNG)
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      const response = await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(response.body).toEqual(mockExpense);
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({
          receiptUrl: expect.stringContaining('protected_'),
          receiptFileName: expect.stringContaining('protected_'),
        })
      );
    });

    test('should apply watermark for free users', async () => {
      mockAuthenticateToken.mockImplementation((req: express.Request & { user?: { id: number; tier: string } }, res: express.Response, next: express.NextFunction) => {
        req.user = { id: 2, tier: 'free' };
        next();
      });

      const mockExpense = {
        id: 2,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      await request(app)
        .post('/api/expenses/2/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      // Verify watermark would be applied for free tier
      expect(mockStorage.updateExpense).toHaveBeenCalled();
    });

    test('should not apply watermark for pro users', async () => {
      mockAuthenticateToken.mockImplementation((req: express.Request & { user?: { id: number; tier: string } }, res: express.Response, next: express.NextFunction) => {
        req.user = { id: 3, tier: 'pro' };
        next();
      });

      const mockExpense = {
        id: 3,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      await request(app)
        .post('/api/expenses/3/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(mockStorage.updateExpense).toHaveBeenCalled();
    });
  });

  describe('File Upload Security', () => {
    test('should reject unsupported files', async () => {
      const textFileBuffer = Buffer.from('This is not an image file');

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', textFileBuffer, { filename: 'test-file.txt', contentType: 'text/plain' })
        .expect(500); // multer should reject the file

      expect(mockStorage.updateExpense).not.toHaveBeenCalled();
    });

    test('should handle missing authentication', async () => {
      mockAuthenticateToken.mockImplementation((req: express.Request & { user?: { id: number; tier: string } }, res: express.Response, next: express.NextFunction) => {
        // Set req.user to undefined (not null) to simulate no auth
        req.user = undefined;
        next();
      });

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(401);

      expect(mockStorage.updateExpense).not.toHaveBeenCalled();
    });

    test('should handle missing file upload', async () => {
      await request(app)
        .post('/api/expenses/1/receipt')
        .expect(400);

      expect(mockStorage.updateExpense).not.toHaveBeenCalled();
    });
  });

  describe('PDF receipt handling', () => {
    test('should accept PDF receipts without applying protection', async () => {
      delete process.env.S3_BUCKET_MEDIA;

      const updateCalls: Array<{ receiptUrl: string; receiptFileName: string }> = [];
      mockStorage.updateExpense.mockImplementation(async (_expenseId, _userId, update) => {
        const receiptUrl = update.receiptUrl ?? '';
        const receiptFileName = update.receiptFileName ?? '';
        updateCalls.push({ receiptUrl, receiptFileName });
        return {
          id: 4,
          receiptUrl,
          receiptFileName,
        };
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

      const response = await request(app)
        .post('/api/expenses/4/receipt')
        .attach('receipt', pdfBuffer, { filename: 'invoice.pdf', contentType: 'application/pdf' })
        .expect(200);

      expect(mockMediaManager.uploadFile).not.toHaveBeenCalled();
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(
        4,
        1,
        expect.objectContaining({
          receiptUrl: expect.stringMatching(/\/uploads\/receipts\/protected_\d+-invoice\.pdf$/u),
          receiptFileName: expect.stringMatching(/^protected_\d+-invoice\.pdf$/u),
        })
      );

      expect(response.body.receiptFileName).toMatch(/^protected_\d+-invoice\.pdf$/u);
      expect(response.body.receiptUrl).toMatch(/\/uploads\/receipts\/protected_\d+-invoice\.pdf$/u);

      const firstUpdate = updateCalls[0];
      expect(firstUpdate).toBeDefined();
      if (!firstUpdate) {
        throw new Error('Expected updateExpense to be called with receipt metadata.');
      }

      expect(firstUpdate.receiptFileName).toMatch(/^protected_\d+-invoice\.pdf$/u);
      expect(firstUpdate.receiptUrl).toMatch(/\/uploads\/receipts\/protected_\d+-invoice\.pdf$/u);

      const writeMock = fs.writeFile as unknown as Mock;
      expect(writeMock).toHaveBeenCalledWith(expect.stringMatching(/protected_\d+-invoice\.pdf$/u), expect.any(Buffer) as Buffer);
      const firstCall = writeMock.mock.calls[0];
      expect(firstCall).toBeDefined();
      const [writtenPath, storedBuffer] = firstCall;
      expect(typeof writtenPath).toBe('string');
      expect(writtenPath).toMatch(/protected_\d+-invoice\.pdf$/u);
      expect(Buffer.isBuffer(storedBuffer)).toBe(true);
      expect(storedBuffer.equals(pdfBuffer)).toBe(true);
    });

    test('should generate unique filenames for successive local PDF uploads', async () => {
      delete process.env.S3_BUCKET_MEDIA;

      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

      const storedFileNames: string[] = [];
      mockStorage.updateExpense.mockImplementation(async (_expenseId, _userId, update) => {
        const receiptFileName = update.receiptFileName ?? '';
        storedFileNames.push(receiptFileName);
        return {
          id: storedFileNames.length,
          receiptUrl: update.receiptUrl ?? '',
          receiptFileName,
        };
      });

      const nowSpy = vi.spyOn(Date, 'now');
      let callIndex = 0;
      nowSpy.mockImplementation(() => 1700000000000 + callIndex++ * 1000);

      try {
        await request(app)
          .post('/api/expenses/6/receipt')
          .attach('receipt', pdfBuffer, { filename: 'invoice.pdf', contentType: 'application/pdf' })
          .expect(200);

        await request(app)
          .post('/api/expenses/7/receipt')
          .attach('receipt', pdfBuffer, { filename: 'invoice.pdf', contentType: 'application/pdf' })
          .expect(200);
      } finally {
        nowSpy.mockRestore();
      }

      expect(storedFileNames).toHaveLength(2);
      expect(storedFileNames[0]).toMatch(/^protected_\d+-invoice\.pdf$/u);
      expect(storedFileNames[1]).toMatch(/^protected_\d+-invoice\.pdf$/u);
      expect(new Set(storedFileNames).size).toBe(2);

      const writeMock = fs.writeFile as unknown as Mock;
      expect(writeMock).toHaveBeenCalledTimes(2);
      const firstPath = writeMock.mock.calls[0]?.[0];
      const secondPath = writeMock.mock.calls[1]?.[0];
      expect(typeof firstPath).toBe('string');
      expect(typeof secondPath).toBe('string');
      expect(firstPath).toContain(storedFileNames[0]);
      expect(secondPath).toContain(storedFileNames[1]);
      expect(firstPath).not.toBe(secondPath);
    });

    test('should retain original filename when uploading to S3', async () => {
      process.env.S3_BUCKET_MEDIA = 'test-bucket';

      const mockAsset = {
        downloadUrl: 'https://s3.amazonaws.com/test-bucket/invoice.pdf',
        filename: 'invoice.pdf',
        key: 'receipts/invoice.pdf',
      };

      mockMediaManager.uploadFile.mockResolvedValue(mockAsset);
      mockStorage.updateExpense.mockResolvedValue({
        id: 5,
        receiptUrl: mockAsset.downloadUrl,
        receiptFileName: mockAsset.filename,
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

      const response = await request(app)
        .post('/api/expenses/5/receipt')
        .attach('receipt', pdfBuffer, { filename: 'invoice.pdf', contentType: 'application/pdf' })
        .expect(200);

      expect(response.body.receiptFileName).toBe('invoice.pdf');
      expect(mockMediaManager.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer) as Buffer,
        expect.objectContaining({
          userId: 1,
          filename: 'invoice.pdf',
        })
      );
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(
        5,
        1,
        expect.objectContaining({
          receiptFileName: 'invoice.pdf',
          receiptUrl: mockAsset.downloadUrl,
        })
      );

      delete process.env.S3_BUCKET_MEDIA;
    });
  });

  describe('S3 Upload Integration', () => {
    test('should use S3 when configured', async () => {
      // Mock S3 environment
      process.env.S3_BUCKET_MEDIA = 'test-bucket';
      
      const mockAsset = {
        downloadUrl: 'https://s3.amazonaws.com/test-bucket/protected_test.jpg',
        filename: 'protected_test.jpg',
        key: 'receipts/protected_test.jpg',
      };

      mockMediaManager.uploadFile.mockResolvedValue(mockAsset);
      mockStorage.updateExpense.mockResolvedValue({
        id: 1,
        receiptUrl: mockAsset.downloadUrl,
        receiptFileName: mockAsset.filename,
      });

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      const response = await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(mockMediaManager.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer) as Buffer, // Protected buffer
        expect.objectContaining({
          userId: 1,
          filename: expect.stringContaining('protected_'),
        })
      );

      expect(response.body.receiptUrl).toBe(mockAsset.downloadUrl);

      // Clean up
      delete process.env.S3_BUCKET_MEDIA;
    });

    test('should use local storage when S3 not configured', async () => {
      delete process.env.S3_BUCKET_MEDIA;

      mockStorage.updateExpense.mockResolvedValue({
        id: 1,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      });

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Business Purpose Updates', () => {
    test('should restore default business purpose when cleared without category change', async () => {
      const existingExpense = {
        id: 42,
        userId: 1,
        categoryId: 7,
      };
      const categoryWithDefault = {
        id: 7,
        name: 'Travel',
        deductionPercentage: 50,
        defaultBusinessPurpose: 'Client travel meeting',
      };
      const updatedExpense = {
        ...existingExpense,
        businessPurpose: categoryWithDefault.defaultBusinessPurpose,
      };

      mockStorage.getExpense.mockResolvedValueOnce(existingExpense);
      mockStorage.getExpenseCategory.mockResolvedValueOnce(categoryWithDefault);
      mockStorage.updateExpense.mockResolvedValueOnce(updatedExpense);

      const response = await request(app)
        .put('/api/expenses/42')
        .send({ businessPurpose: '' })
        .expect(200);

      expect(response.body.businessPurpose).toBe('Client travel meeting');
      expect(mockStorage.getExpense).toHaveBeenCalledWith(42, 1);
      expect(mockStorage.getExpenseCategory).toHaveBeenCalledWith(7);
      expect(mockStorage.updateExpense).toHaveBeenCalledWith(
        42,
        1,
        expect.objectContaining({
          businessPurpose: 'Client travel meeting',
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockStorage.updateExpense.mockRejectedValue(new Error('Database error'));

      // Create a valid 1x1 PNG image buffer
      const testImageBuffer = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c48950000000d49444154789c626001000000050001180dd4010000000049454e44ae426082',
        'hex'
      );

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(500);
    });

    test('should handle ImageShield protection errors', async () => {
      // Even if protection fails, upload should continue with original buffer
      const mockExpense = {
        id: 1,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      const testImageBuffer = Buffer.from('invalid-image-data');

      const response = await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(response.body).toEqual(mockExpense);
    });
  });
});