import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { authenticateToken } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';
import { imageProtectionLimiter as tierProtectionLimiter } from '../middleware/tiered-rate-limit.js';
import { uploadRequestSchema, type ProtectionLevel, type UploadRequest as UploadRequestBody } from '@shared/schema.js';
import { ZodError } from 'zod';
import { imageStreamingUpload, cleanupUploadedFiles } from '../middleware/streaming-upload.js';
import { embedSignature } from '../lib/steganography.js';

interface AuthRequest extends Request {
  user: { id: number; tier?: string };
  streamingFiles?: { path: string; filename?: string; length?: number }[];
  uploadProgress?: unknown;
  file?: {
    path: string;
    mimetype: string;
    originalname: string;
    filename: string;
    size: number;
  };
}

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
  addWatermark: boolean = false,
  userId?: string
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
    const userHash = crypto.createHash('sha256')
      .update(`${userId ?? 'anon'}-${Date.now()}`)
      .digest('hex')
      .slice(0, 10);
    const watermarkSvg = `
      <svg width="220" height="50">
        <text x="10" y="30" font-family="Arial" font-size="14" font-weight="bold" 
              fill="white" stroke="black" stroke-width="1" opacity="0.7">
          ${userHash}
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

// Real MIME type detection using file content analysis
async function validateImageFile(filePath: string, originalMimeType: string): Promise<{ isValid: boolean; detectedType?: string; error?: string }> {
  try {
    // Read first 4KB for file type detection (enough for headers)
    const buffer = await fs.readFile(filePath);
    const firstBytes = buffer.slice(0, 4096);
    
    // Detect actual file type from content
    const detectedFileType = await fileTypeFromBuffer(firstBytes);
    
    if (!detectedFileType) {
      return { isValid: false, error: 'Unable to determine file type from content' };
    }
    
    // Define allowed image types with their MIME types
    const allowedImageTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif'
    };
    
    // Check if detected file type is an allowed image format
    if (!allowedImageTypes[detectedFileType.ext as keyof typeof allowedImageTypes]) {
      return { 
        isValid: false, 
        detectedType: detectedFileType.mime,
        error: `File content indicates ${detectedFileType.ext} format, which is not allowed` 
      };
    }
    
    const expectedMime = allowedImageTypes[detectedFileType.ext as keyof typeof allowedImageTypes];
    
    // Compare detected type with declared type (allow some flexibility)
    if (detectedFileType.mime !== expectedMime) {
      logger.warn('MIME type mismatch detected', {
        declared: originalMimeType,
        detected: detectedFileType.mime,
        extension: detectedFileType.ext
      });
    }
    
    // Additional validation using Sharp for image integrity
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return { isValid: false, error: 'Invalid image: missing dimensions' };
      }
      
      // Check for reasonable image dimensions (prevent zip bombs)
      if (metadata.width > 20000 || metadata.height > 20000) {
        return { isValid: false, error: 'Image dimensions too large' };
      }
      
    } catch (sharpError) {
      return { isValid: false, error: 'File is not a valid image format' };
    }
    
    return { isValid: true, detectedType: detectedFileType.mime };
    
  } catch (error) {
    logger.error('File validation error', { error: error.message, filePath });
    return { isValid: false, error: 'File validation failed' };
  }
}

// Basic malware detection patterns (enhanced in production)
function performBasicMalwareCheck(buffer: Buffer): boolean {
  const malwareSignatures = [
    Buffer.from('eval('), // JavaScript injection
    Buffer.from('<?php'), // PHP injection
    Buffer.from('<script'), // Script injection
    Buffer.from('javascript:'), // JavaScript protocol
    Buffer.from('%PDF-'), // PDF files
    Buffer.from('PK\x03\x04'), // ZIP files (potential zip bombs)
    Buffer.from('\x7fELF'), // ELF executables
    Buffer.from('MZ'), // Windows executables
  ];
  
  return malwareSignatures.some(sig => buffer.includes(sig));
}

// New streaming upload endpoint with enhanced progress tracking
router.post('/stream', uploadLimiter, tierProtectionLimiter, authenticateToken, cleanupUploadedFiles, imageStreamingUpload, async (req: AuthRequest, res: Response) => {
  let processedFilePath = '';
  
  try {
    // Check if files were uploaded via streaming
    if (!req.streamingFiles || req.streamingFiles.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFile = req.streamingFiles[0];
    const tempFilePath = uploadedFile.path;

    if (!tempFilePath) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    // Real MIME type validation using file content analysis
    const fileValidation = await validateImageFile(tempFilePath, uploadedFile.mimetype);
    if (!fileValidation.isValid) {
      await fs.unlink(tempFilePath);
      logger.warn('Streaming file validation failed', {
        userId: req.user.id,
        originalName: uploadedFile.originalname,
        declaredMime: uploadedFile.mimetype,
        detectedType: fileValidation.detectedType,
        error: fileValidation.error
      });
      return res.status(400).json({ 
        message: 'File validation failed',
        error: fileValidation.error 
      });
    }
    
    // Basic malware check
    const fileBuffer = await fs.readFile(tempFilePath);
    if (performBasicMalwareCheck(fileBuffer)) {
      await fs.unlink(tempFilePath);
      logger.warn('Malware detected in streaming upload', {
        userId: req.user.id,
        originalName: uploadedFile.originalname,
        detectedType: fileValidation.detectedType
      });
      return res.status(400).json({ message: 'File failed security check' });
    }
    
    logger.info('Streaming file validation successful', {
      userId: req.user.id,
      originalName: uploadedFile.originalname,
      declaredMime: uploadedFile.mimetype,
      detectedType: fileValidation.detectedType,
      uploadSize: uploadedFile.size
    });
    
    // Validate request body with Zod schema
    let validatedRequest: UploadRequestBody;
    try {
      validatedRequest = uploadRequestSchema.parse(req.body);
    } catch (error) {
      await fs.unlink(tempFilePath);
      if (error instanceof ZodError) {
        logger.warn('Streaming upload validation failed', {
          userId: req.user.id,
          errors: error.errors
        });
        return res.status(400).json({ 
          message: 'Invalid request parameters',
          errors: error.errors 
        });
      }
      throw error;
    }

    // Generate secure output filename
    const outputFilename = `protected-${crypto.randomBytes(16).toString('hex')}.jpg`;
    processedFilePath = path.join(process.cwd(), 'uploads', outputFilename);
    
    // Apply ImageShield protection with retry and timeout
    const protect = () => applyImageShieldProtection(
      tempFilePath,
      processedFilePath!,
      validatedRequest.protectionLevel,
      validatedRequest.watermark,
      req.user?.id
    );
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await Promise.race([
          protect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ImageShield timeout')), 30_000)
          )
        ]);
        break;
      } catch (err) {
        lastError = err;
        if (attempt === 2) throw err;
        await new Promise(res => setTimeout(res, 1_000 * Math.pow(2, attempt)));
      }
    }
    
    // Clean up original uploaded file
    await fs.unlink(tempFilePath);
    
    logger.info('ImageShield protection applied successfully (streaming)', {
      userId: req.user.id,
      originalName: uploadedFile.originalname,
      protectionLevel: validatedRequest.protectionLevel,
      watermark: validatedRequest.watermark,
      outputFile: outputFilename
    });
    
    // Return success response with file info
    res.json({
      message: 'Image uploaded and protected successfully',
      filename: outputFilename,
      protectionLevel: validatedRequest.protectionLevel,
      watermark: validatedRequest.watermark,
      originalSize: uploadedFile.size,
      uploadProgress: req.uploadProgress
    });
    
  } catch (error) {
    logger.error('Streaming upload processing error', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Clean up files on error
    try {
      if (req.streamingFiles?.[0]?.path) {
        await fs.unlink(req.streamingFiles[0].path).catch(() => {});
      }
      if (processedFilePath) {
        await fs.unlink(processedFilePath).catch(() => {});
      }
    } catch (cleanupError) {
      logger.warn('File cleanup failed', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }
    
    res.status(500).json({ message: 'Upload processing failed' });
  }
});

// Traditional upload endpoint with authentication, rate limiting, and ImageShield protection
router.post('/image', uploadLimiter, tierProtectionLimiter, authenticateToken, upload.single('image'), async (req: AuthRequest, res: Response) => {
  let tempFilePath = '';
  let protectedFilePath = '';
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    
    if (!tempFilePath) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    // Real MIME type validation using file content analysis
    const fileValidation = await validateImageFile(tempFilePath, req.file.mimetype);
    if (!fileValidation.isValid) {
      await fs.unlink(tempFilePath);
      logger.warn('File validation failed', {
        userId: req.user.id,
        originalName: req.file.originalname,
        declaredMime: req.file.mimetype,
        detectedType: fileValidation.detectedType,
        error: fileValidation.error
      });
      return res.status(400).json({ 
        message: 'File validation failed',
        error: fileValidation.error 
      });
    }
    
    // Basic malware check
    const fileBuffer = await fs.readFile(tempFilePath);
    if (performBasicMalwareCheck(fileBuffer)) {
      await fs.unlink(tempFilePath);
      logger.warn('Malware detected in upload', {
        userId: req.user.id,
        originalName: req.file.originalname,
        detectedType: fileValidation.detectedType
      });
      return res.status(400).json({ message: 'File failed security check' });
    }
    
    logger.info('File validation successful', {
      userId: req.user.id,
      originalName: req.file.originalname,
      declaredMime: req.file.mimetype,
      detectedType: fileValidation.detectedType
    });
    
    // Validate request body with Zod schema
    let validatedRequest: UploadRequestBody;
    try {
      validatedRequest = uploadRequestSchema.parse(req.body);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Upload request validation failed', { 
          userId: req.user.id, 
          errors: error.errors,
          body: req.body 
        });
        return res.status(400).json({ 
          message: 'Invalid request parameters',
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      throw error;
    }
    
    // Determine protection level and watermark based on user tier and validated input
    const userTier = req.user.tier || 'free';
    const protectionLevel = validatedRequest.protectionLevel;
    const addWatermark = validatedRequest.addWatermark !== undefined 
      ? validatedRequest.addWatermark 
      : ['free', 'starter'].includes(userTier);
    
    logger.info('Upload request validated', {
      userId: req.user.id,
      userTier,
      protectionLevel,
      addWatermark,
      useCustom: validatedRequest.useCustom
    });
    
    // Apply ImageShield protection
    const protectedFileName = `protected_${req.file.filename}`;
    protectedFilePath = path.join(path.dirname(tempFilePath), protectedFileName);
    
    await applyImageShieldProtection(
      tempFilePath,
      protectedFilePath,
      protectionLevel as 'light' | 'standard' | 'heavy',
      addWatermark,
      req.user.id
    );
    
    const signature = crypto.randomUUID();
    const protectedBuffer = embedSignature(
      await fs.readFile(protectedFilePath),
      signature
    );
    await fs.writeFile(protectedFilePath, protectedBuffer);
    
    // Clean up original file
    await fs.unlink(tempFilePath);
    tempFilePath = '';
    
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
      watermarked: addWatermark,
      signature,
      settings: validatedRequest.useCustom ? validatedRequest.customSettings : undefined
    });
  } catch (error) {
    logger.error('Upload error:', { error: error instanceof Error ? error.message : String(error) });
    
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

export { router as uploadRoutes, applyImageShieldProtection, protectionPresets };