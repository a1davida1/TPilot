/**
 * Phase 5: Enhanced Storage Quota Management
 * Tiered storage limits with real-time tracking and enforcement
 */
import { db } from '../db.js';
import { mediaAssets, users } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { env } from './config.js';
export class StorageQuotaManager {
    /**
     * Get storage quota information for a user
     */
    static async getQuotaInfo(userId) {
        // Get user's plan type
        const [user] = await db
            .select({ subscriptionStatus: users.subscriptionStatus })
            .from(users)
            .where(eq(users.id, parseInt(userId.toString(), 10)));
        if (!user) {
            throw new Error('User not found');
        }
        // Determine plan type and limits
        const planType = this.getPlanType(user.subscriptionStatus);
        const limit = this.getStorageLimit(planType);
        // Calculate used storage
        const [usage] = await db
            .select({
            used: sql `COALESCE(SUM(bytes), 0)`.as('used'),
        })
            .from(mediaAssets)
            .where(eq(mediaAssets.userId, parseInt(userId.toString(), 10)));
        const used = Number(usage?.used || 0);
        const available = Math.max(0, limit - used);
        const percentage = limit > 0 ? (used / limit) * 100 : 0;
        return {
            used,
            limit,
            available,
            percentage,
            planType,
        };
    }
    /**
     * Check if user can upload a file of given size
     */
    static async canUpload(userId, sizeBytes) {
        const quotaInfo = await this.getQuotaInfo(userId);
        if (sizeBytes > quotaInfo.available) {
            return {
                canUpload: false,
                reason: `File size (${this.formatBytes(sizeBytes)}) exceeds available storage (${this.formatBytes(quotaInfo.available)})`,
                quotaInfo,
            };
        }
        // Additional check for single file size limits (e.g., 100MB per file)
        const maxFileSize = 100 * 1024 * 1024; // 100MB
        if (sizeBytes > maxFileSize) {
            return {
                canUpload: false,
                reason: `File size exceeds maximum allowed size of ${this.formatBytes(maxFileSize)}`,
                quotaInfo,
            };
        }
        return {
            canUpload: true,
            quotaInfo,
        };
    }
    /**
     * Get storage usage breakdown by type
     */
    static async getUsageBreakdown(userId) {
        const [breakdown] = await db
            .select({
            images: sql `COALESCE(SUM(CASE WHEN mime LIKE 'image/%' THEN bytes ELSE 0 END), 0)`.as('images'),
            videos: sql `COALESCE(SUM(CASE WHEN mime LIKE 'video/%' THEN bytes ELSE 0 END), 0)`.as('videos'),
            others: sql `COALESCE(SUM(CASE WHEN mime NOT LIKE 'image/%' AND mime NOT LIKE 'video/%' THEN bytes ELSE 0 END), 0)`.as('others'),
            total: sql `COALESCE(SUM(bytes), 0)`.as('total'),
            fileCount: sql `COUNT(*)`.as('fileCount'),
        })
            .from(mediaAssets)
            .where(eq(mediaAssets.userId, parseInt(userId.toString(), 10)));
        return {
            images: Number(breakdown?.images || 0),
            videos: Number(breakdown?.videos || 0),
            others: Number(breakdown?.others || 0),
            total: Number(breakdown?.total || 0),
            fileCount: Number(breakdown?.fileCount || 0),
        };
    }
    /**
     * Clean up old/unused media to free space
     */
    static async cleanupUnusedMedia(userId, targetBytes) {
        // Find media assets that haven't been used in posts for 30+ days
        // This is a simplified cleanup - in production you'd want more sophisticated logic
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const oldAssets = await db
            .select()
            .from(mediaAssets)
            .where(and(eq(mediaAssets.userId, parseInt(userId.toString(), 10)), sql `${mediaAssets.lastUsedAt} < ${thirtyDaysAgo}`))
            .limit(targetBytes ? 50 : 10); // Limit cleanup batch size
        if (oldAssets.length === 0) {
            return { freedBytes: 0, filesRemoved: 0 };
        }
        let freedBytes = 0;
        let filesRemoved = 0;
        for (const asset of oldAssets) {
            if (targetBytes && freedBytes >= targetBytes)
                break;
            // In a real implementation, you would delete from storage
            // For now, we'll just track the deletion
            // await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
            freedBytes += asset.bytes;
            filesRemoved++;
        }
        return { freedBytes, filesRemoved };
    }
    /**
     * Helper: Determine plan type from subscription status
     */
    static getPlanType(subscriptionStatus) {
        if (!subscriptionStatus || subscriptionStatus === 'inactive') {
            return 'free';
        }
        if (subscriptionStatus.includes('pro') || subscriptionStatus.includes('premium')) {
            return 'pro';
        }
        if (subscriptionStatus.includes('starter') || subscriptionStatus.includes('paid')) {
            return 'starter';
        }
        return 'free';
    }
    /**
     * Helper: Get storage limit based on plan type
     */
    static getStorageLimit(planType) {
        switch (planType) {
            case 'pro':
                return env.PLAN_STORAGE_BYTES_PRO; // 50GB
            case 'starter':
                return env.PLAN_STORAGE_BYTES_STARTER; // 10GB
            case 'free':
            default:
                return env.PLAN_STORAGE_BYTES_FREE; // 2GB
        }
    }
    /**
     * Helper: Format bytes to human readable
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
