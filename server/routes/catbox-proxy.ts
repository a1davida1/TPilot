import { Router } from 'express';
import multer from 'multer';
import { logger } from '../bootstrap/logger.js';

const router = Router();

// Configure multer for memory storage (200MB limit for Catbox)
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { 
    fileSize: 200 * 1024 * 1024 // 200MB max for Catbox
  }
});

/**
 * POST /api/upload/catbox-proxy
 * Proxy endpoint for Catbox uploads to handle CORS issues
 * This is a fallback if direct browser uploads fail
 */
router.post('/catbox-proxy', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file type (Catbox restrictions)
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'
    ];
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.warn('Invalid file type for Catbox', { 
        mimetype: req.file.mimetype,
        filename: req.file.originalname 
      });
      return res.status(415).json({ 
        error: 'File type not supported by Catbox',
        supportedTypes: allowedTypes 
      });
    }

    // Log upload attempt
    logger.info('Starting Catbox proxy upload', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Create form data for Catbox
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Get user hash if available (for authenticated uploads)
    const userhash = req.body?.userhash || req.headers['x-catbox-userhash'];
    if (userhash) {
      formData.append('userhash', userhash);
      logger.info('Using authenticated upload with userhash');
    }

    // Try primary Catbox endpoint
    let response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData as any,
      headers: {
        ...formData.getHeaders(),
        'User-Agent': 'ThottoPilot/1.0 (https://thottopilot.com)'
      }
    });

    // If Catbox fails, try litterbox (temporary storage)
    if (!response.ok && response.status === 412) {
      logger.warn('Catbox returned 412, trying Litterbox as fallback');
      
      // Rebuild form for Litterbox (1 hour expiry)
      const litterboxForm = new FormData();
      litterboxForm.append('reqtype', 'fileupload');
      litterboxForm.append('time', '1h'); // 1 hour expiry
      litterboxForm.append('fileToUpload', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });

      response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: litterboxForm as any,
        headers: {
          ...litterboxForm.getHeaders(),
          'User-Agent': 'ThottoPilot/1.0 (https://thottopilot.com)'
        }
      });
    }

    if (!response.ok) {
      logger.error('Catbox upload failed', { 
        status: response.status,
        statusText: response.statusText 
      });
      return res.status(response.status).json({ 
        error: `Catbox upload failed: ${response.statusText}` 
      });
    }

    const catboxUrl = await response.text();
    
    if (!catboxUrl || catboxUrl.includes('error')) {
      logger.error('Invalid Catbox response', { response: catboxUrl });
      return res.status(500).json({ 
        error: 'Failed to get valid URL from Catbox' 
      });
    }

    logger.info('Catbox proxy upload successful', { 
      url: catboxUrl.trim(),
      originalName: req.file.originalname,
      size: req.file.size
    });

    res.json({ 
      success: true,
      imageUrl: catboxUrl.trim(),
      provider: 'catbox'
    });

  } catch (error) {
    logger.error('Catbox proxy upload error', { error });
    res.status(500).json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
