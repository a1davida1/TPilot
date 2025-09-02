import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import crypto from "crypto";
import { env, config } from "./config.js";
import { db } from "../db.js";
import { mediaAssets, mediaUsages } from "@shared/schema.js";
import { eq, sum, and } from "drizzle-orm";
// S3 client configuration
const s3Client = new S3Client({
    region: env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
    },
});
export class MediaManager {
    static async uploadFile(buffer, options) {
        const { userId, filename, visibility = 'private', applyWatermark = false } = options;
        // Check user quota
        await this.checkUserQuota(userId, buffer.length);
        // Process image if needed
        let finalBuffer = buffer;
        let finalMime = this.getMimeType(filename);
        if (this.isImage(filename)) {
            finalBuffer = await this.processImage(buffer, {
                applyWatermark: applyWatermark && config.watermark.enabled,
                quality: visibility === 'preview-watermarked' ? 70 : 90,
            });
            finalMime = 'image/jpeg'; // Always convert to JPEG for consistency
        }
        // Generate unique key
        const sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');
        const extension = this.getFileExtension(filename);
        const key = `${userId}/${Date.now()}-${sha256.substring(0, 12)}.${extension}`;
        // Check if file already exists
        const existing = await this.findExistingAsset(sha256, userId);
        if (existing) {
            return existing;
        }
        // Upload to S3
        await s3Client.send(new PutObjectCommand({
            Bucket: env.S3_BUCKET_MEDIA,
            Key: key,
            Body: finalBuffer,
            ContentType: finalMime,
            Metadata: {
                'user-id': userId.toString(),
                'original-filename': filename,
                'visibility': visibility,
            },
        }));
        // Save to database
        const [asset] = await db.insert(mediaAssets).values({
            userId,
            key,
            filename,
            bytes: finalBuffer.length,
            mime: finalMime,
            sha256,
            visibility,
        }).returning();
        return {
            ...asset,
            signedUrl: await this.getSignedUrl(key),
        };
    }
    static async getAsset(id, userId) {
        const whereCondition = userId
            ? and(eq(mediaAssets.id, id), eq(mediaAssets.userId, userId))
            : eq(mediaAssets.id, id);
        const [asset] = await db
            .select()
            .from(mediaAssets)
            .where(whereCondition)
            .limit(1);
        if (!asset)
            return null;
        return {
            ...asset,
            signedUrl: await this.getSignedUrl(asset.key),
            downloadUrl: env.S3_PUBLIC_CDN_DOMAIN
                ? `${env.S3_PUBLIC_CDN_DOMAIN}/${asset.key}`
                : undefined,
        };
    }
    static async getUserAssets(userId, limit = 50) {
        const assets = await db
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.userId, userId))
            .orderBy(mediaAssets.createdAt)
            .limit(limit);
        return Promise.all(assets.map(async (asset) => ({
            ...asset,
            signedUrl: await this.getSignedUrl(asset.key),
        })));
    }
    static async deleteAsset(id, userId) {
        const [asset] = await db
            .select()
            .from(mediaAssets)
            .where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, userId)))
            .limit(1);
        if (!asset)
            return false;
        try {
            // Delete from S3
            await s3Client.send(new DeleteObjectCommand({
                Bucket: env.S3_BUCKET_MEDIA,
                Key: asset.key,
            }));
            // Delete from database
            await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
            return true;
        }
        catch (error) {
            console.error('Failed to delete asset:', error);
            return false;
        }
    }
    static async getUserStorageUsage(userId) {
        const result = await db
            .select({ totalBytes: sum(mediaAssets.bytes) })
            .from(mediaAssets)
            .where(eq(mediaAssets.userId, userId));
        const used = parseInt(result[0]?.totalBytes || '0');
        // Get user tier to determine quota (would need user lookup)
        const quota = config.mediaQuotas.free; // Default to free tier
        return { used, quota };
    }
    static async checkUserQuota(userId, newFileSize) {
        const { used, quota } = await this.getUserStorageUsage(userId);
        if (used + newFileSize > quota) {
            throw new Error(`Storage quota exceeded. Used: ${Math.round(used / 1024 / 1024)}MB, Quota: ${Math.round(quota / 1024 / 1024)}MB`);
        }
    }
    static async processImage(buffer, options) {
        let image = sharp(buffer)
            .jpeg({ quality: options.quality })
            .resize(2048, 2048, {
            fit: 'inside',
            withoutEnlargement: true
        });
        if (options.applyWatermark) {
            // Add watermark to bottom-right corner
            const watermarkSvg = Buffer.from(`
        <svg width="300" height="60" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="60" fill="black" opacity="0.3" rx="8"/>
          <text x="20" y="35" font-family="Arial, sans-serif" font-size="18" 
                fill="white" opacity="${config.watermark.opacity}">
            🛡️ ${config.watermark.text}
          </text>
        </svg>
      `);
            image = image.composite([{
                    input: watermarkSvg,
                    gravity: 'southeast',
                    blend: 'over'
                }]);
        }
        return image.toBuffer();
    }
    static async getSignedUrl(key) {
        const command = new GetObjectCommand({
            Bucket: env.S3_BUCKET_MEDIA,
            Key: key,
        });
        return getSignedUrl(s3Client, command, { expiresIn: config.signedUrlTTL });
    }
    static async findExistingAsset(sha256, userId) {
        const [existing] = await db
            .select()
            .from(mediaAssets)
            .where(and(eq(mediaAssets.sha256, sha256), eq(mediaAssets.userId, userId)))
            .limit(1);
        if (!existing)
            return null;
        return {
            ...existing,
            signedUrl: await this.getSignedUrl(existing.key),
        };
    }
    static isImage(filename) {
        const ext = this.getFileExtension(filename).toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    }
    static getFileExtension(filename) {
        return filename.split('.').pop() || 'bin';
    }
    static getMimeType(filename) {
        const ext = this.getFileExtension(filename).toLowerCase();
        const mimeTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    // Track media usage in posts/templates
    static async recordUsage(mediaId, usedInType, usedInId) {
        try {
            await db.insert(mediaUsages).values({
                mediaId,
                usedInType,
                usedInId,
            });
        }
        catch (error) {
            console.error('Failed to record media usage:', error);
        }
    }
    static async getAssetUsage(mediaId) {
        return db
            .select()
            .from(mediaUsages)
            .where(eq(mediaUsages.mediaId, mediaId));
    }
}
