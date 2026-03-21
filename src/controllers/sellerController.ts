import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions, messages, reviews, categories, users } from '../db/schema';
import { desc, eq, and, or, like, asc } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse mileage: 0 is valid; only null/undefined/'' → null */
function parseMileage(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
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

// ============= BIKE LISTINGS =============

/**
 * POST /api/seller/v1/bikes
 * Đăng tin bán xe mới. Tin sẽ ở trạng thái "pending" chờ admin duyệt.
 */
export const createBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { title, description, brand, model, year, price, condition, mileage, color, images, video, categoryId } =
      req.body;

    if (!title || !description || !brand || !model || !year || !price || !condition) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: title, description, brand, model, year, price, condition',
      });
    }

    const validConditions = ['excellent', 'good', 'fair', 'poor'];
    if (!validConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: `Tình trạng xe không hợp lệ. Phải là một trong: ${validConditions.join(', ')}`,
      });
    }

    let finalCategoryId: string | null = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const cid = String(categoryId);
      if (!UUID_REGEX.test(cid)) {
        return res.status(400).json({ success: false, message: 'categoryId không đúng định dạng UUID' });
      }
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, cid))
        .limit(1);
      if (!catRow) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục không tồn tại. Lấy id từ API danh mục hoặc gửi categoryId: null',
        });
      }
      finalCategoryId = cid;
    }

    const [newBike] = await db
      .insert(bikes)
      .values({
        title,
        description,
        brand,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        condition,
        mileage: parseMileage(mileage),
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

    if (existingBike.status === 'sold') {
      return res.status(400).json({ success: false, message: 'Không thể chỉnh sửa tin đã bán' });
    }

    const { title, description, brand, model, year, price, condition, mileage, color, images, video, categoryId } =
      req.body;

    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model;
    if (year !== undefined) updateData.year = parseInt(year);
    if (price !== undefined) updateData.price = parseFloat(price);
    if (condition !== undefined) {
      const validConditions = ['excellent', 'good', 'fair', 'poor'];
      if (!validConditions.includes(condition)) {
        return res.status(400).json({
          success: false,
          message: `Tình trạng xe không hợp lệ. Phải là một trong: ${validConditions.join(', ')}`,
        });
      }
      updateData.condition = condition;
    }
    if (mileage !== undefined) updateData.mileage = parseMileage(mileage);
    if (color !== undefined) updateData.color = color;
    if (images !== undefined) updateData.images = images;
    if (video !== undefined) updateData.video = video;
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        updateData.categoryId = null;
      } else {
        const cid = String(categoryId);
        if (!UUID_REGEX.test(cid)) {
          return res.status(400).json({ success: false, message: 'categoryId không đúng định dạng UUID' });
        }
        const [catRow] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.id, cid))
          .limit(1);
        if (!catRow) {
          return res.status(400).json({
            success: false,
            message: 'Danh mục không tồn tại. Lấy id từ API danh mục hoặc gửi categoryId: null',
          });
        }
        updateData.categoryId = cid;
      }
    }

    // Nếu sửa thông tin kỹ thuật/giá cả của tin đã approved → reset về pending
    const coreFields = ['title', 'description', 'brand', 'model', 'year', 'price', 'condition'];
    const editingCoreFields = coreFields.some((f) => updateData[f] !== undefined);
    if (editingCoreFields && existingBike.status === 'approved') {
      updateData.status = 'pending';
    }

    const [updatedBike] = await db
      .update(bikes)
      .set(updateData)
      .where(and(eq(bikes.id, id as string), eq(bikes.sellerId, sellerId)))
      .returning();

    const message =
      updateData.status === 'pending'
        ? 'Tin đã được cập nhật và gửi lại để admin kiểm duyệt.'
        : 'Tin đã được cập nhật thành công';

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
 * After fixing the bike info, seller can resubmit to inspection queue
 * Changes status from "rejected" back to "pending" and inspectionStatus to "pending"
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

    // Reset bike to pending inspection
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
      message: 'Xe đã được gửi lại kiểm định. Inspector sẽ review lại các thông tin bạn cập nhật.',
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
