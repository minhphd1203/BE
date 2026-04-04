import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, categories, transactions, wishlists, reports, messages, reviews, users, reportReasons } from '../db/schema';
import { desc, eq, and, ilike, lte, gte, or, inArray, ne, type SQL } from 'drizzle-orm';
import { ApiResponse } from '../models';
import { TRANSACTION_TYPE_OPTIONS, TRANSACTION_TYPES } from '../constants/transactionTypes';
import { mapTransactionsWithShippingAlias, withShippingAddressAlias } from '../utils/transactionResponse';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRANSACTION_ADDRESS_MAX_LEN = 2000;
const TRANSACTION_FULL_NAME_MAX_LEN = 255;
const TRANSACTION_PHONE_MAX_LEN = 20;
const TRANSACTION_EMAIL_MAX_LEN = 255;

function parseTransactionAddressInput(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > TRANSACTION_ADDRESS_MAX_LEN) {
    return { ok: false, message: `Địa chỉ không quá ${TRANSACTION_ADDRESS_MAX_LEN} ký tự` };
  }
  return { ok: true, value: t || null };
}

function parseTransactionFullNameInput(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > TRANSACTION_FULL_NAME_MAX_LEN) {
    return { ok: false, message: `Họ tên không quá ${TRANSACTION_FULL_NAME_MAX_LEN} ký tự` };
  }
  return { ok: true, value: t || null };
}

function parseTransactionPhoneInput(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > TRANSACTION_PHONE_MAX_LEN) {
    return { ok: false, message: `Số điện thoại không quá ${TRANSACTION_PHONE_MAX_LEN} ký tự` };
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10) {
    return { ok: false, message: 'Số điện thoại phải có ít nhất 10 chữ số' };
  }
  return { ok: true, value: t || null };
}

function parseTransactionEmailInput(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > TRANSACTION_EMAIL_MAX_LEN) {
    return { ok: false, message: `Email không quá ${TRANSACTION_EMAIL_MAX_LEN} ký tự` };
  }
  if (!t.includes('@')) {
    return { ok: false, message: 'Email không hợp lệ' };
  }
  return { ok: true, value: t || null };
}

function resolveTransactionAddressRaw(body: Record<string, unknown>): unknown {
  const a = body.address;
  const s = body.shippingAddress;
  if (a !== undefined && a !== null && String(a).trim() !== '') return a;
  if (s !== undefined && s !== null && String(s).trim() !== '') return s;
  return a !== undefined ? a : s;
}

// ============= SEARCH & BROWSE BIKES =============

