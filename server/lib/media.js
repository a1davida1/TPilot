// Placeholder stub for media.js to fix test imports
// This file exports a MediaManager class with the required static methods

export class MediaManager {
  static usesLocalStorage() {
    return true;
  }

  static getLocalAssetPath(key) {
    return `/uploads/${key}`;
  }

  static async validateDownloadToken(token) {
    return null;
  }

  static async generateDownloadToken(assetId, userId, key) {
    return `download_token_${assetId}_${userId}`;
  }

  static async uploadFile(buffer, options) {
    return {
      key: `upload_${Date.now()}`,
      bytes: buffer.length,
      filename: options.filename,
      mime: 'application/octet-stream'
    };
  }

  static async uploadFromLocalFile(filePath, options) {
    return {
      key: `upload_local_${Date.now()}`,
      bytes: 0,
      filename: options.filename,
      mime: 'application/octet-stream'
    };
  }

  static async deleteAsset(key) {
    return true;
  }

  static async getAssetSignedUrl(key) {
    return `/media/${key}`;
  }

  static async getAssetBytes(key) {
    return Buffer.from('mock media content');
  }

  static async getUserAssets(userId, includeUrls = false) {
    return [];
  }

  static async getUserStorageUsage(userId) {
    return 0;
  }

  static async recordUsage(assetId, usageType, usedInId) {
    return;
  }

  static async cleanupExpiredTokens() {
    return;
  }
}

// Export any other utilities that might be needed
export const isS3Configured = false;