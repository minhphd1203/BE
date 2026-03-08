import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions, messages, reviews } from '../db/schema';
import { desc, eq, and, or, like, asc } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        mileage: mileage ? parseInt(mileage) : null,
        color: color || null,
        images: images || [],
        video: video || null,
        categoryId: categoryId || null,
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

    if (status) {
      filters.push(eq(bikes.status, status as string));
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
    const { id } = req.params;

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
    const { id } = req.params;

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
    if (condition !== undefined) updateData.condition = condition;
    if (mileage !== undefined) updateData.mileage = mileage ? parseInt(mileage) : null;
    if (color !== undefined) updateData.color = color;
    if (images !== undefined) updateData.images = images;
    if (video !== undefined) updateData.video = video;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    // Nếu sửa thông tin kỹ thuật/giá cả của tin đã approved → reset về pending
    const coreFields = ['title', 'description', 'brand', 'model', 'year', 'price', 'condition'];
    const editingCoreFields = coreFields.some((f) => updateData[f] !== undefined);
    if (editingCoreFields && existingBike.status === 'approved') {
      updateData.status = 'pending';
    }

    const [updatedBike] = await db
      .update(bikes)
      .set(updateData)
      .where(and(eq(bikes.id, id), eq(bikes.sellerId, sellerId)))
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
    const { id } = req.params;

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
export const deleteBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params;

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
      return res.status(400).json({ success: false, message: 'Không thể xóa tin đã bán' });
    }

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

// ============= TRANSACTIONS =============

/**
 * GET /api/seller/v1/transactions
 * Xem danh sách đơn đặt mua nhận được (buyer đặt cọc/mua xe của seller).
 */
export const getMyTransactions = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const filters: any[] = [eq(transactions.sellerId, sellerId)];
    if (status) filters.push(eq(transactions.status, status as string));

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
 * Seller xác nhận hoặc hủy đơn đặt mua từ buyer.
 * - completed: xác nhận bán thành công (bike → sold)
 * - cancelled: hủy giao dịch
 */
export const updateTransactionStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không đúng định dạng' });
    }

    if (!status || !['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Seller có thể cập nhật: completed hoặc cancelled',
      });
    }

    const existingTransaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.sellerId, sellerId)),
    });

    if (!existingTransaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    if (existingTransaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Không thể cập nhật giao dịch đã ở trạng thái: ${existingTransaction.status}`,
      });
    }

    const updateData: Record<string, any> = { status };
    if (notes !== undefined) updateData.notes = notes;

    const [updatedTransaction] = await db
      .update(transactions)
      .set(updateData)
      .where(and(eq(transactions.id, id), eq(transactions.sellerId, sellerId)))
      .returning();

    // Nếu hoàn tất giao dịch → đánh dấu xe là đã bán
    if (status === 'completed') {
      await db.update(bikes).set({ status: 'sold' }).where(eq(bikes.id, existingTransaction.bikeId));
    }

    res.status(200).json({
      success: true,
      data: updatedTransaction,
      message: status === 'completed' ? 'Giao dịch đã hoàn tất, xe đã được đánh dấu là đã bán' : 'Giao dịch đã bị hủy',
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
    const { partnerId } = req.params;
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
      filters.push(eq(messages.bikeId, bikeId as string));
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
    const { partnerId } = req.params;
    const { content, bikeId } = req.body;

    if (!UUID_REGEX.test(partnerId)) {
      return res.status(400).json({ success: false, message: 'ID người nhận không đúng định dạng' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: sellerId,
        receiverId: partnerId,
        bikeId: bikeId || null,
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

    const averageRating =
      total > 0 ? Math.round((countResult.reduce(() => 0, 0) / total) * 10) / 10 : 0;

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
