/**
 * Reddit Native Upload Service
 * Uploads images directly to Reddit's servers (i.redd.it)
 * No external dependencies, no third-party hosting
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { logger } from '../bootstrap/logger.js';
import { RedditManager } from '../lib/reddit.js';
import { MediaManager } from '../lib/media.js';
import { recordPostOutcome } from '../compliance/ruleViolationTracker.js';
import { applyImageShieldProtection } from '../routes/upload.js';
import type { PostingPermission } from '../lib/reddit.js';

export interface RedditUploadOptions {
  assetId?: number;
  imageBuffer?: Buffer;
  imagePath?: string;
  imageUrl?: string;
  userId: number;
  subreddit: string;
  title: string;
  nsfw?: boolean;
  spoiler?: boolean;
  flairText?: string;
  applyWatermark?: boolean;
}


export interface RedditUploadResult {
  success: boolean;
  postId?: string;
  url?: string;
  redditImageUrl?: string;
  error?: string;
  warnings?: string[];
  decision?: PostingPermission;
}


// Interface for future Reddit media upload API integration
interface _RedditMediaUploadResponse {
  args: {
    action: string;
    fields: Array<{ name: string; value: string }>;
  };
  asset: {
    asset_id: string;
    processing_state: string;
    payload: {
      filepath: string;
    };
    websocket_url: string;
  };
}

/**
 * Main service class for Reddit native uploads
 */
export class RedditNativeUploadService {
  private static readonly MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB Reddit limit
  private static readonly MAX_DIMENSION = 10000; // Reddit max dimension
  private static readonly JPEG_QUALITY = 95;

  /**
   * Upload and post image directly to Reddit
   */
  static async uploadAndPost(options: RedditUploadOptions): Promise<RedditUploadResult> {
    const startTime = Date.now();
    let tempDir: string | null = null;

    try {
      // Validate inputs
      if (!options.imageBuffer && !options.imagePath && !options.imageUrl && !options.assetId) {
        return {
          success: false,
          error: 'No image source provided',
        };
      }

      // Get Reddit manager
      const reddit = await RedditManager.forUser(options.userId);
      if (!reddit) {
        return {
          success: false,
          error: 'No active Reddit account found. Please connect your Reddit account first.',
        };
      }

      // Check posting permission
      const permission = await RedditManager.canPostToSubreddit(
        options.userId,
        options.subreddit,
        {
          hasLink: false,
          intendedAt: new Date(),
          title: options.title,
        }
      );

      if (!permission.canPost) {
        return {
          success: false,
          error: permission.reason || 'Cannot post to this subreddit',
          warnings: permission.warnings,
          decision: permission,
        };
      }

      // Create temp directory for processing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reddit-upload-'));
      
      // Get image buffer
      let imageBuffer = await this.resolveImageBuffer(options, tempDir);

      // Apply watermark if requested
      if (options.applyWatermark) {
        const watermarkedPath = path.join(tempDir, 'watermarked.jpg');
        const sourcePath = path.join(tempDir, 'source');
        await fs.writeFile(sourcePath, imageBuffer);
        await applyImageShieldProtection(
          sourcePath,
          watermarkedPath,
          'standard',
          true,
          String(options.userId)
        );
        imageBuffer = await fs.readFile(watermarkedPath);
      }

      // Optimize image for Reddit
      imageBuffer = await this.optimizeForReddit(imageBuffer, tempDir);

      // Upload to Reddit's servers
      const uploadResult = await this.uploadToRedditCDN(
        reddit,
        imageBuffer,
        options.subreddit,
        options.title,
        {
          nsfw: options.nsfw ?? false,
          spoiler: options.spoiler ?? false,
        }
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Record successful upload
      if (options.assetId) {
        await MediaManager.recordUsage(
          options.assetId,
          'reddit-direct',
          new Date().toISOString()
        );
      }

      await recordPostOutcome(options.userId, options.subreddit, {
        status: 'posted',
      });

      const logContext = {
        userId: options.userId,
        subreddit: options.subreddit,
        postId: uploadResult.postId,
        duration: Date.now() - startTime,
      };

      logger.info('Reddit native upload successful', logContext);

      return uploadResult;

    } catch (error) {
      logger.error('Reddit native upload failed', {
        userId: options.userId,
        subreddit: options.subreddit,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };

    } finally {
      // Cleanup temp files
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Resolve image buffer from various sources
   */
  private static async resolveImageBuffer(
    options: RedditUploadOptions,
    tempDir: string
  ): Promise<Buffer> {
    // From buffer
    if (options.imageBuffer) {
      return options.imageBuffer;
    }

    // From file path
    if (options.imagePath) {
      return fs.readFile(options.imagePath);
    }

    // From asset ID
    if (options.assetId && options.userId) {
      const asset = await MediaManager.getAsset(options.assetId, options.userId);
      if (!asset) {
        throw new Error('Media asset not found');
      }
      return MediaManager.getAssetBuffer(asset);
    }

    // From URL (with security checks)
    if (options.imageUrl) {
      return this.downloadImage(options.imageUrl, tempDir);
    }

    throw new Error('No valid image source');
  }

  /**
   * Securely download image from URL
   */
  private static async downloadImage(url: string, tempDir: string): Promise<Buffer> {
    // Validate URL
    const parsedUrl = new URL(url);
    
    // Block local/private URLs
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(parsedUrl.hostname)) {
      throw new Error('Cannot download from local URLs');
    }

    // Download with size limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ThottoPilot/1.0',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      throw new Error('URL does not point to an image');
    }

    // Check response size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.MAX_IMAGE_SIZE) {
      throw new Error('Image too large');
    }

    const downloadPath = path.join(tempDir, 'download');
    const chunks: Buffer[] = [];
    
    // Read response body
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(Buffer.from(value));
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    const buffer = Buffer.concat(chunks);
    
    if (buffer.length > this.MAX_IMAGE_SIZE) {
      throw new Error('Image exceeds size limit');
    }
    
    await fs.writeFile(downloadPath, buffer);

    return fs.readFile(downloadPath);
  }

  /**
   * Optimize image for Reddit's requirements
   */
  private static async optimizeForReddit(
    imageBuffer: Buffer,
    tempDir: string
  ): Promise<Buffer> {
    const imagePath = path.join(tempDir, 'original');
    const optimizedPath = path.join(tempDir, 'optimized.jpg');

    await fs.writeFile(imagePath, imageBuffer);

    // Get image metadata
    const metadata = await sharp(imagePath).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions');
    }

    // Calculate resize dimensions if needed
    let resizeOptions: { width?: number; height?: number } = {};
    
    if (metadata.width > this.MAX_DIMENSION || metadata.height > this.MAX_DIMENSION) {
      const ratio = Math.min(
        this.MAX_DIMENSION / metadata.width,
        this.MAX_DIMENSION / metadata.height
      );
      resizeOptions = {
        width: Math.floor(metadata.width * ratio),
        height: Math.floor(metadata.height * ratio),
      };
    }

    // Process image
    let sharpInstance = sharp(imagePath);

    // Resize if needed
    if (resizeOptions.width || resizeOptions.height) {
      sharpInstance = sharpInstance.resize(resizeOptions);
    }

    // Convert to JPEG with high quality
    await sharpInstance
      .jpeg({
        quality: this.JPEG_QUALITY,
        progressive: true,
        optimizeScans: true,
      })
      .toFile(optimizedPath);

    const optimizedBuffer = await fs.readFile(optimizedPath);

    // Check final size
    if (optimizedBuffer.length > this.MAX_IMAGE_SIZE) {
      // Try with lower quality
      await sharp(imagePath)
        .resize(resizeOptions)
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(optimizedPath);

      const reducedBuffer = await fs.readFile(optimizedPath);
      
      if (reducedBuffer.length > this.MAX_IMAGE_SIZE) {
        throw new Error('Image too large for Reddit even after optimization');
      }

      return reducedBuffer;
    }

    return optimizedBuffer;
  }

