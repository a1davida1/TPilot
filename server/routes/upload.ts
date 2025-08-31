import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';
import { imageProtectionLimiter as tierProtectionLimiter } from '../middleware/tiered-rate-limit.js';

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

// Server-side ImageShield protection levels
interface ProtectionSettings {
  level: 'light' | 'standard' | 'heavy';
  blur: number;
  noise: number;
  resize: number;
  quality: number;
}

const protectionPresets: Record<string, ProtectionSettings> = {
  light: { level: 'light', blur: 0.5, noise: 5, resize: 95, quality: 92 },
  standard: { level: 'standard', blur: 1.0, noise: 10, resize: 90, quality: 88 },
  heavy: { level: 'heavy', blur: 1.5, noise: 15, resize: 85, quality: 85 }
};

// Apply ImageShield protection server-side
async function applyImageShieldProtection(
  inputPath: string, 
  outputPath: string, 
  protectionLevel: 'light' | 'standard' | 'heavy' = 'standard',
  addWatermark: boolean = false
): Promise<void> {
  const settings = protectionPresets[protectionLevel];
  
  const metadata = await sharp(inputPath).metadata();
  const resizeWidth = Math.round((metadata.width || 1920) * settings.resize / 100);
  const resizeHeight = Math.round((metadata.height || 1080) * settings.resize / 100);
  
  let pipeline = sharp(inputPath)
    .blur(settings.blur)
    .resize(resizeWidth, resizeHeight)
    .jpeg({ quality: settings.quality });
  
  // Add noise by modifying image metadata and slight color variations
  if (settings.noise > 0) {
    pipeline = pipeline.modulate({
      brightness: 1 + (Math.random() - 0.5) * (settings.noise / 100),
      saturation: 1 + (Math.random() - 0.5) * (settings.noise / 200)
    });
  }
  
  // Add watermark for free users
  if (addWatermark) {
    const watermarkSvg = `
      <svg width="200" height="50">
        <text x="10" y="30" font-family="Arial" font-size="14" font-weight="bold" 
              fill="white" stroke="black" stroke-width="1" opacity="0.7">
          Protected by ThottoPilot™
        </text>
      </svg>
    `;
    
    pipeline = pipeline.composite([
      {
        input: Buffer.from(watermarkSvg),
        gravity: 'southeast'
      }
    ]);
  }
  
  await pipeline.toFile(outputPath);
}

// Basic malware detection patterns (enhanced in production)
function performBasicMalwareCheck(buffer: Buffer): boolean {
  const malwareSignatures = [
    Buffer.from('eval('), // JavaScript injection
    Buffer.from('<?php'), // PHP injection
    Buffer.from('<script'), // Script injection
    Buffer.from('javascript:') // JavaScript protocol
  ];
  
  return malwareSignatures.some(sig => buffer.includes(sig));
}

// Upload endpoint with authentication, rate limiting, and ImageShield protection
router.post('/image', uploadLimiter, tierProtectionLimiter, authenticateToken, upload.single('image'), async (req: any, res) => {
  let tempFilePath: string | null = null;
  let protectedFilePath: string | null = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    
    // Basic malware check
    const fileBuffer = await fs.readFile(tempFilePath);
    if (performBasicMalwareCheck(fileBuffer)) {
      await fs.unlink(tempFilePath);
      logger.warn(`Malware detected in upload from user ${req.user.id}`);
      return res.status(400).json({ message: 'File failed security check' });
    }
    
    // Determine protection level and watermark based on user tier
    const userTier = req.user.tier || 'free';
    const protectionLevel = req.body.protectionLevel || 'standard';
    const addWatermark = ['free', 'starter'].includes(userTier);
    
    // Apply ImageShield protection
    const protectedFileName = `protected_${req.file.filename}`;
    protectedFilePath = path.join(path.dirname(tempFilePath), protectedFileName);
    
    await applyImageShieldProtection(
      tempFilePath,
      protectedFilePath,
      protectionLevel as 'light' | 'standard' | 'heavy',
      addWatermark
    );
    
    // Clean up original file
    await fs.unlink(tempFilePath);
    tempFilePath = null;
    
    const fileUrl = `/uploads/${protectedFileName}`;
    const protectedStats = await fs.stat(protectedFilePath);
    
    logger.info(`Protected file uploaded: ${protectedFileName} by user ${req.user.id}, tier: ${userTier}`);
    
    res.json({
      message: 'File uploaded and protected successfully',
      filename: protectedFileName,
      url: fileUrl,
      size: protectedStats.size,
      originalSize: req.file.size,
      protectionLevel,
      watermarked: addWatermark
    });
  } catch (error) {
    logger.error('Upload error:', error);
    
    // Clean up any temp files
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) { /* ignore cleanup errors */ }
    }
    if (protectedFilePath) {
      try { await fs.unlink(protectedFilePath); } catch (e) { /* ignore cleanup errors */ }
    }
    
    res.status(500).json({ message: 'Error processing file upload' });
  }
});

export { router as uploadRoutes };