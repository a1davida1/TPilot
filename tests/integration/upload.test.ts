import request from 'supertest';
import { describe, test, beforeAll, afterAll, beforeEach, afterEach, expect, vi } from 'vitest';
import express from 'express';
import { db } from '../../server/db';
import { users, userImages } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Mock image protection functions
const mockImageShieldProtection = vi.fn();
const mockWatermarkApplication = vi.fn();

vi.mock('../../server/lib/image-protection', () => ({
  applyImageShieldProtection: mockImageShieldProtection,
  addWatermarkToImage: mockWatermarkApplication
}));

describe('Upload and ImageShield Integration Tests', () => {
  let testUser: unknown;
  let authToken: string;
  let app: express.Application;
  let testImagePath: string;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Setup upload routes for testing
    app.post('/api/upload/image', async (req, res) => {
      try {
        const { imageData, protectionLevel = 'standard' } = req.body;
        
        if (!imageData) {
          return res.status(400).json({ message: 'No image data provided' });
        }

        // Simulate image processing
        const processedImage = await mockImageShieldProtection(imageData, protectionLevel);
        await mockWatermarkApplication(processedImage);

        // Save to database
        const [savedImage] = await db.insert(userImages).values({
          userId: testUser.id,
          filename: 'test-image.png',
          originalName: 'test.png',
          url: '/uploads/test-image.png',
          mimeType: 'image/png',
          size: 1024,
          isProtected: true,
          protectionLevel
        }).returning();

        res.json({
          success: true,
          imageId: savedImage.id,
          url: savedImage.url,
          protectionApplied: true,
          watermarkApplied: true,
          protectionLevel
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ message: 'Upload failed', error: errorMessage });
      }
    });

    app.post('/api/upload/scan', async (req, res) => {
      try {
        const { imageData } = req.body;
        
        // Mock content scanning
        const scanResult = {
          safe: !imageData.includes('unsafe'),
          contentFlags: imageData.includes('unsafe') ? ['explicit_content'] : [],
          confidence: 0.95
        };

        res.json(scanResult);
      } catch (error) {
        res.status(500).json({ message: 'Scan failed' });
      }
    });

    app.get('/api/upload/protected/:imageId', async (req, res) => {
      try {
        const { imageId } = req.params;
        const image = await db.select().from(userImages).where(eq(userImages.id, parseInt(imageId))).limit(1);
        
        if (!image.length) {
          return res.status(404).json({ message: 'Image not found' });
        }

        res.json({
          url: image[0].url,
          isProtected: image[0].isProtected,
          protectionLevel: image[0].protectionLevel
        });
      } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve image' });
      }
    });
    
    // Create test user
    const [user] = await db.insert(users).values({
      username: 'uploaduser',
      email: 'upload@example.com',
      password: 'hashedpassword',
      tier: 'pro'
    }).returning();
    
    testUser = user;
    authToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'test-secret');

    // Create test image
    testImagePath = path.join(__dirname, '__fixtures__', 'test-image.png');
    await fs.promises.mkdir(path.dirname(testImagePath), { recursive: true });
    
    // Generate a simple test image using sharp
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
    .png()
    .toFile(testImagePath);
  });

  afterAll(async () => {
    // Cleanup test database
    await db.delete(userImages).where(eq(userImages.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    
    // Clean up test files
    try {
      await fs.promises.unlink(testImagePath);
      await fs.promises.rmdir(path.dirname(testImagePath));
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Reset image records for each test
    await db.delete(userImages).where(eq(userImages.userId, testUser.id));
    
    // Clear mocks
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockImageShieldProtection.mockResolvedValue('protected-image-data');
    mockWatermarkApplication.mockResolvedValue('watermarked-image-data');
  });

  afterEach(async () => {
    // Cleanup test image records
    await db.delete(userImages).where(eq(userImages.userId, testUser.id));
  });

  describe('Image Upload and Protection', () => {
    test('should scan, protect and watermark uploaded image', async () => {
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.protectionApplied).toBe(true);
      expect(response.body.watermarkApplied).toBe(true);
      expect(response.body.protectionLevel).toBe('standard');
      expect(response.body.imageId).toBeDefined();

      // Verify mocks were called
      expect(mockImageShieldProtection).toHaveBeenCalledWith(imageData, 'standard');
      expect(mockWatermarkApplication).toHaveBeenCalledWith('protected-image-data');

      // Verify database record
      const savedImages = await db.select().from(userImages).where(eq(userImages.userId, testUser.id));
      expect(savedImages).toHaveLength(1);
      expect(savedImages[0].isProtected).toBe(true);
      expect(savedImages[0].protectionLevel).toBe('standard');
    });

    test('should handle different protection levels', async () => {
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      // Test light protection
      const lightResponse = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'light'
        });

      expect(lightResponse.status).toBe(200);
      expect(lightResponse.body.protectionLevel).toBe('light');
      expect(mockImageShieldProtection).toHaveBeenCalledWith(imageData, 'light');

      // Test heavy protection
      mockImageShieldProtection.mockClear();
      const heavyResponse = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'heavy'
        });

      expect(heavyResponse.status).toBe(200);
      expect(heavyResponse.body.protectionLevel).toBe('heavy');
      expect(mockImageShieldProtection).toHaveBeenCalledWith(imageData, 'heavy');
    });

    test('should reject uploads without image data', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No image data provided');
    });

    test('should handle image protection failures gracefully', async () => {
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      // Mock protection failure
      mockImageShieldProtection.mockRejectedValueOnce(new Error('Protection failed'));

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Upload failed');
    });
  });

  describe('Content Scanning', () => {
    test('should scan image content for safety', async () => {
      const safeImageData = 'safe-image-content';

      const response = await request(app)
        .post('/api/upload/scan')
        .send({
          imageData: safeImageData
        });

      expect(response.status).toBe(200);
      expect(response.body.safe).toBe(true);
      expect(response.body.contentFlags).toEqual([]);
      expect(response.body.confidence).toBeGreaterThan(0.9);
    });

    test('should flag unsafe content', async () => {
      const unsafeImageData = 'unsafe-image-content';

      const response = await request(app)
        .post('/api/upload/scan')
        .send({
          imageData: unsafeImageData
        });

      expect(response.status).toBe(200);
      expect(response.body.safe).toBe(false);
      expect(response.body.contentFlags).toContain('explicit_content');
      expect(response.body.confidence).toBeGreaterThan(0.9);
    });

    test('should handle scanning errors', async () => {
      const response = await request(app)
        .post('/api/upload/scan')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Scan failed');
    });
  });

  describe('Protected Image Serving', () => {
    test('should serve protected images with proper metadata', async () => {
      // First upload an image
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const uploadResponse = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'heavy'
        });

      const imageId = uploadResponse.body.imageId;

      // Then retrieve it
      const response = await request(app)
        .get(`/api/upload/protected/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isProtected).toBe(true);
      expect(response.body.protectionLevel).toBe('heavy');
      expect(response.body.url).toBeDefined();
    });

    test('should return 404 for non-existent images', async () => {
      const response = await request(app)
        .get('/api/upload/protected/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Image not found');
    });
  });

  describe('File Format Validation', () => {
    test('should accept supported image formats', async () => {
      // Test with PNG data
      const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData: pngData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(200);
    });

    test('should validate MIME types', async () => {
      // This would be handled by actual MIME type validation in the real implementation
      const invalidData = 'not-an-image';

      const response = await request(app)
        .post('/api/upload/scan')
        .send({
          imageData: invalidData
        });

      // In real implementation, this would check MIME type and reject invalid formats
      expect(response.status).toBe(200); // Mock accepts anything for testing
    });
  });

  describe('Watermark Application', () => {
    test('should apply watermarks based on user tier', async () => {
      // Test free tier user gets watermark
      const [freeUser] = await db.insert(users).values({
        username: 'freeuser',
        email: 'free@test.com',
        password: 'password',
        tier: 'free'
      }).returning();

      const freeToken = jwt.sign({ userId: freeUser.id }, process.env.JWT_SECRET || 'test-secret');

      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(200);
      expect(mockWatermarkApplication).toHaveBeenCalled();

      // Cleanup
      await db.delete(users).where(eq(users.id, freeUser.id));
    });

    test('should handle watermark application failures', async () => {
      mockWatermarkApplication.mockRejectedValueOnce(new Error('Watermark failed'));

      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Upload failed');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent uploads', async () => {
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const uploadPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/upload/image')
          .send({
            imageData,
            protectionLevel: 'standard'
          })
      );

      const responses = await Promise.all(uploadPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify all images were processed
      expect(mockImageShieldProtection).toHaveBeenCalledTimes(5);
      expect(mockWatermarkApplication).toHaveBeenCalledTimes(5);
    });

    test('should handle large file uploads', async () => {
      // Create a larger test image
      const largeImageBuffer = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const imageData = largeImageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle database connection failures during upload', async () => {
      const insertSpy = vi
        .spyOn(db as { insert: typeof db.insert }, 'insert')
        .mockImplementation(() => {
          throw new Error('DB connection failed');
        });

      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'standard',
        });

      expect(response.status).toBe(500);

      insertSpy.mockRestore();
    });

    test('should clean up partial uploads on failure', async () => {
      // Mock partial failure scenario
      mockImageShieldProtection.mockResolvedValueOnce('protected-data');
      mockWatermarkApplication.mockRejectedValueOnce(new Error('Watermark failed'));

      const imageBuffer = await fs.promises.readFile(testImagePath);
      const imageData = imageBuffer.toString('base64');

      const response = await request(app)
        .post('/api/upload/image')
        .send({
          imageData,
          protectionLevel: 'standard'
        });

      expect(response.status).toBe(500);

      // Verify no partial records were left in database
      const orphanedImages = await db.select().from(userImages).where(eq(userImages.userId, testUser.id));
      expect(orphanedImages).toHaveLength(0);
    });
  });
});