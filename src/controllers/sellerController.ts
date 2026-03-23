import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions, messages, reviews, categories, users } from '../db/schema';
import { desc, eq, and, or, like, asc, sql } from 'drizzle-orm';
import type { BikeListingFiles } from '../middleware/bikeUploadMiddleware';
import {
  collectImageUrlsFromRequest,
  collectVideoUrlFromRequest,
  normalizeImagesFromBody,
} from '../middleware/bikeUploadMiddleware';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slug: chữ số + gạch ngang, không khoảng trắng (vd mountain-bike) */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * categoryId trong body có thể là: UUID, slug (vd mountain-bike), hoặc tên khớp chính xác (không phân biệt hoa thường).
 */
async function resolveCategoryInput(
  raw: unknown
): Promise<{ ok: true; id: string | null } | { ok: false; message: string }> {
  if (raw === undefined || raw === null) {
    return { ok: true, id: null };
  }
  const s = String(raw).trim();
  if (s === '') {
    return { ok: true, id: null };
  }

  if (UUID_REGEX.test(s)) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, s))
      .limit(1);
    if (!row) {
      return { ok: false, message: 'Danh mục không tồn tại (UUID không hợp lệ).' };
    }
    return { ok: true, id: row.id };
  }

  const slugKey = s.toLowerCase();
  if (SLUG_PATTERN.test(s) && !/\s/.test(s)) {
    const [bySlug] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slugKey))
      .limit(1);
    if (bySlug) {
      return { ok: true, id: bySlug.id };
    }
  }

  const [byName] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(trim(${categories.name})) = ${s.toLowerCase()}`)
    .limit(1);
  if (byName) {
    return { ok: true, id: byName.id };
  }

  return {
    ok: false,
    message: `Không tìm thấy danh mục "${s}". Dùng tên đúng (vd: Mountain Bike), slug (vd: mountain-bike), hoặc UUID. Gọi GET /api/seller/v1/categories để xem danh sách.`,
  };
}

const MAX_BIKE_YEAR = () => new Date().getFullYear() + 1;

/** Năm SX: bắt buộc hợp lệ (multipart gửi string — tránh NaN xuống DB). */
function parseBikeYear(value: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : parseInt(String(value).trim(), 10);
  if (Number.isNaN(n)) {
    return { ok: false, message: 'year phải là số nguyên hợp lệ (ví dụ 2022), không được để chữ.' };
  }
  const maxY = MAX_BIKE_YEAR();
  if (n < 1900 || n > maxY) {
    return { ok: false, message: `year phải từ 1900 đến ${maxY}.` };
  }
  return { ok: true, value: n };
}

function parseBikePrice(value: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : parseFloat(String(value).trim().replace(/\s/g, '').replace(/,/g, ''));
  if (Number.isNaN(raw) || !Number.isFinite(raw)) {
    return { ok: false, message: 'price phải là số hợp lệ (ví dụ 45000000).' };
  }
  if (raw < 0) {
    return { ok: false, message: 'price không được âm.' };
  }
  return { ok: true, value: raw };
}

/** mileage: trống/null → null; có giá trị → số nguyên >= 0 */
function parseBikeMileageField(value: unknown): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  const n = parseInt(String(value).trim(), 10);
  if (Number.isNaN(n) || n < 0) {
    return { ok: false, message: 'mileage phải là số nguyên >= 0 hoặc để trống.' };
  }
  return { ok: true, value: n };
}

// ============= DASHBOARD =============

/**
 * GET /api/seller/v1/dashboard
 * Tổng quan thống kê dành cho seller: số tin đăng, giao dịch, doanh thu
 */
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;

    const allBikes = await db
      .select({ status: bikes.status })
      .from(bikes)
      .where(eq(bikes.sellerId, sellerId));

    const bikeStats = {
      total: allBikes.length,
      pending: allBikes.filter((b) => b.status === 'pending').length,
      approved: allBikes.filter((b) => b.status === 'approved').length,
      rejected: allBikes.filter((b) => b.status === 'rejected').length,
      hidden: allBikes.filter((b) => b.status === 'hidden').length,
      sold: allBikes.filter((b) => b.status === 'sold').length,
    };

    const allTransactions = await db
      .select({ status: transactions.status, amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.sellerId, sellerId));

    const transactionStats = {
      total: allTransactions.length,
      pending: allTransactions.filter((t) => t.status === 'pending').length,
      approved: allTransactions.filter((t) => t.status === 'approved').length,
      completed: allTransactions.filter((t) => t.status === 'completed').length,
      cancelled: allTransactions.filter((t) => t.status === 'cancelled').length,
      totalRevenue: allTransactions
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
    };

    // Đánh giá trung bình
    const allReviews = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.sellerId, sellerId));

    const reputationStats = {
      totalReviews: allReviews.length,
      averageRating:
        allReviews.length > 0
          ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
          : 0,
    };

    res.status(200).json({
      success: true,
      data: { bikes: bikeStats, transactions: transactionStats, reputation: reputationStats },
      message: 'Dashboard fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= CATEGORIES (CHO FORM ĐĂNG / SỬA TIN) =============

/**
 * GET /api/seller/v1/categories
 * Danh sách danh mục xe (id, name, slug) — dùng cho dropdown; FE có thể gửi lại id, slug hoặc name khi tạo/sửa tin.
 */
export const getCategoriesForSeller = async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
      })
      .from(categories)
      .orderBy(asc(categories.name));

    res.status(200).json({
      success: true,
      data: rows,
      message: 'Danh sách danh mục',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh mục',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= BIKE LISTINGS =============

/**
 * POST /api/seller/v1/bikes
 * Đăng tin bán xe mới. Tin sẽ ở trạng thái "pending" chờ admin duyệt.
 */
export const createBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { title, description, brand, model, year, price, condition, mileage, color, categoryId } = req.body;
    const images = collectImageUrlsFromRequest(req);
    const videoRaw = collectVideoUrlFromRequest(req);
    const video = videoRaw === undefined ? null : videoRaw;

    if (!title || !description || !brand || !model || !year || !price || !condition) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: title, description, brand, model, year, price, condition',
      });
    }

    const validConditions = ['excellent', 'good', 'fair'];
    if (!validConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: `Tình trạng xe không hợp lệ. Phải là một trong: ${validConditions.join(', ')}`,
      });
    }

    const yearParsed = parseBikeYear(year);
    if (!yearParsed.ok) {
      return res.status(400).json({ success: false, message: yearParsed.message });
    }
    const priceParsed = parseBikePrice(price);
    if (!priceParsed.ok) {
      return res.status(400).json({ success: false, message: priceParsed.message });
    }
    const mileageParsed = parseBikeMileageField(mileage);
    if (!mileageParsed.ok) {
      return res.status(400).json({ success: false, message: mileageParsed.message });
    }

    let finalCategoryId: string | null = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const resolved = await resolveCategoryInput(categoryId);
      if (!resolved.ok) {
        return res.status(400).json({ success: false, message: resolved.message });
      }
      finalCategoryId = resolved.id;
    }

    const [newBike] = await db
      .insert(bikes)
      .values({
        title,
        description,
        brand,
        model,
        year: yearParsed.value,
        price: priceParsed.value,
        condition,
        mileage: mileageParsed.value,
        color: color || null,
        images: images || [],
        video: video || null,
        categoryId: finalCategoryId,
        sellerId,
        status: 'pending',
        isVerified: 'not_verified',
        inspectionStatus: 'pending',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newBike,
      message: 'Đăng tin thành công. Tin đang chờ admin kiểm duyệt.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đăng tin bán xe',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/seller/v1/bikes
 * Danh sách tất cả tin đăng của seller (bao gồm mọi trạng thái).
 */
export const getMyBikes = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { status, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

    const filters: any[] = [eq(bikes.sellerId, sellerId)];

    const allowedBikeStatuses = ['pending', 'approved', 'rejected', 'hidden', 'sold', 'reserved'];
    if (status) {
      const s = String(status);
      if (!allowedBikeStatuses.includes(s)) {
        return res.status(400).json({
          success: false,
          message: `status không hợp lệ. Cho phép: ${allowedBikeStatuses.join(', ')}`,
        });
      }
      filters.push(eq(bikes.status, s));
    }

    if (search) {
      filters.push(
        or(
          like(bikes.title, `%${search}%`),
          like(bikes.brand, `%${search}%`),
          like(bikes.model, `%${search}%`)
        )
      );
    }

    let sortField: any = bikes.createdAt;
    if (sortBy === 'price') sortField = bikes.price;
    else if (sortBy === 'year') sortField = bikes.year;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await db.select({ id: bikes.id }).from(bikes).where(and(...filters));
    const total = countResult.length;

    const myBikes = await db.query.bikes.findMany({
      where: and(...filters),
      with: {
        category: {
          columns: { id: true, name: true, slug: true },
        },
      },
      columns: {
        id: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        price: true,
        condition: true,
        color: true,
        images: true,
        video: true,
        status: true,
        isVerified: true,
        inspectionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [sortOrder === 'asc' ? asc(sortField) : desc(sortField)],
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data: myBikes,
      message: 'Danh sách tin đăng fetched successfully',
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tin đăng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/seller/v1/bikes/:id
 * Chi tiết một tin đăng của seller (bao gồm inspections và transactions).
 */
export const getMyBikeDetail = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as { id: string };

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const bike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)),
      with: {
        category: true,
        inspections: {
          columns: {
            id: true,
            status: true,
            overallCondition: true,
            frameCondition: true,
            brakeCondition: true,
            drivetrainCondition: true,
            wheelCondition: true,
            inspectionNote: true,
            recommendation: true,
            inspectionImages: true,
            reportFile: true,
            createdAt: true,
          },
        },
        transactions: {
          columns: { id: true, amount: true, status: true, paymentMethod: true, notes: true, createdAt: true },
          with: {
            buyer: { columns: { id: true, name: true, email: true, phone: true, avatar: true } },
          },
        },
      },
    });

    if (!bike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng hoặc bạn không sở hữu tin này' });
    }

    res.status(200).json({ success: true, data: bike, message: 'Chi tiết tin đăng fetched successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết tin đăng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * PUT /api/seller/v1/bikes/:id
 * Chỉnh sửa tin đăng. Nếu sửa thông tin cốt lõi của tin đã được approved
 * thì sẽ reset về pending để admin duyệt lại.
 */
export const updateBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as {id: string};

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const existingBike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)),
    });

    if (!existingBike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng hoặc bạn không sở hữu tin này' });
    }

    // Cannot update if inspector is currently inspecting
    if (existingBike.inspectionStatus === 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Không thể chỉnh sửa tin khi inspector đang kiểm định. Vui lòng chờ kết quả kiểm định.',
      });
    }

    if (existingBike.status === 'sold') {
      return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa tin đã bán' });
    }

    const { title, description, brand, model, year, price, condition, mileage, color, categoryId } = req.body;
    const files = (req as any).files as BikeListingFiles | undefined;

    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model;
    if (year !== undefined) {
      const y = parseBikeYear(year);
      if (!y.ok) {
        return res.status(400).json({ success: false, message: y.message });
      }
      updateData.year = y.value;
    }
    if (price !== undefined) {
      const p = parseBikePrice(price);
      if (!p.ok) {
        return res.status(400).json({ success: false, message: p.message });
      }
      updateData.price = p.value;
    }
    if (condition !== undefined) {
      const validConditions = ['excellent', 'good', 'fair'];
      if (!validConditions.includes(condition)) {
        return res.status(400).json({
          success: false,
          message: `Tình trạng xe không hợp lệ. Phải là một trong: ${validConditions.join(', ')}`,
        });
      }
      updateData.condition = condition;
    }
    if (mileage !== undefined) {
      const m = parseBikeMileageField(mileage);
      if (!m.ok) {
        return res.status(400).json({ success: false, message: m.message });
      }
      updateData.mileage = m.value;
    }
    if (color !== undefined) updateData.color = color;
    // Ảnh: upload file (multipart) hoặc mảng URL JSON; video: chỉ URL (body text / JSON)
    // When new files uploaded: APPEND to old images (stack them)
    if (files?.images && files.images.length > 0) {
      const newUrls = collectImageUrlsFromRequest(req);
      const bodyImages = normalizeImagesFromBody(req.body as Record<string, unknown>);
      updateData.images = bodyImages && bodyImages.length > 0 ? [...newUrls, ...bodyImages] : newUrls;
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'images')) {
      // If no new files but body has images: use those
      const normalized = normalizeImagesFromBody(req.body as Record<string, unknown>);
      if (normalized !== undefined) updateData.images = normalized;
    }
    // If no new files and no body images: updateData.images stays undefined → old images preserved
    if (Object.prototype.hasOwnProperty.call(req.body, 'video')) {
      const v = collectVideoUrlFromRequest(req);
      updateData.video = v === undefined ? null : v;
    }
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        updateData.categoryId = null;
      } else {
        const resolved = await resolveCategoryInput(categoryId);
        if (!resolved.ok) {
          return res.status(400).json({ success: false, message: resolved.message });
        }
        updateData.categoryId = resolved.id;
      }
    }

    // Core fields that trigger resets
    const coreFields = ['title', 'description', 'brand', 'model', 'year', 'price', 'condition'];
    const editingCoreFields = coreFields.some((f) => updateData[f] !== undefined);
    
    // SCENARIO 1: Free edit (pending status, no inspection yet) → no changes
    if (existingBike.status === 'pending' && existingBike.inspectionStatus === 'pending') {
      // Allow free edit, no status/inspection resets
    } 
    // SCENARIO 2: Rejected bikes → reset inspection only, NEVER change status
    // Status change MUST go through resubmitBike endpoint
    else if (existingBike.status === 'rejected') {
      updateData.inspectionStatus = 'pending';
      updateData.isVerified = 'not_verified';
    }
    // SCENARIO 3: After inspection completed (inspectionStatus='completed') → reset inspection and status
    else if (editingCoreFields && existingBike.inspectionStatus === 'completed') {
      updateData.inspectionStatus = 'pending';
      updateData.isVerified = 'not_verified';
      // For approved bikes that were re-edited after inspection
      if (existingBike.status === 'approved') {
        updateData.status = 'pending';
      }
    }
    // SCENARIO 4: After admin approved (status='approved') → reset all
    else if (editingCoreFields && existingBike.status === 'approved') {
      updateData.status = 'pending';
      updateData.inspectionStatus = 'pending';
      updateData.isVerified = 'not_verified';
    }

    const [updatedBike] = await db
      .update(bikes)
      .set(updateData)
      .where(and(eq(bikes.id, id as string), eq(bikes.sellerId, sellerId)))
      .returning();

    const message = buildUpdateMessage(existingBike.status, updateData);

    res.status(200).json({ success: true, data: updatedBike, message });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tin đăng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Helper function to build appropriate message based on update scenario
 */
function buildUpdateMessage(oldStatus: string, updateData: Record<string, any>): string {
  if (updateData.status === 'pending') {
    return 'Tin đã được cập nhật và gửi lại để admin kiểm duyệt.';
  }
  return 'Tin đã được cập nhật thành công';
}

/**
 * PUT /api/seller/v1/bikes/:id/visibility
 * Ẩn hoặc hiện tin đăng đã được approved.
 */
export const toggleBikeVisibility = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as { id: string } ;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const existingBike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)),
    });

    if (!existingBike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng hoặc bạn không sở hữu tin này' });
    }

    if (existingBike.status !== 'approved' && existingBike.status !== 'hidden') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể ẩn/hiện tin đăng đang ở trạng thái approved hoặc hidden',
      });
    }

    const newStatus = existingBike.status === 'approved' ? 'hidden' : 'approved';

    const [updatedBike] = await db
      .update(bikes)
      .set({ status: newStatus })
      .where(and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)))
      .returning();

    res.status(200).json({
      success: true,
      data: updatedBike,
      message: newStatus === 'hidden' ? 'Tin đăng đã được ẩn thành công' : 'Tin đăng đã được hiển thị trở lại',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thay đổi trạng thái hiển thị',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * DELETE /api/seller/v1/bikes/:id
 * Xóa tin đăng. Không thể xóa nếu có giao dịch đang pending.
 */
/**
 * DELETE /api/seller/v1/bikes/:id
 * Seller deletes their bike listing
 * SAFEGUARDS: Only allows deletion of pending or rejected bikes
 * - Cannot delete approved/public bikes (buyers might have interest)
 * - Cannot delete sold bikes
 * - Cannot delete reserved bikes
 * - Cannot delete bikes with active pending transactions
 */
export const deleteBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as { id: string };

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const existingBike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)),
    });

    if (!existingBike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng hoặc bạn không sở hữu tin này' });
    }

    // RESTRICTION: Only allow deletion of pending and rejected bikes
    if (!['pending', 'rejected'].includes(existingBike.status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa tin đăng ở trạng thái '${existingBike.status}'. Chỉ có thể xóa những tin ở trạng thái 'pending' hoặc 'rejected'.`,
      });
    }

    // Additional safety check: prevent deletion if there are active pending transactions
    const activeTransactions = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.bikeId, id), eq(transactions.status, 'pending')));

    if (activeTransactions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tin đăng đang có giao dịch pending. Hãy hủy hoặc hoàn tất giao dịch trước.',
      });
    }

    await db.delete(bikes).where(and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)));

    res.status(200).json({ success: true, message: 'Tin đăng đã được xóa thành công' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa tin đăng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/seller/v1/bikes/:id/resubmit
 * Seller resubmit rejected bike (failed inspector verification)
 * Changes status from rejected to pending for re-inspection
 * Edit bike details via updateBike before resubmit if needed
 */
export const resubmitBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as { id: string };

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const existingBike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)),
    });

    if (!existingBike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin đăng hoặc bạn không sở hữu tin này' });
    }

    // Can only resubmit if bike is in rejected state (failed inspection)
    if (existingBike.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Chỉ có thể resubmit xe bị rejected. Trạng thái hiện tại: ${existingBike.status}`,
      });
    }

    // Change status from rejected to pending for re-inspection
    const [updatedBike] = await db
      .update(bikes)
      .set({
        status: 'pending',
        inspectionStatus: 'pending',
        isVerified: 'not_verified',
        updatedAt: new Date(),
      })
      .where(and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)))
      .returning();

    res.status(200).json({
      success: true,
      data: updatedBike,
      message: 'Xe đã được gửi lại kiểm định. Inspector sẽ review lại.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi lại xe kiểm định',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= TRANSACTIONS =============

/**
 * GET /api/seller/v1/transactions
 * Xem danh sách đơn đặt mua nhận được (buyer đặt cọc/mua xe của seller).
 */
export const getMyTransactions = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const allowedTxStatuses = ['pending', 'completed', 'cancelled'];
    const filters: any[] = [eq(transactions.sellerId, sellerId)];
    if (status) {
      const s = String(status);
      if (!allowedTxStatuses.includes(s)) {
        return res.status(400).json({
          success: false,
          message: `status không hợp lệ. Cho phép: ${allowedTxStatuses.join(', ')}`,
        });
      }
      filters.push(eq(transactions.status, s));
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await db.select({ id: transactions.id }).from(transactions).where(and(...filters));
    const total = countResult.length;

    const myTransactions = await db.query.transactions.findMany({
      where: and(...filters),
      with: {
        bike: {
          columns: { id: true, title: true, brand: true, model: true, price: true, images: true },
        },
        buyer: {
          columns: { id: true, name: true, email: true, phone: true, avatar: true },
        },
      },
      orderBy: [desc(transactions.createdAt)],
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data: myTransactions,
      message: 'Danh sách giao dịch fetched successfully',
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách giao dịch',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * PUT /api/seller/v1/transactions/:id
 * Seller cập nhật trạng thái giao dịch trong workflow phê duyệt & thanh toán.
 * 
 * Trạng thái được phép:
 * - approved: Phê duyệt giao dịch pending (pending → approved)
 *             Sau khi phê duyệt, buyer mới có thể thanh toán
 * - cancelled: Hủy giao dịch (pending hoặc approved → cancelled)
 *
 * LƯU Ý: Seller KHÔNG thể đặt status = completed. 
 * Trạng thái completed chỉ được đặt bởi Payment Controller (IPN handler)
 * khi buyer hoàn tất thanh toán qua VNPay.
 *
 * Workflow:
 * 1. Buyer tạo transaction → pending
 * 2. Seller phê duyệt → approved (endpoint này với status: approved)
 * 3. Buyer thanh toán VNPay → completed (Payment Controller IPN handler tự động set)
 *    OR Seller/Buyer hủy trước khi thanh toán → cancelled
 */
export const updateTransactionStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params as { id: string };
    const { status, notes } = req.body;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không đúng định dạng' });
    }

    if (!status || !['approved', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Seller chỉ có thể: approved (phê duyệt) hoặc cancelled (hủy)',
        allowedStatuses: ['approved', 'cancelled']
      });
    }

    const existingTransaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.sellerId, sellerId)),
    });

    if (!existingTransaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    // Validate state transitions
    if (status === 'approved') {
      // Only can approve from pending
      if (existingTransaction.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Giao dịch phải ở trạng thái 'pending' để phê duyệt (hiện tại: ${existingTransaction.status})`,
        });
      }
    } else if (status === 'cancelled') {
      // Can cancel from pending or approved (before payment completes)
      if (!['pending', 'approved'].includes(existingTransaction.status)) {
        return res.status(400).json({
          success: false,
          message: `Không thể hủy giao dịch ở trạng thái: ${existingTransaction.status}. Chỉ có thể hủy từ pending hoặc approved.`,
        });
      }
    }

    const updateData: Record<string, any> = { status };
    if (notes !== undefined) updateData.notes = notes;

    const [updatedTransaction] = await db
      .update(transactions)
      .set(updateData)
      .where(and(eq(transactions.id, id), eq(transactions.sellerId, sellerId)))
      .returning();

    let message = '';
    if (status === 'approved') {
      message = 'Giao dịch đã được phê duyệt. Buyer có thể tiến hành thanh toán.';
    } else {
      message = 'Giao dịch đã bị hủy';
    }

    res.status(200).json({
      success: true,
      data: updatedTransaction,
      message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật giao dịch',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= MESSAGES =============

/**
 * GET /api/seller/v1/messages
 * Danh sách các cuộc hội thoại (nhóm theo senderId + bikeId).
 * Trả về tin nhắn mới nhất mỗi cuộc hội thoại.
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;

    // Lấy tất cả tin nhắn liên quan đến seller (nhận hoặc gửi)
    const allMessages = await db.query.messages.findMany({
      where: or(eq(messages.receiverId, sellerId), eq(messages.senderId, sellerId)),
      with: {
        sender: { columns: { id: true, name: true, avatar: true } },
        receiver: { columns: { id: true, name: true, avatar: true } },
        bike: { columns: { id: true, title: true, brand: true, model: true, images: true } },
      },
      orderBy: [desc(messages.createdAt)],
    });

    // Nhóm theo conversation key (bikeId + đối tác)
    const conversationMap = new Map<string, any>();
    for (const msg of allMessages) {
      const partnerId = msg.senderId === sellerId ? msg.receiverId : msg.senderId;
      const key = `${msg.bikeId ?? 'general'}_${partnerId}`;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          partner: msg.senderId === sellerId ? msg.receiver : msg.sender,
          bike: msg.bike,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
            isMine: msg.senderId === sellerId,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      data: Array.from(conversationMap.values()),
      message: 'Danh sách cuộc hội thoại fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tin nhắn',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/seller/v1/messages/:partnerId
 * Lấy lịch sử tin nhắn với một người dùng cụ thể (theo bikeId nếu có).
 */
export const getMessageHistory = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { partnerId } = req.params as { partnerId: string };
    const { bikeId, page = 1, limit = 30 } = req.query;

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không đúng định dạng' });
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 30;
    const offset = (pageNum - 1) * limitNum;

    const filters: any[] = [
      or(
        and(eq(messages.senderId, sellerId), eq(messages.receiverId, partnerId)),
        and(eq(messages.senderId, partnerId), eq(messages.receiverId, sellerId))
      ),
    ];

    if (bikeId) {
      const bid = String(bikeId);
      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({ success: false, message: 'bikeId query không đúng định dạng UUID' });
      }
      const [owned] = await db
        .select({ id: bikes.id })
        .from(bikes)
        .where(and(eq(bikes.id, bid), eq(bikes.sellerId, sellerId)))
        .limit(1);
      if (!owned) {
        return res.status(403).json({
          success: false,
          message: 'Không được xem lịch sử tin nhắn theo xe không thuộc bạn',
        });
      }
      filters.push(eq(messages.bikeId, bid));
    }

    const history = await db.query.messages.findMany({
      where: and(...filters),
      with: {
        sender: { columns: { id: true, name: true, avatar: true } },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limitNum,
      offset,
    });

    // Đánh dấu các tin nhắn chưa đọc gửi đến seller là đã đọc
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.receiverId, sellerId), eq(messages.senderId, partnerId), eq(messages.isRead, false)));

    res.status(200).json({
      success: true,
      data: history.reverse(),
      message: 'Lịch sử tin nhắn fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử tin nhắn',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/seller/v1/messages/:partnerId
 * Gửi tin nhắn phản hồi cho buyer.
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { partnerId } = req.params as { partnerId: string };
    const { content, bikeId } = req.body;

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'ID người nhận không đúng định dạng' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }

    if (partnerId === sellerId) {
      return res.status(400).json({ success: false, message: 'Không thể gửi tin nhắn cho chính mình' });
    }

    const [receiver] = await db.select({ id: users.id }).from(users).where(eq(users.id, partnerId)).limit(1);
    if (!receiver) {
      return res.status(400).json({ success: false, message: 'Người nhận không tồn tại trong hệ thống' });
    }

    let resolvedBikeId: string | null = null;
    if (bikeId !== undefined && bikeId !== null && bikeId !== '') {
      const bid = String(bikeId);
      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({ success: false, message: 'bikeId không đúng định dạng UUID' });
      }
      const [bikeRow] = await db
        .select({ id: bikes.id, sellerId: bikes.sellerId })
        .from(bikes)
        .where(eq(bikes.id, bid))
        .limit(1);
      if (!bikeRow) {
        return res.status(400).json({
          success: false,
          message: 'Xe (bikeId) không tồn tại. Bỏ bikeId hoặc dùng id xe thật của bạn',
        });
      }
      if (bikeRow.sellerId !== sellerId) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ được gắn tin nhắn với xe do chính bạn đăng',
        });
      }
      resolvedBikeId = bid;
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: sellerId,
        receiverId: partnerId,
        bikeId: resolvedBikeId,
        content: content.trim(),
        isRead: false,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Tin nhắn đã được gửi',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= REPUTATION =============

/**
 * GET /api/seller/v1/reviews
 * Xem đánh giá uy tín của seller.
 */
export const getMyReviews = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.sellerId, sellerId));
    const total = countResult.length;

    const allReviews = await db.query.reviews.findMany({
      where: eq(reviews.sellerId, sellerId),
      with: {
        reviewer: { columns: { id: true, name: true, avatar: true } },
        transaction: {
          columns: { id: true, amount: true, createdAt: true },
          with: { bike: { columns: { id: true, title: true, brand: true, model: true } } },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit: limitNum,
      offset,
    });

    const ratingSum = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;

    res.status(200).json({
      success: true,
      data: allReviews,
      message: 'Đánh giá fetched successfully',
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum), averageRating },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy đánh giá',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
