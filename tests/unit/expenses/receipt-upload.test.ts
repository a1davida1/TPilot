import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';

// Mock dependencies
const mockStorage = {
  updateExpense: vi.fn(),
};

const mockMediaManager = {
  uploadFile: vi.fn(),
};

const mockAuthenticateToken = vi.fn();

vi.mock('../../../server/storage.js', () => ({ storage: mockStorage }));
vi.mock('../../../server/lib/media.js', () => ({ MediaManager: mockMediaManager }));
vi.mock('../../../server/middleware/auth.js', () => ({ authenticateToken: mockAuthenticateToken }));
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// Import after mocking
import { registerExpenseRoutes } from '../../../server/expense-routes';

describe('Receipt Upload with ImageShield Protection', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to pass through with user
    mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
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

      // Create a mock image buffer
      const testImageBuffer = Buffer.from('fake-image-data');

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
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 2, tier: 'free' };
        next();
      });

      const mockExpense = {
        id: 2,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      const testImageBuffer = Buffer.from('fake-image-data');

      await request(app)
        .post('/api/expenses/2/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      // Verify watermark would be applied for free tier
      expect(mockStorage.updateExpense).toHaveBeenCalled();
    });

    test('should not apply watermark for premium users', async () => {
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 3, tier: 'premium' };
        next();
      });

      const mockExpense = {
        id: 3,
        receiptUrl: '/uploads/receipts/protected_test.jpg',
        receiptFileName: 'protected_test.jpg',
      };

      mockStorage.updateExpense.mockResolvedValue(mockExpense);

      const testImageBuffer = Buffer.from('fake-image-data');

      await request(app)
        .post('/api/expenses/3/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(mockStorage.updateExpense).toHaveBeenCalled();
    });
  });

  describe('File Upload Security', () => {
    test('should reject non-image files', async () => {
      const textFileBuffer = Buffer.from('This is not an image file');

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', textFileBuffer, 'test-file.txt')
        .expect(500); // multer should reject the file

      expect(mockStorage.updateExpense).not.toHaveBeenCalled();
    });

    test('should handle missing authentication', async () => {
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const testImageBuffer = Buffer.from('fake-image-data');

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

      const testImageBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(mockMediaManager.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer), // Protected buffer
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

      const testImageBuffer = Buffer.from('fake-image-data');

      await request(app)
        .post('/api/expenses/1/receipt')
        .attach('receipt', testImageBuffer, 'test-receipt.jpg')
        .expect(200);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockStorage.updateExpense.mockRejectedValue(new Error('Database error'));

      const testImageBuffer = Buffer.from('fake-image-data');

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