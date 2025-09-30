import { Router } from 'express';
import multer from 'multer';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }});

router.post('/api/uploads', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // TODO: put to S3/GCS here; persist storage_key/mime/size in DB
  return res.status(201).json({ ok: true });
});

export default router;
