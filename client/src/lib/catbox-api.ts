/**
 * Catbox API Client
 * Full implementation of the Catbox.moe API
 * Documentation: https://catbox.moe/user/api.php
 */

export interface CatboxConfig {
  userhash?: string; // Optional for authenticated uploads
}

export interface CatboxUploadResult {
  url: string;
  success: boolean;
  error?: string;
}

export interface CatboxAlbumResult {
  short: string; // The 6 character album ID
  url: string;
  success: boolean;
  error?: string;
}

export class CatboxAPI {
  private static readonly API_URL = 'https://catbox.moe/user/api.php';
  private userhash?: string;

  constructor(config?: CatboxConfig) {
    this.userhash = config?.userhash;
  }

  /**
   * Upload a file to Catbox
   * For anonymous uploads, don't provide a userhash
   */
  async uploadFile(file: File): Promise<CatboxUploadResult> {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (this.userhash) {
      formData.append('userhash', this.userhash);
    }
    formData.append('fileToUpload', file);

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      // Check for error responses
      if (!response.ok || text.includes('Error')) {
        return {
          success: false,
          url: '',
          error: text || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Catbox returns the URL as plain text
      return {
        success: true,
        url: text.trim()
      };
    } catch (error) {
      return {
        success: false,
        url: '',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Upload a file from URL to Catbox
   */
  async uploadFromUrl(url: string): Promise<CatboxUploadResult> {
    const formData = new FormData();
    formData.append('reqtype', 'urlupload');
    if (this.userhash) {
      formData.append('userhash', this.userhash);
    }
    formData.append('url', url);

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return {
          success: false,
          url: '',
          error: text || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return {
        success: true,
        url: text.trim()
      };
    } catch (error) {
      return {
        success: false,
        url: '',
        error: error instanceof Error ? error.message : 'URL upload failed'
      };
    }
  }

  /**
   * Delete files from Catbox (requires authentication)
   */
  async deleteFiles(fileNames: string[]): Promise<{ success: boolean; error?: string }> {
    if (!this.userhash) {
      return { success: false, error: 'Authentication required (userhash missing)' };
    }

    const formData = new FormData();
    formData.append('reqtype', 'deletefiles');
    formData.append('userhash', this.userhash);
    formData.append('files', fileNames.join(' '));

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return { success: false, error: text || 'Delete failed' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      };
    }
  }

  /**
   * Create an album on Catbox
   * For anonymous albums, don't provide a userhash (cannot be edited/deleted later)
   * Limited to 500 files per album
   */
  async createAlbum(
    title: string,
    description: string,
    fileNames: string[]
  ): Promise<CatboxAlbumResult> {
    if (fileNames.length > 500) {
      return {
        success: false,
        short: '',
        url: '',
        error: 'Albums are limited to 500 files'
      };
    }

    const formData = new FormData();
    formData.append('reqtype', 'createalbum');
    if (this.userhash) {
      formData.append('userhash', this.userhash);
    }
    formData.append('title', title);
    formData.append('desc', description);
    formData.append('files', fileNames.join(' '));

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return {
          success: false,
          short: '',
          url: '',
          error: text || 'Album creation failed'
        };
      }

      // Extract the short code from the URL
      const match = text.match(/\/([a-zA-Z0-9]{6})$/);
      const short = match ? match[1] : '';

      return {
        success: true,
        short,
        url: text.trim()
      };
    } catch (error) {
      return {
        success: false,
        short: '',
        url: '',
        error: error instanceof Error ? error.message : 'Album creation failed'
      };
    }
  }

  /**
   * Edit an existing album (requires authentication)
   * WARNING: This is a complete replacement - all fields must be provided
   */
  async editAlbum(
    short: string,
    title: string,
    description: string,
    fileNames: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.userhash) {
      return { success: false, error: 'Authentication required' };
    }

    const formData = new FormData();
    formData.append('reqtype', 'editalbum');
    formData.append('userhash', this.userhash);
    formData.append('short', short);
    formData.append('title', title);
    formData.append('desc', description);
    formData.append('files', fileNames.join(' '));

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return { success: false, error: text || 'Edit failed' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Edit failed'
      };
    }
  }

  /**
   * Add files to an existing album (requires authentication)
   */
  async addToAlbum(short: string, fileNames: string[]): Promise<{ success: boolean; error?: string }> {
    if (!this.userhash) {
      return { success: false, error: 'Authentication required' };
    }

    const formData = new FormData();
    formData.append('reqtype', 'addtoalbum');
    formData.append('userhash', this.userhash);
    formData.append('short', short);
    formData.append('files', fileNames.join(' '));

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return { success: false, error: text || 'Add to album failed' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Add to album failed'
      };
    }
  }

  /**
   * Remove files from an album (requires authentication)
   */
  async removeFromAlbum(short: string, fileNames: string[]): Promise<{ success: boolean; error?: string }> {
    if (!this.userhash) {
      return { success: false, error: 'Authentication required' };
    }

    const formData = new FormData();
    formData.append('reqtype', 'removefromalbum');
    formData.append('userhash', this.userhash);
    formData.append('short', short);
    formData.append('files', fileNames.join(' '));

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return { success: false, error: text || 'Remove from album failed' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Remove from album failed'
      };
    }
  }

  /**
   * Delete an album (requires authentication)
   */
  async deleteAlbum(short: string): Promise<{ success: boolean; error?: string }> {
    if (!this.userhash) {
      return { success: false, error: 'Authentication required' };
    }

    const formData = new FormData();
    formData.append('reqtype', 'deletealbum');
    formData.append('userhash', this.userhash);
    formData.append('short', short);

    try {
      const response = await fetch(CatboxAPI.API_URL, {
        method: 'POST',
        body: formData
      });

      const text = await response.text();

      if (!response.ok || text.includes('Error')) {
        return { success: false, error: text || 'Delete album failed' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete album failed'
      };
    }
  }

  /**
   * Extract filename from Catbox URL
   * Example: https://files.catbox.moe/abc123.jpg -> abc123.jpg
   */
  static extractFileName(url: string): string {
    const match = url.match(/\/([^/]+)$/);
    return match ? match[1] : '';
  }

  /**
   * Extract album short code from URL
   * Example: https://catbox.moe/c/pd412w -> pd412w
   */
  static extractAlbumShort(url: string): string {
    const match = url.match(/\/c\/([a-zA-Z0-9]{6})$/);
    return match ? match[1] : '';
  }
}
