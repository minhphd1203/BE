import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

const BIKES_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'bikes');

export function ensureBikesUploadDir(): void {
  fs.mkdirSync(BIKES_UPLOAD_DIR, { recursive: true });
}

/** URL công khai cho file đã upload (local: BACKEND_URL=http://localhost:3000) */
export function publicBikeMediaUrl(filename: string): string {
  const base = (process.env.BACKEND_URL || process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const p = `/uploads/bikes/${filename}`;
  return base ? `${base}${p}` : p;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureBikesUploadDir();
    cb(null, BIKES_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (file.fieldname === 'images') {
    // Reject empty files - don't save them at all
    if (file.size === 0 || file.mimetype === 'text/plain') {
      return cb(null, false); // Reject, don't save to disk
    }
    // Validate only actual image files being uploaded
    if (imageMimes.has(file.mimetype)) {
      return cb(null, true); // Accept actual images
    }
    // Reject non-image files
    return cb(
      new Error(
        `Loại file không hỗ trợ (${file.fieldname}): ${file.mimetype}. Chỉ upload ảnh (jpeg, png, webp, gif). Video gửi bằng field text \`video\` (URL).`
      )
    );
  }
  cb(
    new Error(
      `Loại file không hỗ trợ (${file.fieldname}): ${file.mimetype}. Chỉ upload ảnh (jpeg, png, webp, gif). Video gửi bằng field text \`video\` (URL).`
    )
  );
}

/** Chỉ ảnh; video luôn là URL trong body (multipart text hoặc JSON). */
export const bikeListingUpload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024, files: 20 },
  fileFilter,
});

const createFields = bikeListingUpload.fields([{ name: 'images', maxCount: 20 }]);

/**
 * Chỉ chạy multer khi Content-Type là multipart (upload file).
 * JSON body giữ nguyên flow cũ.
 */
export function parseBikeListingMultipart(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  createFields(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message:
            'Chỉ được upload file ở field `images`. Video gửi dạng text URL (field `video`), không upload file video.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép.' : err.message,
      });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

const updateFields = bikeListingUpload.fields([{ name: 'images', maxCount: 20 }]);

export function parseBikeUpdateMultipart(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  updateFields(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message:
            'Chỉ được upload file ở field `images`. Video gửi dạng text URL (field `video`), không upload file video.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép.' : err.message,
      });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

export type BikeListingFiles = {
  images?: Express.Multer.File[];
};

/** Parse images từ JSON hoặc multipart (chuỗi JSON trong field images) */
export function normalizeImagesFromBody(body: Record<string, unknown>): string[] | undefined {
  const raw = body.images;
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function collectImageUrlsFromRequest(req: Request): string[] {
  const files = req.files as BikeListingFiles | undefined;
  // Only actual image files make it to req.files (empty files are rejected by fileFilter)
  const uploaded = files?.images?.map((f) => publicBikeMediaUrl(f.filename)) ?? [];
  const fromBody = normalizeImagesFromBody(req.body as Record<string, unknown>);
  if (uploaded.length > 0) {
    return fromBody?.length ? [...uploaded, ...fromBody] : uploaded;
  }
  return fromBody ?? [];
}

/** Video chỉ nhận URL (JSON hoặc field text trong multipart), không upload file. */
export function collectVideoUrlFromRequest(req: Request): string | null | undefined {
  const b = req.body as { video?: string | null };
  if (b.video === undefined) return undefined;
  if (b.video === null || b.video === '') return null;
  return String(b.video);
}
