/**
 * Enhanced Catbox Service with better error handling, retry logic, and monitoring
 */

// TODO: Re-enable after migration
// import { db } from '../db.js';
// import { users } from '@shared/schema';
// import { eq } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import FormData from 'form-data';

// Error types for better error handling
export enum CatboxErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  AUTH_ERROR = 'AUTH_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class CatboxError extends Error {
  constructor(
    message: string,
    public type: CatboxErrorType,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CatboxError';
  }
}

interface UploadOptions {
  userhash?: string;
  reqtype: 'fileupload' | 'urlupload';
  file?: Buffer;
  filename?: string;
  url?: string;
  userId?: number;
  metadata?: {
    originalName?: string;
    mimeType?: string;
    size?: number;
  };
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  errorType?: CatboxErrorType;
  duration?: number;
  retries?: number;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export class EnhancedCatboxService {
  private static readonly API_URL = 'https://catbox.moe/user/api.php';
  private static readonly MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'video/mp4',
    'video/webm',
    'video/mov'
  ];

  /**
   * Upload with automatic retry and error recovery
   */
  static async uploadWithRetry(
    options: UploadOptions,
    retryOptions: RetryOptions = {}
  ): Promise<UploadResult> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2
    } = retryOptions;

    let lastError: CatboxError | undefined;
    let retries = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.upload(options);
        
        // TODO: Re-enable after migration
        // // Track successful upload in database
        // if (result.success && result.url && options.userId) {
        //   await this.trackUpload({
        //     userId: options.userId,
        //     url: result.url,
        //     filename: options.metadata?.originalName,
        //     fileSize: options.metadata?.size,
        //     duration: Date.now() - startTime,
        //     retries
        //   });
        // }

        return { ...result, duration: Date.now() - startTime, retries };
      } catch (error) {
        lastError = error instanceof CatboxError ? error : 
          new CatboxError(
            error instanceof Error ? error.message : 'Upload failed',
            CatboxErrorType.UNKNOWN
          );

        retries = attempt + 1;

        // Don't retry for certain error types
        if (lastError.type === CatboxErrorType.FILE_TOO_LARGE ||
            lastError.type === CatboxErrorType.INVALID_FORMAT ||
            lastError.type === CatboxErrorType.AUTH_ERROR) {
          break;
        }

        // Calculate delay with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt),
            maxDelay
          );
          
          logger.warn(`Catbox upload attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            error: lastError.message,
            type: lastError.type
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Upload failed after retries',
      errorType: lastError?.type,
      retries
    };
  }

  /**
   * Core upload method with enhanced error handling
   */
  private static async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      // Validate file size
      if (options.metadata?.size && options.metadata.size > this.MAX_FILE_SIZE) {
        throw new CatboxError(
          `File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
          CatboxErrorType.FILE_TOO_LARGE
        );
      }

      // Validate mime type
      if (options.metadata?.mimeType && 
          !this.ALLOWED_MIME_TYPES.includes(options.metadata.mimeType)) {
        throw new CatboxError(
          `Invalid file type: ${options.metadata.mimeType}`,
          CatboxErrorType.INVALID_FORMAT
        );
      }

      const formData = new FormData();
      formData.append('reqtype', options.reqtype);
      
      if (options.userhash) {
        formData.append('userhash', options.userhash);
      }
      
      if (options.reqtype === 'fileupload' && options.file) {
        formData.append('fileToUpload', options.file, {
          filename: options.filename || 'upload.jpg',
          contentType: options.metadata?.mimeType
        });
      } else if (options.reqtype === 'urlupload' && options.url) {
        formData.append('url', options.url);
      } else {
        throw new CatboxError(
          'Invalid upload parameters',
          CatboxErrorType.API_ERROR
        );
      }

      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: formData as unknown as BodyInit,
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'ThottoPilot/1.0'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const text = await response.text();

      // Parse different error responses
      if (!response.ok) {
        throw new CatboxError(
          `HTTP ${response.status}: ${response.statusText}`,
          this.getErrorType(response.status),
          response.status,
          text
        );
      }

      // Check for API errors in response
      if (text.toLowerCase().includes('error')) {
        throw new CatboxError(
          text,
          CatboxErrorType.API_ERROR,
          response.status,
          text
        );
      }

      // Validate URL format
      const url = text.trim();
      if (!url.startsWith('http')) {
        throw new CatboxError(
          'Invalid response from Catbox',
          CatboxErrorType.API_ERROR,
          undefined,
          text
        );
      }

      logger.info('Catbox upload successful', { 
        url,
        authenticated: !!options.userhash,
        type: options.reqtype
      });
      
      return { success: true, url };
      
    } catch (error) {
      if (error instanceof CatboxError) {
        throw error;
      }

      // Network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new CatboxError(
          'Network error connecting to Catbox',
          CatboxErrorType.NETWORK_ERROR
        );
      }

      // Timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CatboxError(
          'Upload timed out',
          CatboxErrorType.NETWORK_ERROR
        );
      }

      throw new CatboxError(
        error instanceof Error ? error.message : 'Upload failed',
        CatboxErrorType.UNKNOWN
      );
    }
  }

  /**
   * Track upload in database for analytics
   * TODO: Re-enable after migration
   */
  // private static async trackUpload(data: {
  //   userId: number;
  //   url: string;
  //   filename?: string;
  //   fileSize?: number;
  //   duration: number;
  //   retries: number;
  // }): Promise<void> {
  //   try {
  //     await db.insert(catboxUploads).values({
  //       userId: data.userId,
  //       url: data.url,
  //       filename: data.filename,
  //       fileSize: data.fileSize,
  //       uploadDuration: data.duration,
  //       retryCount: data.retries,
  //       provider: 'catbox',
  //       success: true
  //     });
  //   } catch (error) {
  //     logger.error('Failed to track upload', { error, data });
  //   }
  // }

  /**
   * Get error type from HTTP status code
   */
  private static getErrorType(statusCode: number): CatboxErrorType {
    if (statusCode === 429) return CatboxErrorType.RATE_LIMITED;
    if (statusCode === 401 || statusCode === 403) return CatboxErrorType.AUTH_ERROR;
    if (statusCode >= 500) return CatboxErrorType.API_ERROR;
    if (statusCode >= 400) return CatboxErrorType.INVALID_FORMAT;
    return CatboxErrorType.UNKNOWN;
  }

  /**
   * Get user's Catbox hash with caching
   */
  private static userHashCache = new Map<number, { hash: string | null; expires: number }>();
  
  static async getUserHash(_userId: number): Promise<string | null> {
    // TODO: Re-enable after migration
    // For now, always return null until catboxUserhash column is added
    return null;
    
    // // Check cache
    // const cached = this.userHashCache.get(userId);
    // if (cached && cached.expires > Date.now()) {
    //   return cached.hash;
    // }

    // try {
    //   const [user] = await db
    //     .select({ catboxUserhash: users.catboxUserhash })
    //     .from(users)
    //     .where(eq(users.id, userId));
      
    //   const hash = user?.catboxUserhash || null;
      
    //   // Cache for 5 minutes
    //   this.userHashCache.set(userId, {
    //     hash,
    //     expires: Date.now() + 5 * 60 * 1000
    //   });
      
    //   return hash;
    // } catch (error) {
    //   logger.error('Failed to get user Catbox hash', { userId, error });
    //   return null;
    // }
  }

  /**
   * Batch upload multiple files
   */
  static async batchUpload(
    files: Array<{ buffer: Buffer; filename: string; mimeType?: string }>,
    userId?: number
  ): Promise<UploadResult[]> {
    const userhash = userId ? await this.getUserHash(userId) : null;
    
    // Upload files in parallel with concurrency limit
    const concurrencyLimit = 3;
    const results: UploadResult[] = [];
    
    for (let i = 0; i < files.length; i += concurrencyLimit) {
      const batch = files.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(file => 
          this.uploadWithRetry({
            reqtype: 'fileupload',
            file: file.buffer,
            filename: file.filename,
            userhash: userhash || undefined,
            userId,
            metadata: {
              originalName: file.filename,
              mimeType: file.mimeType,
              size: file.buffer.length
            }
          })
        )
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get upload statistics for a user
   * TODO: Re-enable after migration
   */
  static async getUserUploadStats(_userId: number): Promise<{
    totalUploads: number;
    totalSize: number;
    successRate: number;
    averageDuration: number;
  }> {
    // For now, return empty stats until catboxUploads table is added
    return {
      totalUploads: 0,
      totalSize: 0,
      successRate: 100,
      averageDuration: 0
    };
    
    // try {
    //   const stats = await db
    //     .select({
    //       count: db.count(catboxUploads.id),
    //       totalSize: db.sum(catboxUploads.fileSize),
    //       avgDuration: db.avg(catboxUploads.uploadDuration),
    //       successCount: db.sum(
    //         db.case()
    //           .when(eq(catboxUploads.success, true), 1)
    //           .else(0)
    //       )
    //     })
    //     .from(catboxUploads)
    //     .where(eq(catboxUploads.userId, userId));
      
    //   const result = stats[0];
    //   const totalUploads = Number(result.count) || 0;
      
    //   return {
    //     totalUploads,
    //     totalSize: Number(result.totalSize) || 0,
    //     successRate: totalUploads > 0 ? 
    //       (Number(result.successCount) || 0) / totalUploads * 100 : 0,
    //     averageDuration: Number(result.avgDuration) || 0
    //   };
    // } catch (error) {
    //   logger.error('Failed to get upload stats', { userId, error });
    //   return {
    //     totalUploads: 0,
    //     totalSize: 0,
    //     successRate: 0,
    //     averageDuration: 0
    //   };
    // }
  }
}
