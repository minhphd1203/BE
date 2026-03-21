import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

const INSPECTION_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'inspections');

export function ensureInspectionUploadDir(): void {
  fs.mkdirSync(INSPECTION_UPLOAD_DIR, { recursive: true });
}

export function publicInspectionImageUrl(filename: string): string {
  const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const p = `/uploads/inspections/${filename}`;
  return base ? `${base}${p}` : p;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureInspectionUploadDir();
    cb(null, INSPECTION_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.fieldname === 'inspectionImages' && imageMimes.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(
    new Error(
      `Ảnh minh chứng chỉ gửi ở field \`inspectionImages\` (jpeg/png/webp/gif). Nhận: ${file.fieldname} / ${file.mimetype}`
    )
  );
}

export const inspectionProofUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter,
});

const proofFields = inspectionProofUpload.fields([{ name: 'inspectionImages', maxCount: 20 }]);

export function parseInspectionSubmitMultipart(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  proofFields(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ upload ảnh minh chứng ở field inspectionImages (jpeg/png/webp/gif).',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh minh chứng vượt quá dung lượng cho phép.' : err.message,
      });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

export function parseInspectionUpdateMultipart(req: Request, res: Response, next: NextFunction) {
  return parseInspectionSubmitMultipart(req, res, next);
}

export type InspectionProofFiles = {
  inspectionImages?: Express.Multer.File[];
};

/**
 * URL từ file upload (field inspectionImages) + URL trong body (JSON string hoặc mảng).
 * - Chỉ upload file, không gửi inspectionImages trong body: nối thêm fallback (vd ảnh lần kiểm trước khi resubmit).
 * - Body có mảng URL: ưu tiên [...upload, ...body] hoặc chỉ body / chỉ fallback khi không có file.
 */
export function mergeInspectionProofUrls(
  req: Request,
  fallbackUrls: string[] | null | undefined
): string[] {
  const files = (req.files as InspectionProofFiles | undefined)?.inspectionImages;
  const uploaded = files?.map((f) => publicInspectionImageUrl(f.filename)) ?? [];

  const raw = (req.body as Record<string, unknown>).inspectionImages;
  let fromBody: string[] = [];
  if (raw !== undefined && raw !== null && raw !== '') {
    if (Array.isArray(raw)) {
      fromBody = raw.map(String);
    } else if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw) as unknown;
        if (Array.isArray(p)) fromBody = p.map(String);
      } catch {
        /* bỏ qua chuỗi không phải JSON */
      }
    }
  }

  const fallback = fallbackUrls ?? [];

  if (uploaded.length > 0) {
    if (fromBody.length > 0) return [...uploaded, ...fromBody];
    return [...uploaded, ...fallback];
  }
  if (fromBody.length > 0) return fromBody;
  return fallback;
}
