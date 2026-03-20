import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions, wishlists, reports, messages, reviews, users } from '../db/schema';
import { desc, eq, and, ilike, lte, gte, or, inArray } from 'drizzle-orm';
import { ApiResponse } from '../models';
import { TRANSACTION_TYPE_OPTIONS, TRANSACTION_TYPES } from '../constants/transactionTypes';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============= SEARCH & BROWSE BIKES =============

/**
 * Search bikes with filters (brand, model, price range, condition, etc.)
 * Returns: minimal bike info for list view (title, price, images, status)
 * Only shows APPROVED bikes (admin approved, not yet verified by inspector)
 * Verification happens AFTER buyer decides to purchase
 * Query parameters:
 * - brand: string (partial match)
 * - model: string (partial match)
 * - minPrice: number
 * - maxPrice: number
 * - condition: string (excellent, good, fair, poor)
 * - color: string
 * - sortBy: string (price, year, mileage, createdAt) - default: createdAt
 * - sortOrder: asc | desc - default: desc
 * - page: number - default: 1
 * - limit: number - default: 10
 */
export const searchBikes = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      brand,
      model,
      minPrice,
      maxPrice,
      condition,
      color,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    // Build status filter: Show approved bikes + reserved bikes if user is seller or buyer
    const statusFilter = or(
      eq(bikes.status, 'approved'),
      // Seller can see their own reserved bikes
      and(
        eq(bikes.status, 'reserved'),
        eq(bikes.sellerId, userId)
      )
    );

    // Build optional filters
    const optionalFilters = [];
    
    if (brand) {
      optionalFilters.push(ilike(bikes.brand, `%${brand}%`));
    }

    if (model) {
      optionalFilters.push(ilike(bikes.model, `%${model}%`));
    }

    if (minPrice) {
      optionalFilters.push(gte(bikes.price, parseFloat(minPrice as string)));
    }

    if (maxPrice) {
      optionalFilters.push(lte(bikes.price, parseFloat(maxPrice as string)));
    }

    if (condition) {
      optionalFilters.push(eq(bikes.condition, condition as string));
    }

    if (color) {
      optionalFilters.push(ilike(bikes.color, `%${color}%`));
    }

    // Combine all filters
    const filters = optionalFilters.length > 0 
      ? [statusFilter, ...optionalFilters]
      : [statusFilter];

    // Determine sort field
    let sortField: any = bikes.createdAt;
    switch (sortBy) {
      case 'price':
        sortField = bikes.price;
        break;
      case 'year':
        sortField = bikes.year;
        break;
      case 'mileage':
        sortField = bikes.mileage;
        break;
      default:
        sortField = bikes.createdAt;
    }

    // Get buyer's reserved bike IDs (direct from bikes table)
    // First, get ALL reserved bikes to check against
    const allReservedBikes = await db.query.bikes.findMany({
      where: eq(bikes.status, 'reserved'),
      columns: { id: true }
    });
    console.log('[Search] All reserved bikes:', allReservedBikes.length);

    // From those reserved bikes, get IDs where user has a completed deposit
    const myReservedBikeIds = [];
    if (allReservedBikes.length > 0) {
      const reservedBikeIds = allReservedBikes.map(b => b.id);
      console.log('[Search] Reserved bike IDs to check:', reservedBikeIds);
      
      const myDeposits = await db.query.transactions.findMany({
        where: and(
          eq(transactions.buyerId, userId),
          eq(transactions.transactionType, 'deposit'),
          eq(transactions.status, 'completed'),
          inArray(transactions.bikeId, reservedBikeIds)
        ),
        columns: { bikeId: true }
      });
      console.log('[Search] My completed deposits:', myDeposits.length);
      console.log('[Search] My deposit bike IDs:', myDeposits.map(t => t.bikeId));
      
      myReservedBikeIds.push(...myDeposits.map(t => t.bikeId));
    }

    // Build status filter with simpler logic
    // Approved bikes: everyone sees
    // Reserved bikes: only seller + only buyer who deposited
    
    console.log('[Search] Building filter for userId:', userId);
    
    // This is what we want to show:
    // 1. All approved bikes
    // 2. Reserved bikes WHERE (seller = me OR buyer has my deposit)
    
    const statusFilterParts: any[] = [
      eq(bikes.status, 'approved') // Public approved bikes
    ];
    
    // Add seller's reserved bikes
    const sellerReservedFilter = and(
      eq(bikes.status, 'reserved'),
      eq(bikes.sellerId, userId)
    );
    if (sellerReservedFilter) {
      statusFilterParts.push(sellerReservedFilter);
    }
    
    // Add buyer's reserved bikes (those with my deposits)
    if (myReservedBikeIds.length > 0) {
      console.log('[Search] Adding my reserved bikes:', myReservedBikeIds);
      const buyerReservedFilter = and(
        eq(bikes.status, 'reserved'),
        inArray(bikes.id, myReservedBikeIds)
      );
      if (buyerReservedFilter) {
        statusFilterParts.push(buyerReservedFilter);
      }
    }

    const finalStatusFilter = or(...statusFilterParts.filter(Boolean));
    console.log('[Search] Status filter parts:', statusFilterParts.length);

    // Combine with optional filters (brand, model, price, etc.)
    const finalFilters = optionalFilters.length > 0 
      ? [finalStatusFilter, ...optionalFilters]
      : [finalStatusFilter];
    console.log('[Search] Final filters count:', finalFilters.length);

    // Calculate offset for pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    console.log('[Search] Final filters - Show:', {
      approved: 'ALL approved bikes',
      myReservedAsOwner: `IF sellerId = ${userId}`,
      myReservedAsDepositBuyer: myReservedBikeIds.length > 0 ? myReservedBikeIds : 'NONE',
    });

    // Fetch total count
    const countResult = await db
      .select({ count: bikes.id })
      .from(bikes)
      .where(and(...finalFilters));

    const total = countResult.length;
    console.log('[Search] Total bikes matching filter:', total);

    // Fetch bikes with minimal info for list view
    const bikesData = await db.query.bikes.findMany({
      where: and(...finalFilters),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      columns: {
        // Include only necessary fields for list view
        id: true,
        title: true,
        brand: true,
        model: true,
        price: true,
        condition: true,
        year: true,
        images: true,
        status: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: [sortOrder === 'asc' ? sortField : desc(sortField)],
      limit: limitNum,
      offset: offset,
    });

    const response: ApiResponse = {
      success: true,
      data: bikesData,
      message: 'Bikes searched successfully',
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching bikes',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get bike details by ID
 * Shows full details of APPROVED bikes (not yet verified by inspector)
 * Verification happens after buyer decides to purchase
 */
export const getBikeDetail = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;

    // Validate UUID format
    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bike ID format',
      });
    }

    const bike = await db.query.bikes.findFirst({
      where: and(
        eq(bikes.id, bikeId),
        eq(bikes.status, 'approved')
      ),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            createdAt: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
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
            createdAt: true,
          },
        },
      },
    });

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found or not available',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: bike,
      message: 'Bike detail fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bike detail',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= TRANSACTIONS (BUYER) =============

