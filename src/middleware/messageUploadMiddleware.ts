import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

const MESSAGES_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'messages');

export function ensureMessagesUploadDir(): void {
  fs.mkdirSync(MESSAGES_UPLOAD_DIR, { recursive: true });
}

/** URL công khai cho file đã upload (local: APP_URL=http://localhost:3000) */
export function publicMessageMediaUrl(filename: string): string {
  const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const p = `/uploads/messages/${filename}`;
  return base ? `${base}${p}` : p;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureMessagesUploadDir();
    cb(null, MESSAGES_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

// Allowed file types: images and documents
const allowedMimes = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.fieldname === 'attachment') {
    // Reject empty files
    if (file.size === 0) {
      return cb(null, false);
    }
    // Validate file type
    if (allowedMimes.has(file.mimetype)) {
      return cb(null, true);
    }
    // Reject unsupported file types
    return cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: images (jpeg, png, webp, gif) and documents (pdf, doc, docx, txt).`
      )
    );
  }
  cb(null, false);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export const messageUpload = upload.single('attachment');

// Middleware to attach uploaded file URL to request body for easy access
export const attachFileUrl = (req: Request, res: Response, next: NextFunction) => {
  if (req.file) {
    const fileUrl = publicMessageMediaUrl(req.file.filename);
    // Attach to req.body for easy access in controller
    (req as any).fileUrl = fileUrl;
  }
  next();
};
