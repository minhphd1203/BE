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
  destination: (_req: any, _file: any, cb: any) => {
    ensureInspectionUploadDir();
    cb(null, INSPECTION_UPLOAD_DIR);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function fileFilter(_req: Request, file: any, cb: any) {
  if (file.fieldname === 'inspectionImages') {
    // Reject empty files - don't save them at all
    if (file.size === 0 || file.mimetype === 'text/plain') {
      return cb(null, false); // Reject, don't save to disk
    }
    // Validate actual image files being uploaded
    if (imageMimes.has(file.mimetype)) {
      return cb(null, true); // Accept actual images
    }
    // Reject non-image files
    return cb(
      new Error(
        `Ảnh minh chứng chỉ gửi ở field \`inspectionImages\` (jpeg/png/webp/gif). Nhận: ${file.fieldname} / ${file.mimetype}`
      )
    );
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
  proofFields(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ upload ảnh minh chứng ở field inspectionImages (jpeg/png/webp/gif).',
        });
      }
      return res.status(400).json({
        success: false,
        message: (err as any).code === 'LIMIT_FILE_SIZE' ? 'Ảnh minh chứng vượt quá dung lượng cho phép.' : (err as any).message,
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
  inspectionImages?: any[];
};

/**
 * URL từ file upload (field inspectionImages) + URL trong body (JSON string hoặc mảng).
 * - Chỉ upload file, không gửi inspectionImages trong body: nối thêm fallback (vd ảnh lần kiểm trước khi resubmit).
 * - Body có mảng URL: ưu tiên [...upload, ...body] hoặc chỉ body / chỉ fallback khi không có file.
 * - On resubmission: If inspector explicitly sends empty array [], respect it (clear images).
 */
export function mergeInspectionProofUrls(
  req: Request,
  fallbackUrls: string[] | null | undefined
): string[] {
  const files = ((req as any).files as InspectionProofFiles | undefined)?.inspectionImages;
  // Only actual image files make it to req.files (empty files are rejected by fileFilter)
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

  // If new files uploaded, use them (replace old ones on resubmit)
  if (uploaded.length > 0) {
    if (fromBody.length > 0) return [...uploaded, ...fromBody];
    return uploaded; // Only new uploaded files
  }
  
  // If explicit images provided in body (including empty array), use them
  // This allows inspector to clear images by sending []
  if (raw !== undefined && raw !== null && raw !== '') {
    return fromBody; // Could be empty [] if inspector explicitly cleared images
  }
  
  // No new files, no body images: fallback to previous inspection images if available
  return fallbackUrls ?? [];
}
