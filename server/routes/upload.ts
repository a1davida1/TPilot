import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { realpathSync } from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { uploadLimiter, logger } from '../middleware/security.js';
import { imageProtectionLimiter as tierProtectionLimiter } from '../middleware/tiered-rate-limit.js';
import { uploadRequestSchema, type UploadRequest as UploadRequestBody } from '@shared/schema';
import { ZodError } from 'zod';
import { imageStreamingUpload, cleanupUploadedFiles, type UploadedFile, type UploadProgress } from '../middleware/streaming-upload.js';
import { embedSignature } from '../lib/steganography.js';
import { buildUploadUrl } from '../lib/uploads.js';

import { applyImageShieldToFile, protectionPresets } from '../images/imageShield.js';
// Extended AuthRequest with upload-specific properties
interface UploadAuthRequest extends AuthRequest {
  file?: Express.Multer.File;
  streamingFiles?: UploadedFile[];
  uploadProgress?: UploadProgress;
}

const router = express.Router();

// Security helper: Check if a path is within the uploads directory
function isPathWithin(filePath: string): boolean {
  try {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const resolvedUploadDir = realpathSync(uploadDir);
    const resolvedFilePath = realpathSync(filePath);
    return resolvedFilePath.startsWith(resolvedUploadDir);
  } catch {
    // If path doesn't exist or can't be resolved, treat as unsafe
    return false;
  }
}

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