/**
 * POST /api/buyer/v1/transactions
 * Buyer đặt mua / đặt cọc một chiếc xe.
 * Bike phải ở trạng thái approved mới có thể đặt.
 */
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { bikeId, amount, transactionType = 'full_payment', paymentMethod, notes } = req.body;

    if (!bikeId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: bikeId' });
    }

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    if (!TRANSACTION_TYPE_OPTIONS.includes(transactionType)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid transaction type. Must be one of: ${TRANSACTION_TYPE_OPTIONS.join(', ')}`,
        allowedTypes: TRANSACTION_TYPE_OPTIONS
      });
    }

    const bike = await db.query.bikes.findFirst({
      where: and(eq(bikes.id, bikeId), eq(bikes.status, 'approved')),
    });

    if (!bike) {
      return res.status(404).json({ success: false, message: 'Xe không tồn tại hoặc chưa được duyệt' });
    }

    if (bike.sellerId === buyerId) {
      return res.status(400).json({ success: false, message: 'Không thể đặt mua xe của chính mình' });
    }

    // Kiểm tra buyer đã có giao dịch pending cho xe này chưa
    const existingTransaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.status, 'pending')
      ),
    });

    if (existingTransaction) {
      return res.status(400).json({ success: false, message: 'Bạn đã có đơn đặt mua đang chờ xử lý cho xe này' });
    }

    // Determine transaction amount and remaining balance
    let transactionAmount: number;
    let remainingBalance: number | null = null;
    let finalNotes = notes || '';

    if (transactionType === TRANSACTION_TYPES.FULL_PAYMENT) {
      // Full payment: amount = full bike price
      if (amount && amount !== bike.price) {
        return res.status(400).json({
          success: false,
          message: `Full payment amount must equal bike price (${bike.price}). Received: ${amount}`,
        });
      }
      transactionAmount = bike.price;
      remainingBalance = 0;
    } else {
      // Deposit: amount must be between 10% - 30% of bike price
      if (!amount || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Deposit amount must be greater than 0' 
        });
      }
      
      const minDeposit = bike.price * 0.1;  // 10%
      const maxDeposit = bike.price * 0.3;  // 30%
      const depositPercentage = (amount / bike.price) * 100;
      
      if (amount < minDeposit) {
        return res.status(400).json({ 
          success: false, 
          message: `Deposit too low. Minimum deposit is 10% of bike price: ${minDeposit.toFixed(0)}`,
          minimumDeposit: minDeposit,
          minimumPercentage: '10%'
        });
      }
      
      if (amount > maxDeposit) {
        return res.status(400).json({ 
          success: false, 
          message: `Deposit too high. Maximum deposit is 30% of bike price: ${maxDeposit.toFixed(0)}`,
          maximumDeposit: maxDeposit,
          maximumPercentage: '30%'
        });
      }
      
      transactionAmount = amount;
      remainingBalance = bike.price - amount;
      
      // Generate automatic notes if not provided
      if (!notes) {
        finalNotes = `Đặt cọc ${depositPercentage.toFixed(1)}% (${amount.toFixed(0)}) để giữ xe. Còn lại ${remainingBalance.toFixed(0)} cần thanh toán khi nhận xe.`;
      }
    }

    const [newTransaction] = await db
      .insert(transactions)
      .values({
        bikeId,
        buyerId,
        sellerId: bike.sellerId,
        amount: transactionAmount,
        transactionType,
        remainingBalance,
        paymentMethod: paymentMethod || null,
        notes: finalNotes || null,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newTransaction,
      message: transactionType === TRANSACTION_TYPES.FULL_PAYMENT 
        ? 'Thanh toán đầy đủ thành công. Đang chờ seller xác nhận.'
        : 'Đặt cọc thành công. Bạn có ưu tiên mua xe này.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo giao dịch',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/buyer/v1/transactions
 * Buyer xem danh sách đơn đặt mua của mình.
 */
export const getMyTransactions = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const filters: any[] = [eq(transactions.buyerId, buyerId)];
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
          columns: { id: true, title: true, brand: true, model: true, price: true, images: true, status: true },
        },
        seller: {
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
 * DELETE /api/buyer/v1/transactions/:id
 * Buyer hủy đơn đặt mua (chỉ khi còn pending).
 */
export const cancelTransaction = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const id = req.params.id as string;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không đúng định dạng' });
    }

    const existingTransaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.buyerId, buyerId)),
    });

    if (!existingTransaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    if (existingTransaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Không thể hủy giao dịch ở trạng thái: ${existingTransaction.status}`,
      });
    }

    const [cancelled] = await db
      .update(transactions)
      .set({ status: 'cancelled' })
      .where(and(eq(transactions.id, id), eq(transactions.buyerId, buyerId)))
      .returning();

    res.status(200).json({ success: true, data: cancelled, message: 'Đơn đặt mua đã được hủy' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy giao dịch',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= WISHLIST =============

/**
 * GET /api/buyer/v1/wishlist
 * Lấy danh sách xe yêu thích của buyer.
 */
export const getWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.userId, userId));
    const total = countResult.length;

    const wishlistItems = await db.query.wishlists.findMany({
      where: eq(wishlists.userId, userId),
      with: {
        bike: {
          columns: {
            id: true, title: true, brand: true, model: true, year: true,
            price: true, condition: true, images: true, status: true, isVerified: true, createdAt: true,
          },
          with: {
            seller: { columns: { id: true, name: true, avatar: true } },
          },
        },
      },
      orderBy: [desc(wishlists.createdAt)],
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data: wishlistItems,
      message: 'Wishlist fetched successfully',
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy wishlist',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/buyer/v1/wishlist/:bikeId
 * Thêm xe vào danh sách yêu thích.
 */
export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const bikeId = req.params.bikeId as string;

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const bike = await db.query.bikes.findFirst({ where: eq(bikes.id, bikeId) });
    if (!bike) {
      return res.status(404).json({ success: false, message: 'Xe không tồn tại' });
    }

    const existing = await db.query.wishlists.findFirst({
      where: and(eq(wishlists.userId, userId), eq(wishlists.bikeId, bikeId)),
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Xe đã có trong danh sách yêu thích' });
    }

    const [item] = await db.insert(wishlists).values({ userId, bikeId }).returning();

    res.status(201).json({ success: true, data: item, message: 'Đã thêm vào danh sách yêu thích' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thêm vào wishlist',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * DELETE /api/buyer/v1/wishlist/:bikeId
 * Xóa xe khỏi danh sách yêu thích.
 */
export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const bikeId = req.params.bikeId as string;

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const existing = await db.query.wishlists.findFirst({
      where: and(eq(wishlists.userId, userId), eq(wishlists.bikeId, bikeId)),
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Xe không có trong danh sách yêu thích' });
    }

    await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.bikeId, bikeId)));

    res.status(200).json({ success: true, message: 'Đã xóa khỏi danh sách yêu thích' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa khỏi wishlist',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= REPORTS =============

/**
 * POST /api/buyer/v1/reports
 * Buyer báo cáo vi phạm (xe hoặc người dùng).
 */
export const submitReport = async (req: Request, res: Response) => {
  try {
    const reporterId = req.user!.userId;
    const { reportedUserId, reportedBikeId, reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: reason, description' });
    }

    if (!reportedUserId && !reportedBikeId) {
      return res.status(400).json({
        success: false,
        message: 'Phải cung cấp ít nhất reportedUserId hoặc reportedBikeId',
      });
    }

    const [newReport] = await db
      .insert(reports)
      .values({
        reporterId,
        reportedUserId: reportedUserId || null,
        reportedBikeId: reportedBikeId || null,
        reason,
        description,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newReport,
      message: 'Báo cáo đã được gửi, admin sẽ xem xét trong thời gian sớm nhất',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi báo cáo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= REVIEWS =============

/**
 * POST /api/buyer/v1/reviews
 * Buyer đánh giá seller sau khi giao dịch hoàn tất.
 */
export const addReview = async (req: Request, res: Response) => {
  try {
    const reviewerId = req.user!.userId;
    const { sellerId, transactionId, rating, comment } = req.body;

    if (!sellerId || !rating) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: sellerId, rating' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5' });
    }

    if (transactionId) {
      const tx = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, transactionId),
          eq(transactions.buyerId, reviewerId),
          eq(transactions.status, 'completed')
        ),
      });

      if (!tx) {
        return res.status(400).json({
          success: false,
          message: 'Giao dịch không tồn tại, chưa hoàn tất, hoặc không thuộc về bạn',
        });
      }

      const existingReview = await db.query.reviews.findFirst({
        where: and(eq(reviews.transactionId, transactionId), eq(reviews.reviewerId, reviewerId)),
      });

      if (existingReview) {
        return res.status(400).json({ success: false, message: 'Bạn đã đánh giá giao dịch này rồi' });
      }
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        reviewerId,
        sellerId,
        transactionId: transactionId || null,
        rating: parseInt(rating),
        comment: comment || null,
      })
      .returning();

    res.status(201).json({ success: true, data: newReview, message: 'Đánh giá đã được gửi thành công' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi đánh giá',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= MESSAGES (BUYER) =============

/**
 * POST /api/buyer/v1/messages/:sellerId
 * Buyer gửi tin nhắn cho seller về một chiếc xe.
 */
export const sendMessageToSeller = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const sellerId = req.params.sellerId as string;
    const { content, bikeId } = req.body;

    if (!UUID_REGEX.test(sellerId)) {
      return res.status(400).json({ success: false, message: 'ID seller không đúng định dạng' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống' });
    }

    if (sellerId === buyerId) {
      return res.status(400).json({ success: false, message: 'Không thể gửi tin nhắn cho chính mình' });
    }

    const [sellerRow] = await db.select({ id: users.id }).from(users).where(eq(users.id, sellerId)).limit(1);
    if (!sellerRow) {
      return res.status(400).json({ success: false, message: 'Seller không tồn tại trong hệ thống' });
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
          message: 'Xe (bikeId) không tồn tại. Bỏ bikeId hoặc dùng id xe thật',
        });
      }
      if (bikeRow.sellerId !== sellerId) {
        return res.status(400).json({
          success: false,
          message: 'Xe này không thuộc seller bạn đang nhắn tin',
        });
      }
      resolvedBikeId = bid;
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: buyerId,
        receiverId: sellerId,
        bikeId: resolvedBikeId,
        content: content.trim(),
        isRead: false,
      })
      .returning();

    res.status(201).json({ success: true, data: newMessage, message: 'Tin nhắn đã được gửi cho seller' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/buyer/v1/messages/:sellerId
 * Lấy lịch sử tin nhắn với seller.
 */
export const getMessageWithSeller = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const sellerId = req.params.sellerId as string;
    const { bikeId, page = 1, limit = 30 } = req.query;

    if (!UUID_REGEX.test(sellerId)) {
      return res.status(400).json({ success: false, message: 'ID seller không đúng định dạng' });
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 30;
    const offset = (pageNum - 1) * limitNum;

    const filters: any[] = [
      or(
        and(eq(messages.senderId, buyerId), eq(messages.receiverId, sellerId)),
        and(eq(messages.senderId, sellerId), eq(messages.receiverId, buyerId))
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

    // Đánh dấu tin nhắn từ seller đã đọc
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.receiverId, buyerId), eq(messages.senderId, sellerId), eq(messages.isRead, false)));

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

// ============= BROWSE =============

/**
 * Get recommended bikes (latest approved bikes)
 * Shows approved bikes that haven't been verified yet
 * Verification happens after buyer decides to buy
 */
export const getRecommendedBikes = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const recommendedBikes = await db.query.bikes.findMany({
      where: 
        eq(bikes.status, 'approved'),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(bikes.createdAt)],
      limit: parseInt(limit as string) || 10,
    });

    const response: ApiResponse = {
      success: true,
      data: recommendedBikes,
      message: 'Recommended bikes fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recommended bikes',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