/**
 * Get all categories
 * Public endpoint: không cần JWT, ai cũng gọi được
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    const allCategories = await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)],
    });

    const response: ApiResponse = {
      success: true,
      data: allCategories,
      message: 'Categories fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Search bikes with filters (brand, model, price range, condition, etc.)
 * Public: không cần JWT — ai cũng gọi được. Có token thì thêm xe reserved liên quan tài khoản.
 * Returns: minimal bike info for list view (title, price, images, status)
 * Chỉ hiển thị xe APPROVED (đã duyệt đăng bán công khai); khách không thấy tin pending/rejected.
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
    const userId = req.user?.userId;
    const {
      brand,
      model,
      title,
      categoryId,
      minPrice,
      maxPrice,
      condition,
      color,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    // Validate and normalize search parameters
    const normalizedBrand = brand ? String(brand).trim() : null;
    const normalizedModel = model ? String(model).trim() : null;
    const normalizedTitle = title ? String(title).trim() : null;

    // Build optional filters
    const optionalFilters: SQL[] = [];
    
    // If any search keywords provided, use OR logic across all fields
    if (normalizedBrand || normalizedModel || normalizedTitle) {
      const filters: SQL[] = [];
      
      if (normalizedBrand) {
        filters.push(ilike(bikes.brand, `%${normalizedBrand}%`));
      }
      
      if (normalizedModel) {
        filters.push(ilike(bikes.model, `%${normalizedModel}%`));
      }
      
      if (normalizedTitle) {
        filters.push(ilike(bikes.title, `%${normalizedTitle}%`));
      }
      
      if (filters.length > 0) {
        const orFilter = or(...filters);
        if (orFilter) {
          optionalFilters.push(orFilter);
        }
      }
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

    if (categoryId) {
      optionalFilters.push(eq(bikes.categoryId, categoryId as string));
    }

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

    // Khách (chưa đăng nhập): chỉ thấy xe đã duyệt công khai (approved).
    // Đã đăng nhập: thêm xe reserved của mình (seller) hoặc xe đã đặt cọc xong (buyer).
    // Hidden bikes: chỉ visible cho seller (chủ sở hữu), không visible cho buyer nào khác
    const statusFilterParts: SQL[] = [eq(bikes.status, 'approved')];

    if (userId) {
      // Include own hidden bikes (only for the owner)
      const ownHidden = and(eq(bikes.status, 'hidden'), eq(bikes.sellerId, userId));
      if (ownHidden) statusFilterParts.push(ownHidden);

      const allReservedBikes = await db.query.bikes.findMany({
        where: eq(bikes.status, 'reserved'),
        columns: { id: true },
      });

      const myReservedBikeIds: string[] = [];
      if (allReservedBikes.length > 0) {
        const reservedBikeIds = allReservedBikes.map((b) => b.id);
        const myDeposits = await db.query.transactions.findMany({
          where: and(
            eq(transactions.buyerId, userId),
            eq(transactions.transactionType, 'deposit'),
            eq(transactions.status, 'completed'),
            inArray(transactions.bikeId, reservedBikeIds)
          ),
          columns: { bikeId: true },
        });
        myReservedBikeIds.push(...myDeposits.map((t) => t.bikeId));
      }

      const sellerReserved = and(eq(bikes.status, 'reserved'), eq(bikes.sellerId, userId));
      if (sellerReserved) statusFilterParts.push(sellerReserved);
      if (myReservedBikeIds.length > 0) {
        const buyerReserved = and(eq(bikes.status, 'reserved'), inArray(bikes.id, myReservedBikeIds));
        if (buyerReserved) statusFilterParts.push(buyerReserved);
      }
    } else {
      // Guest: can only see approved bikes
    }

    const finalStatusFilter = or(...statusFilterParts);

    const finalFilters =
      optionalFilters.length > 0 ? [finalStatusFilter, ...optionalFilters] : [finalStatusFilter];

    // Calculate offset for pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Fetch total count
    const countResult = await db
      .select({ count: bikes.id })
      .from(bikes)
      .where(and(...finalFilters));

    const total = countResult.length;

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
 * Chi tiết tin đăng.
 * - Khách: chỉ xe approved (đang bán công khai).
 * - Đã đăng nhập: seller xem được mọi trạng thái tin của chính mình; buyer có thể xem xe reserved nếu đã đặt cọc xong (khớp search).
 */
