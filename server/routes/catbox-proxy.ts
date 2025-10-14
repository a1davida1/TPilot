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

    // Create form data for Catbox
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Upload to Catbox
    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData as any,
      headers: formData.getHeaders()
    });

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