  /**
   * Upload image directly to Reddit's CDN
   */
  private static async uploadToRedditCDN(
    redditManager: RedditManager,
    imageBuffer: Buffer,
    subreddit: string,
    title: string,
    options: {
      nsfw?: boolean;
      spoiler?: boolean;
    }
  ): Promise<RedditUploadResult> {
    try {
      // Use the existing submitImagePost method which handles Reddit uploads
      const result = await redditManager.submitImagePost({
        subreddit,
        title,
        imageBuffer,
        nsfw: options.nsfw,
        spoiler: options.spoiler,
      });
      
      return result;

    } catch (error) {
      logger.error('Reddit CDN upload failed', {
        error: error instanceof Error ? error.message : String(error),
        subreddit,
      });

      // Check for specific errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('403')) {
        return {
          success: false,
          error: 'You do not have permission to post in this subreddit',
        };
      }

      if (errorMessage.includes('429')) {
        return {
          success: false,
          error: 'Reddit rate limit exceeded. Please try again later.',
        };
      }

      if (errorMessage.includes('SUBREDDIT_NOTALLOWED')) {
        return {
          success: false,
          error: 'This subreddit does not allow image posts',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }


  /**
   * Batch upload multiple images (for future gallery support)
   */
  static async uploadGallery(
    userId: number,
    subreddit: string,
    title: string,
    images: Array<{ assetId?: number; buffer?: Buffer; caption?: string }>,
    options: {
      nsfw?: boolean;
      spoiler?: boolean;
    } = {}
  ): Promise<RedditUploadResult> {
    // For now, just upload the first image
    // Reddit's gallery API is more complex and requires special handling
    if (images.length === 0) {
      return {
        success: false,
        error: 'No images provided',
      };
    }

    const firstImage = images[0];
    return this.uploadAndPost({
      userId,
      subreddit,
      title,
      assetId: firstImage.assetId,
      imageBuffer: firstImage.buffer,
      nsfw: options.nsfw,
      spoiler: options.spoiler,
      applyWatermark: true,
    });
  }
}