export const getBikeDetail = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;
    const userId = req.user?.userId;

    // Validate UUID format
    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bike ID format',
      });
    }

    const bike = await db.query.bikes.findFirst({
      where: eq(bikes.id, bikeId),
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
            reason: true,
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

    const isOwner = !!userId && bike.sellerId === userId;
    let canView = bike.status === 'approved';
    
    // Sellers can always view their own bikes (any status)
    if (!canView && isOwner) {
      canView = true;
    }

    // Reserved or Sold bikes: buyer can view if they have transaction or wishlist
    if (!canView && userId && (bike.status === 'reserved' || bike.status === 'sold')) {
      // Check if buyer has completed transaction on this bike
      const hasTransaction = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.bikeId, bikeId),
          eq(transactions.buyerId, userId),
          or(
            eq(transactions.transactionType, 'deposit'),
            eq(transactions.transactionType, 'full_payment'),
            eq(transactions.transactionType, 'remaining_payment')
          ),
          eq(transactions.status, 'completed')
        ),
      });
      
      if (hasTransaction) {
        canView = true;
      } else {
        // Check if bike is in buyer's wishlist
        const inWishlist = await db.query.wishlists.findFirst({
          where: and(
            eq(wishlists.userId, userId),
            eq(wishlists.bikeId, bikeId)
          ),
        });
        
        if (inWishlist) {
          canView = true;
        }
      }
    }

    if (!canView) {
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
    const userRole = req.user!.role;

    // Only buyers can create transactions
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot purchase bikes' });
    }

    const { bikeId, amount, transactionType = 'full_payment', paymentMethod, notes } = req.body as {
      bikeId?: string;
      amount?: number;
      transactionType?: string;
      paymentMethod?: string;
      notes?: string;
    };
    const body = req.body as Record<string, unknown>;

    const parsedAddress = parseTransactionAddressInput(resolveTransactionAddressRaw(body));
    if (!parsedAddress.ok) {
      return res.status(400).json({ success: false, message: parsedAddress.message });
    }
    const parsedFullName = parseTransactionFullNameInput(body.fullName);
    if (!parsedFullName.ok) {
      return res.status(400).json({ success: false, message: parsedFullName.message });
    }
    const parsedPhone = parseTransactionPhoneInput(body.buyerPhone);
    if (!parsedPhone.ok) {
      return res.status(400).json({ success: false, message: parsedPhone.message });
    }
    const parsedEmail = parseTransactionEmailInput(body.buyerEmail);
    if (!parsedEmail.ok) {
      return res.status(400).json({ success: false, message: parsedEmail.message });
    }

    if (!bikeId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: bikeId' });
    }

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    if (!TRANSACTION_TYPE_OPTIONS.includes(transactionType as (typeof TRANSACTION_TYPE_OPTIONS)[number])) {
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

    // Kiểm tra buyer đã có giao dịch pending/approved cho xe này chưa
    // Ngăn chặn nhiều transaction cùng lúc cho 1 bike
    const existingTransaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        inArray(transactions.status, ['pending', 'approved'])
      ),
    });

    if (existingTransaction) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bạn đã có đơn đặt mua đang chờ xử lý cho xe này. Vui lòng hoàn tất hoặc hủy đơn trước.' 
      });
    }

    // Kiểm tra xe có transaction pending/approved từ buyer khác không (bike đã hidden)
    const otherBuyerTransaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.bikeId, bikeId),
        ne(transactions.buyerId, buyerId),
        inArray(transactions.status, ['pending', 'approved'])
      ),
    });

    if (otherBuyerTransaction) {
      return res.status(400).json({ 
        success: false, 
        message: 'Xe này đã được buyer khác đặt hàng. Vui lòng chọn xe khác.' 
      });
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
        address: parsedAddress.value,
        fullName: parsedFullName.value,
        buyerPhone: parsedPhone.value,
        buyerEmail: parsedEmail.value,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: withShippingAddressAlias(newTransaction),
      message: transactionType === TRANSACTION_TYPES.FULL_PAYMENT 
        ? 'Tạo đơn giao dịch đầy đủ thành công. Đang chờ seller xác nhận để thanh toán.'
        : 'Tạo đơn đặt cọc thành công. Đang chờ seller xác nhận để thanh toán.',
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
    const userRole = req.user!.role;

    // Only buyers can view their transactions
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot view buyer transactions' });
    }

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
      data: mapTransactionsWithShippingAlias(myTransactions),
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
 * GET /api/buyer/v1/transactions/:id
 * Buyer xem chi tiết một đơn đặt mua.
 */
