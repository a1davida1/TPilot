import { Request, Response, NextFunction } from 'express';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../bootstrap/logger.js';

export interface StreamingUploadOptions {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  uploadDir?: string;
  maxFiles?: number;
  fieldNameSize?: number;
  fieldSize?: number;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  filename: string;
  path: string;
  size: number;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  filename: string;
}

declare global {
  namespace Express {
    interface Request {
      streamingFiles?: UploadedFile[];
      uploadProgress?: UploadProgress;
    }
  }
}

const DEFAULT_OPTIONS: Required<StreamingUploadOptions> = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  uploadDir: path.join(process.cwd(), 'uploads'),
  maxFiles: 1,
  fieldNameSize: 100,
  fieldSize: 1 * 1024 * 1024 // 1MB for text fields
};

export function createStreamingUpload(options: StreamingUploadOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only process multipart/form-data
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      return next();
    }

    try {
      // Ensure upload directory exists
      await fs.promises.mkdir(config.uploadDir, { recursive: true });

      const uploadedFiles: UploadedFile[] = [];
      interface UploadFields {
        [key: string]: string | string[];
      }
      const fields: UploadFields = {};
      let uploadCount = 0;
      let totalUploadSize = 0;

      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: config.maxFileSize,
          files: config.maxFiles,
          fieldNameSize: config.fieldNameSize,
          fieldSize: config.fieldSize,
          parts: config.maxFiles + 10 // Allow some extra parts for form fields
        }
      });

      // Handle file uploads with streaming
      busboy.on('file', (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;

        // Validate file type
        if (!config.allowedMimeTypes.includes(mimeType)) {
          logger.warn('Invalid file type rejected', {
            fieldname,
            filename,
            mimeType,
            allowedTypes: config.allowedMimeTypes
          });
          
          file.resume(); // Drain the stream
          return res.status(400).json({
            error: 'INVALID_FILE_TYPE',
            message: `File type ${mimeType} not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`
          });
        }

        // Check file upload count
        if (uploadCount >= config.maxFiles) {
          logger.warn('Too many files uploaded', {
            uploadCount,
            maxFiles: config.maxFiles
          });
          
          file.resume(); // Drain the stream
          return res.status(400).json({
            error: 'TOO_MANY_FILES',
            message: `Maximum ${config.maxFiles} files allowed`
          });
        }

        uploadCount++;

        // Generate secure filename
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(filename || '');
        const secureFilename = `upload-${uniqueSuffix}${ext}`;
        const filePath = path.join(config.uploadDir, secureFilename);

        // Create write stream
        const writeStream = fs.createWriteStream(filePath);
        let uploadedBytes = 0;

        // Track upload progress
        file.on('data', (chunk) => {
          uploadedBytes += chunk.length;
          totalUploadSize += chunk.length;

          // Check if file size exceeds limit
          if (uploadedBytes > config.maxFileSize) {
            writeStream.destroy();
            fs.unlink(filePath, () => {}); // Clean up partial file
            
            logger.warn('File size exceeded limit', {
              filename,
              uploadedBytes,
              maxFileSize: config.maxFileSize
            });
            
            return res.status(413).json({
              error: 'FILE_TOO_LARGE',
              message: `File size exceeds limit of ${Math.round(config.maxFileSize / 1024 / 1024)}MB`
            });
          }

          // Update progress (could be sent via SSE in future)
          req.uploadProgress = {
            bytesUploaded: uploadedBytes,
            totalBytes: parseInt(req.headers['content-length'] || '0'),
            percentage: Math.round((uploadedBytes / parseInt(req.headers['content-length'] || '1')) * 100),
            filename: filename || 'unknown'
          };
        });

        file.on('end', () => {
          const uploadedFile: UploadedFile = {
            fieldname,
            originalname: filename || 'unknown',
            encoding,
            mimetype: mimeType,
            filename: secureFilename,
            path: filePath,
            size: uploadedBytes
          };

          uploadedFiles.push(uploadedFile);
          
          logger.info('File upload completed', {
            fieldname,
            filename: uploadedFile.originalname,
            size: uploadedBytes,
            mimeType,
            secureFilename
          });
        });

        file.on('error', (error) => {
          writeStream.destroy();
          fs.unlink(filePath, () => {}); // Clean up partial file
          
          logger.error('File upload stream error', {
            error: error.message,
            filename,
            fieldname
          });
          
          return res.status(500).json({
            error: 'UPLOAD_ERROR',
            message: 'File upload failed'
          });
        });

        // Pipe file stream to disk
        file.pipe(writeStream);

        writeStream.on('error', (error) => {
          logger.error('Write stream error', {
            error: error.message,
            filePath,
            filename
          });
          
          return res.status(500).json({
            error: 'WRITE_ERROR',
            message: 'Failed to write file to disk'
          });
        });
      });

      // Handle form fields
      busboy.on('field', (fieldname, value, info) => {
        const { nameTruncated, valueTruncated } = info;
        
        if (nameTruncated) {
          logger.warn('Field name truncated', { fieldname });
        }
        
        if (valueTruncated) {
          logger.warn('Field value truncated', { fieldname, valueLength: value.length });
        }
        
        fields[fieldname] = value;
      });

      // Handle upload completion
      busboy.on('finish', () => {
        // Attach files and fields to request object
        req.streamingFiles = uploadedFiles;
        req.body = { ...req.body, ...fields };

        logger.info('Upload processing completed', {
          filesUploaded: uploadedFiles.length,
          totalSize: totalUploadSize,
          fields: Object.keys(fields)
        });

        next();
      });

      // Handle errors
      busboy.on('error', (error: Error) => {
        logger.error('Busboy parsing error', {
          error: error.message,
          stack: error.stack
        });
        
        // Clean up any uploaded files
        uploadedFiles.forEach(file => {
          fs.unlink(file.path, () => {});
        });
        
        return res.status(500).json({
          error: 'PARSING_ERROR',
          message: 'Failed to parse upload data'
        });
      });

      // Handle file size limit exceeded
      busboy.on('filesLimit', () => {
        logger.warn('File upload limit exceeded');
        return res.status(400).json({
          error: 'FILES_LIMIT_EXCEEDED',
          message: `Maximum ${config.maxFiles} files allowed`
        });
      });

      // Handle field size limit exceeded
      busboy.on('fieldsLimit', () => {
        logger.warn('Fields limit exceeded');
        return res.status(400).json({
          error: 'FIELDS_LIMIT_EXCEEDED',
          message: 'Too many form fields'
        });
      });

      // Handle field size limit exceeded
      busboy.on('partsLimit', () => {
        logger.warn('Parts limit exceeded');
        return res.status(400).json({
          error: 'PARTS_LIMIT_EXCEEDED',
          message: 'Too many parts in multipart data'
        });
      });

      // Start processing the request
      req.pipe(busboy);

    } catch (error: unknown) {
      logger.error('Streaming upload middleware error', {
        error: error?.message || 'Unknown error',
        stack: error?.stack
      });
      
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Upload processing failed'
      });
    }
  };
}

// Export a default instance for common use
export const streamingUpload = createStreamingUpload();

// Export specialized instances
export const imageStreamingUpload = createStreamingUpload({
  maxFileSize: 50 * 1024 * 1024, // 50MB for high-quality images
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFiles: 1
});

export const multiImageStreamingUpload = createStreamingUpload({
  maxFileSize: 50 * 1024 * 1024, // 50MB per file
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFiles: 10 // Allow multiple images
});

// Cleanup middleware - removes uploaded files if processing fails
export function cleanupUploadedFiles(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override response methods to clean up files on error
  res.send = function(body) {
    if (res.statusCode >= 400 && req.streamingFiles) {
      req.streamingFiles.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) {
            logger.warn('Failed to cleanup uploaded file', {
              path: file.path,
              error: err.message
            });
          }
        });
      });
    }
    return originalSend.call(this, body);
  };
  
  res.json = function(body) {
    if (res.statusCode >= 400 && req.streamingFiles) {
      req.streamingFiles.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) {
            logger.warn('Failed to cleanup uploaded file', {
              path: file.path,
              error: err.message
            });
          }
        });
      });
    }
    return originalJson.call(this, body);
  };
  
  next();
}