// Server-side ImageShield protection pipeline
async function applyImageShieldProtection(
  inputPath: string,
  outputPath: string,
  protectionLevel: 'light' | 'standard' | 'heavy' = 'standard',
  addWatermark: boolean = false,
  userId?: string,
): Promise<void> {
  const preset = protectionPresets[protectionLevel] ?? protectionPresets.standard;
  await applyImageShieldToFile({
    sourcePath: inputPath,
    destinationPath: outputPath,
    preset,
    addWatermark,
    watermarkSeed: userId ?? 'anon',
    cleanupSource: true,
  });
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
      
    } catch (_sharpError) {
      return { isValid: false, error: 'File is not a valid image format' };
    }
    
    return { isValid: true, detectedType: detectedFileType.mime };
    
  } catch (error) {
    logger.error('File validation error', { error: (error as Error).message, filePath });
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
router.post('/stream', uploadLimiter, tierProtectionLimiter, authenticateToken(true), cleanupUploadedFiles, imageStreamingUpload, async (req: Request, res: Response) => {
  const authReq = req as UploadAuthRequest;
  let processedFilePath: string | undefined;
  const rawUserId = authReq.user?.id;
  const userId = typeof rawUserId === 'number' ? rawUserId : null;

  try {
    // Check if files were uploaded via streaming
    if (!authReq.streamingFiles || authReq.streamingFiles.length === 0) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFile = authReq.streamingFiles[0];
    const tempFilePath = uploadedFile.path;

    if (userId === null) {
      await fs.unlink(uploadedFile.path).catch(() => {});
      return res.status(401).json({ message: 'Authentication required for uploads' });
    }

    if (!tempFilePath) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    // Real MIME type validation using file content analysis
    const fileValidation = await validateImageFile(tempFilePath, uploadedFile.mimetype || 'application/octet-stream');
    if (!fileValidation.isValid) {
      await fs.unlink(tempFilePath);
      logger.warn('Streaming file validation failed', {
        userId,
        originalName: uploadedFile.originalname || 'unknown',
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
        userId,
        originalName: uploadedFile.originalname || 'unknown',
        detectedType: fileValidation.detectedType
      });
      return res.status(400).json({ message: 'File failed security check' });
    }
    
    logger.info('Streaming file validation successful', {
      userId,
      originalName: uploadedFile.originalname || 'unknown',
      declaredMime: uploadedFile.mimetype,
      detectedType: fileValidation.detectedType,
      uploadSize: uploadedFile.size
    });
    
    // Validate request body with Zod schema
    let validatedRequest: UploadRequestBody;
    try {
      validatedRequest = uploadRequestSchema.parse(authReq.body);
    } catch (error) {
      await fs.unlink(tempFilePath);
      if (error instanceof ZodError) {
        logger.warn('Streaming upload validation failed', {
          userId,
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
    let outputFilename: string | null = null;
    try {
      outputFilename = `protected-${crypto.randomBytes(16).toString('hex')}.jpg`;
      processedFilePath = path.join(process.cwd(), 'uploads', outputFilename);
    } catch (filenameError) {
      logger.error('Failed to generate secure filename for streaming upload', {
        userId,
        error: filenameError instanceof Error ? filenameError.message : String(filenameError)
      });
    }

    if (!outputFilename) {
      await fs.unlink(tempFilePath).catch(() => {});
      logger.error('Filename generation failed: no output filename created', {
        userId,
        hasFilename: false,
        hasPath: Boolean(processedFilePath)
      });
      return res.status(500).json({ message: 'Upload processing failed' });
    }

    if (!processedFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
      logger.error('Filename generation failed: no processed file path created', {
        userId,
        hasFilename: true,
        hasPath: false
      });
      return res.status(500).json({ message: 'Upload processing failed' });
    }

    // Apply ImageShield protection with retry and timeout
    const targetFilePath = processedFilePath;
    const protect = () => applyImageShieldProtection(
      tempFilePath,
      targetFilePath,
      validatedRequest.protectionLevel,
      validatedRequest.addWatermark,
      String(userId)
    );
    let _lastError: unknown;
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
        _lastError = err;
        if (attempt === 2) throw err;
        await new Promise(res => setTimeout(res, 1_000 * Math.pow(2, attempt)));
      }
    }
    
    // Clean up original uploaded file
    await fs.unlink(tempFilePath);
    
    logger.info('ImageShield protection applied successfully (streaming)', {
      userId,
      originalName: uploadedFile.originalname || 'unknown',
      protectionLevel: validatedRequest.protectionLevel,
      watermark: validatedRequest.addWatermark,
      outputFile: outputFilename
    });
    
    // Return success response with file info
    res.json({
      message: 'Image uploaded and protected successfully',
      filename: outputFilename,
      protectionLevel: validatedRequest.protectionLevel,
      watermark: validatedRequest.addWatermark,
      originalSize: uploadedFile.size || 0,
      uploadProgress: authReq.uploadProgress
    });
    
  } catch (error) {
    logger.error('Streaming upload processing error', {
      userId,
      error: error instanceof Error ? (error as Error).message : String(error),
      stack: error instanceof Error ? (error as Error).stack : undefined
    });
    
    // Clean up files on error
    try {
      if (authReq.streamingFiles?.[0]?.path) {
        await fs.unlink(authReq.streamingFiles[0].path).catch(() => {});
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
router.post('/image', uploadLimiter, tierProtectionLimiter, authenticateToken(true), upload.single('image'), async (req: Request, res: Response) => {
  const authReq = req as UploadAuthRequest;
  let tempFilePath = '';
  let protectedFilePath = '';
  const rawUserId = authReq.user?.id;
  const userId = typeof rawUserId === 'number' ? rawUserId : null;

  try {
    if (!authReq.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = authReq.file.path;

    if (userId === null) {
      if (isPathWithin(tempFilePath)) {
        await fs.unlink(tempFilePath).catch(() => {});
      } else {
        logger.warn('Attempted to unlink file outside upload directory.', { tempFilePath, userId });
      }
      return res.status(401).json({ message: 'Authentication required for uploads' });
    }
    
    if (!tempFilePath) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    // Real MIME type validation using file content analysis
    const fileValidation = await validateImageFile(tempFilePath, authReq.file.mimetype);
    if (!fileValidation.isValid) {
      if (isPathWithin(tempFilePath)) {
        await fs.unlink(tempFilePath);
      } else {
        logger.warn('Attempted to unlink file outside upload directory.', { tempFilePath, userId });
      }
      logger.warn('File validation failed', {
        userId,
        originalName: authReq.file.originalname,
        declaredMime: authReq.file.mimetype,
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
        userId,
        originalName: authReq.file.originalname,
        detectedType: fileValidation.detectedType
      });
      return res.status(400).json({ message: 'File failed security check' });
    }
    
    logger.info('File validation successful', {
      userId,
      originalName: authReq.file.originalname,
      declaredMime: authReq.file.mimetype,
      detectedType: fileValidation.detectedType
    });
    
    // Validate request body with Zod schema
    let validatedRequest: UploadRequestBody;
    try {
      validatedRequest = uploadRequestSchema.parse(authReq.body);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Upload request validation failed', { 
          userId, 
          errors: error.errors,
          body: authReq.body 
        });
        return res.status(400).json({ 
          message: 'Invalid request parameters',
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      throw error;
    }
    
    // Determine protection level and watermark based on user tier and validated input
    const userTier = authReq.user?.tier || 'free';
    const protectionLevel = validatedRequest.protectionLevel;
    const addWatermark = validatedRequest.addWatermark !== undefined 
      ? validatedRequest.addWatermark 
      : ['free', 'starter'].includes(userTier);
    
    logger.info('Upload request validated', {
      userId,
      userTier,
      protectionLevel,
      addWatermark,
      useCustom: validatedRequest.useCustom
    });
    
    // Apply ImageShield protection
    const protectedFileName = `protected_${authReq.file.filename}`;
    protectedFilePath = path.join(path.dirname(tempFilePath), protectedFileName);
    
    await applyImageShieldProtection(
      tempFilePath,
      protectedFilePath,
      protectionLevel as 'light' | 'standard' | 'heavy',
      addWatermark,
      userId.toString()
    );
    
    const signature = crypto.randomUUID();
    const protectedBuffer = embedSignature(
      await fs.readFile(protectedFilePath),
      signature
    );
    await fs.writeFile(protectedFilePath, protectedBuffer);
    
    // Clean up original file
    tempFilePath = '';
    
    const fileUrl = buildUploadUrl(protectedFileName);
    const protectedStats = await fs.stat(protectedFilePath);
    
    logger.info(`Protected file uploaded: ${protectedFileName} by user ${userId}, tier: ${userTier}`);
    
    res.json({
      message: 'File uploaded and protected successfully',
      filename: protectedFileName,
      url: fileUrl,
      size: protectedStats.size,
      originalSize: authReq.file.size,
      protectionLevel,
      watermarked: addWatermark,
      signature,
      settings: validatedRequest.useCustom ? validatedRequest.customSettings : undefined
    });
  } catch (error) {
    logger.error('Upload error:', { error: error instanceof Error ? (error as Error).message : String(error) });
    
    // Clean up any temp files
    if (tempFilePath) {
      if (isPathWithin(tempFilePath)) {
        try { await fs.unlink(tempFilePath); } catch (_e) { /* ignore cleanup errors */ }
      } else {
        logger.warn('Attempted to unlink file outside upload directory during error cleanup.', { tempFilePath });
      }
    }
    if (protectedFilePath) {
      try { await fs.unlink(protectedFilePath); } catch (_e) { /* ignore cleanup errors */ }
    }
    
    res.status(500).json({ message: 'Error processing file upload' });
  }
});

export { router as uploadRoutes, applyImageShieldProtection, protectionPresets };