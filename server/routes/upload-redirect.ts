/**
 * LEGAL COMPLIANCE: Redirect ALL upload attempts to Imgur
 * We cannot store any images on our servers due to adult content regulations
 */

import { Router } from 'express';
import { logger } from '../bootstrap/logger.js';

const router = Router();

// Redirect any legacy upload endpoints to return an error with clear instructions
router.all('*', (req, res) => {
  logger.warn('Attempted to use deprecated local upload endpoint', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  return res.status(410).json({
    error: 'Local file uploads are disabled for legal compliance',
    message: 'All images must be uploaded through Imgur or provided as external URLs',
    solution: 'Use the Imgur upload portal or paste an existing image URL',
    endpoints: {
      imgur: '/api/uploads/imgur',
      help: 'Images are never stored on our servers for legal compliance with adult content regulations'
    }
  });
});

export default router;
