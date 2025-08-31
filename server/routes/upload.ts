import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';

const router = express.Router();

// Configure secure multer for file uploads
const secureStorage = multer.diskStorage({
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
    // More secure filename generation
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: secureStorage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit (better for high-quality content creator photos)
    files: 1, // Only 1 file at a time
    fields: 20 // Limit fields
  },
  fileFilter: (req, file, cb) => {
    // Stricter file type checking
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF image files are allowed!'));
    }
  }
});

// Upload endpoint with authentication and rate limiting
router.post('/image', uploadLimiter, authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    logger.info(`File uploaded: ${req.file.filename} by user ${req.user.id}`);
    
    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      url: fileUrl,
      size: req.file.size
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

export { router as uploadRoutes };