export const getTransactionDetail = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const transactionId = req.params.id as string;

    if (!UUID_REGEX.test(transactionId)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không đúng định dạng' });
    }

    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, transactionId), eq(transactions.buyerId, buyerId)),
      columns: {
        id: true,
        buyerId: true,
        bikeId: true,
        sellerId: true,
        status: true,
        transactionType: true,
        amount: true,
        remainingBalance: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        address: true,
        fullName: true,
      },
      with: {
        bike: {
          columns: {
            id: true,
            title: true,
            brand: true,
            model: true,
            year: true,
            price: true,
            images: true,
            description: true,
            condition: true,
            mileage: true,
            color: true,
          },
        },
        seller: {
          columns: { id: true, name: true, avatar: true, phone: true },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn mua\nĐơn mua mã không hợp lệ hoặc không thuộc tài khoản của bạn.',
      });
    }

    res.status(200).json({
      success: true,
      data: withShippingAddressAlias(transaction),
      message: 'Chi tiết giao dịch fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết giao dịch',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * DELETE /api/buyer/v1/transactions/:id
 * Buyer hủy đơn đặt mua (chỉ khi còn pending hoặc approved, trước khi hoàn tất thanh toán).
 */
export const cancelTransaction = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const userRole = req.user!.role;

    // Only buyers can cancel transactions
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot cancel buyer transactions' });
    }

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

    // Buyer chỉ có thể hủy giao dịch từ pending (chưa phê duyệt) hoặc approved (chờ thanh toán)
    if (!['pending', 'approved'].includes(existingTransaction.status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể hủy giao dịch ở trạng thái '${existingTransaction.status}'. Chỉ có thể hủy trước khi thanh toán hoàn tất.`,
      });
    }

    const [cancelled] = await db
      .update(transactions)
      .set({ status: 'cancelled' })
      .where(and(eq(transactions.id, id), eq(transactions.buyerId, buyerId)))
      .returning();

    res.status(200).json({
      success: true,
      data: withShippingAddressAlias(cancelled),
      message: 'Đơn đặt mua đã được hủy',
    });
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
    const userRole = req.user!.role;

    // Only buyers can have wishlist
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot have wishlist' });
    }

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
    const userRole = req.user!.role;

    // Only buyers can add to wishlist
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot add to wishlist' });
    }

    const bikeId = req.params.bikeId as string;

    if (!UUID_REGEX.test(bikeId)) {
      return res.status(400).json({ success: false, message: 'ID xe không đúng định dạng' });
    }

    const bike = await db.query.bikes.findFirst({ where: eq(bikes.id, bikeId) });
    if (!bike) {
      return res.status(404).json({ success: false, message: 'Xe không tồn tại' });
    }

    // Cannot add hidden bikes (owner's downgraded bikes) to wishlist
    if (bike.status === 'hidden' && bike.sellerId === userId) {
      return res.status(400).json({ success: false, message: 'Không thể thêm xe ẩn vào danh sách yêu thích' });
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
    const userRole = req.user!.role;

    // Only buyers can remove from wishlist
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot remove from wishlist' });
    }

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
 * GET /api/buyer/v1/sellers/:sellerId/bikes
 * Fetch all bikes from a seller for the report form.
 * Allows buyer to choose which bike has violation when reporting seller.
 */
export const getSellerBikesForReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.sellerId as string;

    if (!UUID_REGEX.test(sellerId)) {
      return res.status(400).json({ success: false, message: 'ID seller không đúng định dạng' });
    }

    // Verify seller exists
    const seller = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
      columns: { id: true, name: true },
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller không tồn tại' });
    }

    // Fetch only APPROVED bikes from this seller (for report selection)
    const sellerBikes = await db.query.bikes.findMany({
      where: and(
        eq(bikes.sellerId, sellerId),
        eq(bikes.status, 'approved') // Only available bikes can be reported
      ),
      columns: {
        id: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        price: true,
        condition: true,
        status: true,
        createdAt: true,
      },
      orderBy: [desc(bikes.createdAt)],
    });

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller.id,
          name: seller.name,
        },
        bikes: sellerBikes,
      },
      message: 'Seller bikes fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách xe của seller',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/buyer/v1/report-reasons
 * Buyer fetches available report violation types for the report form dropdown
 */
export const getReportReasons = async (req: Request, res: Response) => {
  try {
    const reasons = await db.query.reportReasons.findMany({
      columns: {
        id: true,
        name: true,
        description: true,
        isSystemAutoResolvable: true,
      },
      orderBy: [desc(reportReasons.createdAt)],
    });

    // Add "Others" option for violations outside system scope
    const reasonsWithOthers = [
      ...reasons,
      {
        id: 'others',
        name: 'Others (Khác)',
        description: 'Loại vi phạm khác không có trong danh sách (vui lòng mô tả chi tiết trong phần mô tả)',
        isSystemAutoResolvable: false,
      },
    ];

    res.status(200).json({
      success: true,
      data: reasonsWithOthers,
      message: 'Report reasons fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách loại vi phạm',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/buyer/v1/reports
 * Buyer báo cáo vi phạm (xe hoặc người dùng).
 */
export const submitReport = async (req: Request, res: Response) => {
  try {
    const reporterId = req.user!.userId;
    const userRole = req.user!.role;

    // Only buyers can submit reports
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot submit reports' });
    }

    const { reportedUserId, reportedBikeId, reasonId, reasonText, description } = req.body;

    // Validate: reasonId must be provided
    if (!reasonId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Chọn loại vi phạm (reasonId) là bắt buộc' 
      });
    }

    if (!description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mô tả chi tiết (description) là bắt buộc' 
      });
    }

    if (!reportedUserId && !reportedBikeId) {
      return res.status(400).json({
        success: false,
        message: 'Phải cung cấp ít nhất reportedUserId hoặc reportedBikeId',
      });
    }

    // Cannot report on hidden bikes (owner's downgraded bikes)
    if (reportedBikeId) {
      const reportedBike = await db.query.bikes.findFirst({
        where: eq(bikes.id, reportedBikeId),
        columns: { status: true, sellerId: true },
      });
      if (reportedBike?.status === 'hidden' && reportedBike.sellerId === reporterId) {
        return res.status(400).json({ success: false, message: 'Không thể báo cáo xe ẩn của chính mình' });
      }
    }

    // Check if reasonId is "others" (special case for violations outside system)
    const isOthers = reasonId === 'others';
    
    if (isOthers && !reasonText) {
      return res.status(400).json({
        success: false,
        message: 'Nếu chọn "Others", phải cung cấp reasonText (mô tả vi phạm)',
      });
    }

    // If reporting a bike, fetch the seller ID from the bike
    let finalReportedUserId = reportedUserId || null;
    
    if (reportedBikeId) {
      const bike = await db.query.bikes.findFirst({
        where: eq(bikes.id, reportedBikeId),
        columns: {
          sellerId: true,
        },
      });

      if (!bike) {
        return res.status(404).json({
          success: false,
          message: 'Xe không tồn tại',
        });
      }

      finalReportedUserId = bike.sellerId;
    }

    // If not "others", validate that reasonId exists in database
    let actualReasonId = null;
    if (!isOthers) {
      const reason = await db.query.reportReasons.findFirst({
        where: eq(reportReasons.id, reasonId),
      });

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Loại vi phạm không hợp lệ',
        });
      }

      actualReasonId = reasonId;
    }

    const [newReport] = await db
      .insert(reports)
      .values({
        reporterId,
        reportedUserId: finalReportedUserId,
        reportedBikeId: reportedBikeId || null,
        reasonId: actualReasonId,
        reasonText: reasonText || null,
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

/**
 * GET /api/buyer/v1/reports
 * Buyer xem danh sách các báo cáo mà họ đã tạo.
 */
export const getMyReports = async (req: Request, res: Response) => {
  try {
    const reporterId = req.user!.userId;
    const userRole = req.user!.role;

    // Only buyers can view their reports
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot view buyer reports' });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filters: any[] = [eq(reports.reporterId, reporterId)];
    if (status) filters.push(eq(reports.status, status as string));

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await db.select({ id: reports.id }).from(reports).where(and(...filters));
    const total = countResult.length;

    const myReports = await db.query.reports.findMany({
      where: and(...filters),
      with: {
        reportedUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        reportedBike: {
          columns: {
            id: true,
            title: true,
            brand: true,
            model: true,
          },
        },
        resolver: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(reports.createdAt)],
      limit: limitNum,
      offset,
    });

    res.status(200).json({
      success: true,
      data: myReports,
      message: 'Danh sách báo cáo fetched successfully',
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách báo cáo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= REVIEWS =============

/**
 * POST /api/buyer/v1/reviews
 * Buyer đánh giá seller sau khi giao dịch hoàn tất.
 * CONSTRAINT: Buyer must provide a specific completed transaction ID to rate
 */
export const addReview = async (req: Request, res: Response) => {
  try {
    const reviewerId = req.user!.userId;
    const userRole = req.user!.role;

    // Only buyers can add reviews
    if (userRole === 'seller') {
      return res.status(403).json({ success: false, message: 'Sellers cannot add reviews' });
    }

    const { sellerId, transactionId, rating, comment } = req.body;

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: sellerId' });
    }
    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: transactionId (Bạn phải chọn một giao dịch để đánh giá)' });
    }
    if (!rating && rating !== 0) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: rating' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5' });
    }

    // CONSTRAINT: Validate that the transaction exists, is completed, and belongs to this buyer and seller
    const tx = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.buyerId, reviewerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed')
      ),
    });

    if (!tx) {
      return res.status(403).json({
        success: false,
        message: 'Giao dịch không tồn tại, chưa hoàn tất, hoặc không thuộc về bạn và seller này. Bạn chỉ có thể đánh giá seller sau khi giao dịch hoàn tất.',
      });
    }

    // Check if already reviewed this transaction
    const existingReview = await db.query.reviews.findFirst({
      where: and(eq(reviews.transactionId, transactionId), eq(reviews.reviewerId, reviewerId)),
    });

    if (existingReview) {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá giao dịch này rồi' });
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        reviewerId,
        sellerId,
        transactionId: transactionId,
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

// ============= BROWSE =============

/**
 * Get recommended bikes (latest approved bikes)
 * Shows approved bikes to all users
 * Sellers can also see their own hidden bikes
 */
export const getRecommendedBikes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = 10 } = req.query;

    // Include hidden bikes only for their owner (seller)
    const statusFilter = userId 
      ? or(eq(bikes.status, 'approved'), and(eq(bikes.status, 'hidden'), eq(bikes.sellerId, userId)))
      : eq(bikes.status, 'approved');

    const recommendedBikes = await db.query.bikes.findMany({
      where: statusFilter,
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
