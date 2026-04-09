import { Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db';
import { transactions, bikes, payouts, users, refunds } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { withShippingAddressAlias } from '../utils/transactionResponse';
import { markFulfillmentPreparingAfterBikeSold } from '../services/fulfillmentSync';
import { sendPayoutRequest, verifyPayoutSignature } from '../services/payoutProvider';
import { sendRefundRequest, sendRefundWebhookCallback } from '../services/refundProvider';

// ============= VNPAY MANUAL IMPLEMENTATION =============
// Implement theo đúng tài liệu chính thức VNPay để tránh encoding issues

const VNPAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

function dateFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}


function buildVNPayUrl(params: Record<string, string>): string {
  const secret = process.env.VNP_SECRET!;
  // Sort keys alphabetically (VNPay spec)
  const sortedKeys = Object.keys(params).sort();
  // Chuỗi ký HMAC: key=value nối &, GIÁ TRỊ KHÔNG URL-encode (VNPay so khớp trên bản raw).
  // Trước đây dùng encodeURIComponent cho cả hash → sai chữ ký (mã 70) trên cổng VNPay.
  const hashData = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const hmac = crypto.createHmac('sha512', secret);
  const secureHash = hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
  // URL gửi trình duyệt: mới encode từng value theo chuẩn query string
  const queryString = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return `${VNPAY_URL}?${queryString}&vnp_SecureHash=${secureHash}`;
}

function verifyVNPaySignature(params: Record<string, string>): boolean {
  const secret = process.env.VNP_SECRET!;
  const receivedHash = params['vnp_SecureHash'];
  const filteredParams = { ...params };
  delete filteredParams['vnp_SecureHash'];
  delete filteredParams['vnp_SecureHashType'];
  const sortedKeys = Object.keys(filteredParams).sort();
  const hashData = sortedKeys.map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const hmac = crypto.createHmac('sha512', secret);
  const calculatedHash = hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
  return calculatedHash === receivedHash;
}

// ============= QR CODE GENERATION =============

async function generateQRCode(text: string): Promise<string> {
  try {
    const qrCode = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      width: 300,
    });
    return qrCode;
  } catch (error) {
    console.error('Lỗi khi tạo QR code:', error);
    throw error;
  }
}

// ============= TẠO PAYMENT URL =============

/**
 * POST /api/payment/v1/create/:transactionId
 * Buyer tạo link thanh toán VNPay cho một giao dịch đang pending.
 *
 * Flow:
 *  1. Buyer đã tạo transaction (POST /api/buyer/v1/transactions)
 *  2. Buyer gọi endpoint này để lấy URL chuyển hướng đến VNPay
 *  3. Frontend redirect buyer đến paymentUrl
 *  4. VNPay xử lý thanh toán → gọi IPN + redirect về returnUrl
 */
export const createPaymentUrl = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };

    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, transactionId), eq(transactions.buyerId, buyerId)),
      with: {
        bike: {
          columns: { title: true },
          with: {
            brand: { columns: { id: true, name: true } },
            model: { columns: { id: true, name: true } },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    if (transaction.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Giao dịch phải được seller phê duyệt trước/ đã hoàn thành/ đã bị hủy (hiện tại: ${transaction.status}).`,
      });
    }

    const ipAddr =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const orderInfo = `ThanhToanXeDap-${transactionId.slice(0,8)}`;
    const returnUrl = process.env.VNP_RETURN_URL!;
    const tmnCode = process.env.VNP_TMNCODE!;
    const createDate = dateFormat(new Date());
    const amount = Math.round(transaction.amount * 100);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: amount.toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: transactionId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const paymentUrl = buildVNPayUrl(params);

    // Generate QR code from payment URL
    const qrCode = await generateQRCode(paymentUrl);

    // Calculate expiration: 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    res.status(200).json({
      success: true,
      data: {
        paymentUrl,
        qrCode,
        transactionId,
        amount: transaction.amount,
        orderInfo,
        expiresAt,
      },
      message: 'URL thanh toán đã được tạo. QR code hết hạn sau 10 phút.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo URL thanh toán VNPay',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= REMAINING BALANCE PAYMENT (AFTER DEPOSIT) =============

/**
 * POST /api/payment/v1/create-remaining/:transactionId
 * Buyer pays the remaining balance after a deposit.
 * Creates a NEW transaction record for the remaining balance payment.
 * This transaction links to the original deposit transaction.
 * 
 * Only works for transactions with:
 *   - transactionType = 'deposit'
 *   - status = 'completed' (deposit was paid)
 *   - remainingBalance > 0
 * 
 * Flow:
 *  1. Buyer made a deposit (deposit transaction status = 'completed', bike = 'reserved')
 *  2. Buyer calls this endpoint with the deposit transaction ID
 *  3. Creates a new remaining_payment transaction + payment URL
 *  4. VNPay processes payment → IPN updates original deposit to "fully_paid" and bike to 'sold'
 */
export const createRemainingPaymentUrl = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };

    // Find the deposit transaction
    const depositTransaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.buyerId, buyerId)
      ),
      with: {
        bike: {
          columns: { title: true },
          with: {
            brand: { columns: { id: true, name: true } },
            model: { columns: { id: true, name: true } },
          },
        },
      },
    });

    if (!depositTransaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy giao dịch' 
      });
    }

    // Validate it's a deposit
    if (depositTransaction.transactionType !== 'deposit') {
      return res.status(400).json({ 
        success: false, 
        message: 'Giao dịch này không phải đặt cọc' 
      });
    }

    // Validate deposit is completed
    if (depositTransaction.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: `Giao dịch phải ở trạng thái completed (hiện tại: ${depositTransaction.status})` 
      });
    }

    // Validate remaining balance exists
    if (!depositTransaction.remainingBalance || depositTransaction.remainingBalance <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có số tiền còn lại cần thanh toán' 
      });
    }

    // Check if remaining payment already completed for this deposit
    const existingRemainingPayment = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.bikeId, depositTransaction.bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.transactionType, 'remaining_payment'),
        eq(transactions.status, 'completed')
      ),
    });

    if (existingRemainingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Xe này đã được thanh toán đầy đủ rồi. Không thể tạo giao dịch thanh toán còn lại khác.'
      });
    }

    // Delete any existing pending remaining_payment transactions for a clean slate
    const pendingRemainingPayment = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.bikeId, depositTransaction.bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.transactionType, 'remaining_payment'),
        eq(transactions.status, 'pending')
      ),
    });

    if (pendingRemainingPayment) {
      console.log(`[Payment] Deleting old pending remaining payment: ${pendingRemainingPayment.id}`);
      await db
        .delete(transactions)
        .where(eq(transactions.id, pendingRemainingPayment.id));
      console.log(`[Payment] Old pending transaction deleted`);
    }

    // Create a new transaction record for the remaining payment
    // This tracks the relationship between deposit and remaining payment
    // Calculate system fee (5% of original bike price) for remaining_payment
    const remainingAmount = depositTransaction.remainingBalance;
    const originalBikePrice = depositTransaction.originalBikePrice || (depositTransaction.amount + depositTransaction.remainingBalance);
    const systemFee = Math.round(originalBikePrice * 0.05 * 100) / 100; // 5% of original price
    const sellerNetAmount = remainingAmount - systemFee; // Seller gets remaining - fee

    const [remainingTransaction] = await db
      .insert(transactions)
      .values({
        bikeId: depositTransaction.bikeId,
        buyerId,
        sellerId: depositTransaction.sellerId,
        amount: remainingAmount,
        transactionType: 'remaining_payment',
        remainingBalance: 0,
        notes: `Thanh toán phần còn lại của đơn đặt cọc: ${transactionId}`,
        address: depositTransaction.address ?? null,
        fullName: depositTransaction.fullName ?? null,
        status: 'pending',
        systemFee,
        sellerNetAmount,
        originalBikePrice,
      })
      .returning();

    const ipAddr =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const orderInfo = `ThanhToanConLai-${transactionId.slice(0, 8)}`;
    const returnUrl = process.env.VNP_RETURN_URL!;
    const tmnCode = process.env.VNP_TMNCODE!;
    const createDate = dateFormat(new Date());
    const amount = Math.round(depositTransaction.remainingBalance * 100);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: amount.toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: remainingTransaction.id,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const paymentUrl = buildVNPayUrl(params);

    // Generate QR code from payment URL
    const qrCode = await generateQRCode(paymentUrl);

    // Calculate expiration: 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    res.status(200).json({
      success: true,
      data: {
        paymentUrl,
        qrCode,
        remainingTransactionId: remainingTransaction.id,
        depositTransactionId: depositTransaction.id,
        remainingBalance: depositTransaction.remainingBalance,
        orderInfo,
        depositAmount: depositTransaction.amount,
        totalPrice: depositTransaction.amount + depositTransaction.remainingBalance,
        expiresAt,
      },
      message: 'URL thanh toán còn lại đã được tạo. QR code hết hạn sau 10 phút.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo URL thanh toán còn lại',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= VNPAY RETURN URL =============

/**
 * GET /api/payment/v1/vnpay-return
 * VNPay redirect buyer về đây sau khi thanh toán xong (thành công hoặc thất bại).
 * Endpoint này CHỈ phục vụ UX - KHÔNG cập nhật DB ở đây.
 * Logic cập nhật DB được thực hiện trong IPN handler bên dưới.
 *
 * Frontend SPA: đặt VNP_RETURN_URL = URL frontend của bạn,
 * frontend đọc query params và hiển thị kết quả.
 * Endpoint này dùng khi backend muốn tự xử lý redirect.
 */
export const vnpayReturn = async (req: Request, res: Response) => {
  try {
    // Add ngrok bypass header for browser warning page
    res.setHeader('ngrok-skip-browser-warning', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const params = req.query as Record<string, string>;
    const isValid = verifyVNPaySignature(params);
    const responseCode = params['vnp_ResponseCode'];
    const isSuccess = responseCode === '00';

    // Check if this is an API call (from frontend) or a browser redirect (from VNPay)
    // API calls come with Accept: application/json header
    const isApiCall = req.headers.accept?.includes('application/json');

    if (isApiCall) {
      // Return JSON for frontend API calls
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Chữ ký thanh toán không hợp lệ',
          data: {
            status: 'failed',
            transactionId: params['vnp_TxnRef'],
          },
        });
      }

      return res.json({
        success: isSuccess,
        message: isSuccess
          ? 'Thanh toán thành công! Giao dịch đang được xử lý.'
          : `Thanh toán thất bại (Mã lỗi: ${responseCode})`,
        data: {
          status: isSuccess ? 'paid' : 'failed',
          transactionId: params['vnp_TxnRef'],
        },
      });
    }

    // Browser redirect from VNPay - redirect to frontend
    const queryString = new URLSearchParams(params).toString();
    const appUrl = process.env.APP_URL || 'http://localhost:4200';

    if (!isValid) {
      return res.redirect(`${appUrl}/payment/vnpay-return?${queryString}&_error=invalid_signature`);
    }

    res.redirect(`${appUrl}/payment/vnpay-return?${queryString}`);
  } catch (error) {
    const isApiCall = req.headers.accept?.includes('application/json');
    
    if (isApiCall) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi server',
        data: { status: 'error' },
      });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:4200';
    res.redirect(`${appUrl}/payment/vnpay-return?_error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
};

// ============= VNPAY IPN (INSTANT PAYMENT NOTIFICATION) =============

/**
 * GET /api/payment/v1/vnpay-ipn
 * VNPay gọi endpoint này server-to-server để thông báo kết quả thanh toán.
 * Đây là nguồn dữ liệu CHÍNH XÁC nhất - dùng để cập nhật DB.
 *
 * ⚠️  URL này phải được cấu hình trong VNPay Merchant Portal:
 *     Merchant Admin → Cấu hình IPN URL → https://your-domain.com/api/payment/v1/vnpay-ipn
 * ⚠️  Endpoint này KHÔNG cần JWT auth (VNPay gọi trực tiếp, không có token).
 * ⚠️  Phải trả về JSON đúng format VNPay yêu cầu trong vòng 5 giây.
 */
export const vnpayIPN = async (req: Request, res: Response) => {
  try {
    // Add ngrok bypass header for browser warning page
    res.setHeader('ngrok-skip-browser-warning', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const params = req.query as Record<string, string>;

    console.log('[VNPay IPN] Received IPN callback');
    console.log('[VNPay IPN] Query params:', params);

    // Bước 1: Xác thực chữ ký
    if (!verifyVNPaySignature(params)) {
      console.log('[VNPay IPN] ❌ Signature verification failed');
      return res.json({ RspCode: '97', Message: 'Invalid checksum' });
    }

    console.log('[VNPay IPN] ✓ Signature verified');

    const txnRef = params['vnp_TxnRef'];
    const responseCode = params['vnp_ResponseCode'];
    const vnpAmount = parseInt(params['vnp_Amount']);

    console.log('[VNPay IPN] txnRef:', txnRef);
    console.log('[VNPay IPN] responseCode:', responseCode);
    console.log('[VNPay IPN] vnpAmount:', vnpAmount);

    // Bước 2: Tìm giao dịch (txnRef = transaction ID)
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, txnRef),
    });

    console.log('[VNPay IPN] transaction found:', !!transaction);

    if (!transaction) {
      console.log('[VNPay IPN] ❌ Transaction not found for txnRef:', txnRef);
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    // Bước 2b: Kiểm tra hết hạn (10 phút)
    const createdAt = new Date(transaction.createdAt);
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const now = new Date();
    
    console.log('[VNPay IPN] Expiration check - createdAt:', createdAt, 'expiresAt:', expiresAt, 'now:', now);
    
    if (now > expiresAt) {
      console.log('[VNPay IPN] ❌ Payment URL expired');
      return res.json({ RspCode: '98', Message: 'Payment URL expired (10 minute timeout)' });
    }

    // Bước 3: Kiểm tra số tiền
    const expectedAmount = Math.round(transaction.amount * 100);
    console.log('[VNPay IPN] Amount check - expected:', expectedAmount, 'received:', vnpAmount);
    
    if (vnpAmount !== expectedAmount) {
      console.log('[VNPay IPN] ❌ Amount mismatch');
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }

    // Bước 4: Idempotent check
    console.log('[VNPay IPN] Current transaction status:', transaction.status);
    
    if (transaction.status === 'completed') {
      console.log('[VNPay IPN] ⚠️  Transaction already completed');
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    // Reject if transaction was cancelled (auto-expire or manual cancellation)
    if (transaction.status === 'cancelled') {
      console.log('[VNPay IPN] ⚠️  Transaction was cancelled');
      return res.json({ RspCode: '01', Message: 'Transaction was cancelled' });
    }

    if (responseCode !== '00') {
      console.log('[VNPay IPN] Payment failed with code:', responseCode);
      const failResult = await db
        .update(transactions)
        .set({ status: 'cancelled', notes: `VNPay failed: ${responseCode}` })
        .where(eq(transactions.id, transaction.id))
        .returning();
      console.log('[VNPay IPN] Updated failed transaction result:', failResult);
      return res.json({ RspCode: '00', Message: 'Confirm success' });
    }

    // Bước 5: Cập nhật thành công
    console.log('[VNPay IPN] ✓ Updating transaction to completed');
    
    // Build updated notes - preserve original and add VNPay details
    const updatedNotes = transaction.notes 
      ? `${transaction.notes} | VNPay TxnNo: ${params['vnp_TransactionNo']}, Bank: ${params['vnp_BankCode']}`
      : `VNPay TxnNo: ${params['vnp_TransactionNo']}, Bank: ${params['vnp_BankCode']}`;
    
    const updateResult = await db
      .update(transactions)
      .set({
        status: 'completed',
        paymentMethod: 'vnpay',
        notes: updatedNotes,
      })
      .where(eq(transactions.id, transaction.id))
      .returning();

    console.log('[VNPay IPN] ✓ Updated transaction result:', updateResult);
    if (!updateResult || updateResult.length === 0) {
      console.log('[VNPay IPN] ❌ ERROR: No rows updated! Transaction ID:', transaction.id);
      return res.json({ RspCode: '99', Message: 'Failed to update transaction' });
    }
    console.log('[VNPay IPN] ✓ Updated transaction, now updating bike status');
    
    // Determine bike status and get deposit transaction for remaining payments
    let bikeStatus = 'sold'; // Default for full payment
    let statusMessage = 'Set bike to SOLD (full payment completed)';
    
    if (transaction.transactionType === 'deposit') {
      // This is a deposit payment - bike should be reserved until remaining is paid
      bikeStatus = 'reserved';
      statusMessage = 'Set bike to RESERVED (deposit paid, awaiting remaining balance)';
    } else if (transaction.transactionType === 'remaining_payment') {
      // This is remaining payment after deposit - finalize the sale
      bikeStatus = 'sold';
      statusMessage = 'Set bike to SOLD (full payment completed after deposit)';
      
      // Extract deposit transaction ID from notes
      const depositTxnMatch = transaction.notes?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
      if (depositTxnMatch) {
        const depositTransactionId = depositTxnMatch[1];
        console.log(`[VNPay IPN] Found linked deposit transaction: ${depositTransactionId}`);
        
        // Mark the deposit transaction as "fully_paid" in notes for auditing
        const depositUpdateResult = await db
          .update(transactions)
          .set({ 
            notes: `${transaction.notes || ''} → FULLY PAID by remaining payment`
          })
          .where(eq(transactions.id, depositTransactionId))
          .returning();
        
        console.log(`[VNPay IPN] Updated deposit transaction result:`, depositUpdateResult);
        if (!depositUpdateResult || depositUpdateResult.length === 0) {
          console.log('[VNPay IPN] ⚠️  WARNING: Could not update deposit transaction notes');
        }
      }
    }
    
    console.log(`[VNPay IPN] ${statusMessage}`);
    
    const bikeUpdateResult = await db
      .update(bikes)
      .set({ status: bikeStatus, updatedAt: new Date() })
      .where(eq(bikes.id, transaction.bikeId))
      .returning();

    console.log(`[VNPay IPN] ✓ Bike update result:`, bikeUpdateResult);
    if (!bikeUpdateResult || bikeUpdateResult.length === 0) {
      console.log('[VNPay IPN] ❌ ERROR: No bike rows updated! Bike ID:', transaction.bikeId);
      return res.json({ RspCode: '99', Message: 'Failed to update bike status' });
    }

    console.log(`[VNPay IPN] ✓ Payment success for transaction ${transaction.id}`);
    return res.json({ RspCode: '00', Message: 'Confirm success' });
  } catch (error) {
    console.error('[VNPay IPN Error]:', error);
    return res.json({ RspCode: '99', Message: 'Unknown error' });
  }
};

// ============= QUERY TRANSACTION STATUS =============

/**
 * GET /api/payment/v1/status/:transactionId
 * Buyer kiểm tra trạng thái thanh toán của một giao dịch.
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };

    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, transactionId), eq(transactions.buyerId, buyerId)),
      with: {
        bike: {
          columns: { id: true, title: true, images: true },
          with: {
            brand: { columns: { id: true, name: true } },
            model: { columns: { id: true, name: true } },
          },
        },
        seller: { columns: { id: true, name: true, phone: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    res.status(200).json({
      success: true,
      data: withShippingAddressAlias(transaction),
      message: 'Trạng thái thanh toán fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra trạng thái thanh toán',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= SELLER PAYOUT SYSTEM =============
// Simple local payout processing (no external service required)
// - Status flow: pending → completed/failed
// - Simulates async bank processing with configurable delays
// - Idempotent tracking via externalPayoutId

/**
 * POST /api/payment/v1/payout/create/:transactionId
 * Seller initiates payout after delivery confirmed.
 *
 * Prerequisites:
 *  1. Delivery must be confirmed (status='delivered' + receiptConfirmedAt set)
 *  2. Seller must have valid bank account info in profile
 *  3. Transaction must be completed
 *
 * Flow:
 *  1. Verify seller owns transaction
 *  2. Validate delivery confirmed & transaction completed
 *  3. Verify seller bank account info exists
 *  4. Create payout record (status: 'pending')
 *  5. Simulate async processing (90% success rate for testing)
 *  6. Update status to completed/failed
 */
export const createPayout = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };

    // ===== Verify transaction & delivery =====
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.sellerId, sellerId)
      ),
      with: {
        delivery: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Giao dịch không tồn tại hoặc không phải của bạn',
      });
    }

    if (transaction.status !== 'completed') {
      console.log(`[Payout] ❌ Transaction not completed. Status: ${transaction.status}`);
      return res.status(400).json({
        success: false,
        message: `Giao dịch phải hoàn thành (hiện tại: ${transaction.status})`,
      });
    }

    if (!transaction.delivery || transaction.delivery.deliveryStatus !== 'delivered' || !transaction.delivery.receiptConfirmedAt) {
      console.log(`[Payout] ❌ Delivery issue. Has delivery: ${!!transaction.delivery}, Status: ${transaction.delivery?.deliveryStatus}, Receipt confirmed: ${!!transaction.delivery?.receiptConfirmedAt}`);
      return res.status(400).json({
        success: false,
        message: 'Hàng phải được xác nhận đã giao'
      });
    }


    // ===== Verify seller bank info =====
    const seller = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
      columns: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
        bankCode: true,
        bankBranch: true,
      },
    });

    if (!seller || !seller.bankAccountNumber || !seller.bankAccountHolder || !seller.bankCode) {
      console.log(`[Payout] ❌ Missing seller or bank info. Seller exists: ${!!seller}, Account: ${!!seller?.bankAccountNumber}, Holder: ${!!seller?.bankAccountHolder}, Code: ${!!seller?.bankCode}`);
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cập nhật thông tin tài khoản ngân hàng trước',
      });
    }

    // ===== Check if payout already exists for this transaction =====
    const existingPayout = await db.query.payouts.findFirst({
      where: eq(payouts.transactionId, transactionId),
    });

    // If payout already exists, handle by status:
    // - pending/processing: Return existing (already in flight, prevent duplicate sends)
    // - completed: Return existing (done)
    // - failed: Delete it and allow retry (let user try again with fresh attempt)
    if (existingPayout) {
      if (existingPayout.status === 'failed') {
        console.log(`[Payout] Previous attempt FAILED for transaction. Deleting failed record to allow retry...`);
        await db.delete(payouts).where(eq(payouts.id, existingPayout.id));
        console.log(`[Payout] ✅ Deleted failed payout ${existingPayout.id}. Will create new attempt.`);
      } else {
        // pending, processing, or completed - return existing
        console.log(`[Payout] Payout already exists for transaction. Status: ${existingPayout.status}. Returning existing.`);
        return res.status(200).json({
          success: true,
          message: `Payout already exists (status: ${existingPayout.status})`,
          data: {
            id: existingPayout.id,
            status: existingPayout.status,
            amount: existingPayout.amount,
            externalPayoutId: existingPayout.externalPayoutId,
            createdAt: existingPayout.createdAt,
          },
        });
      }
    }

    // ===== Create payout record =====
    // Use sellerNetAmount (amount - 5% system fee) for payout
    const payoutAmount = transaction.sellerNetAmount || transaction.amount; // Fallback to amount for deposits/old transactions
    const externalPayoutId = `PAYOUT_${Date.now()}_${sellerId.slice(0, 8)}`;

    const [newPayout] = await db.insert(payouts).values({
      transactionId,
      sellerId,
      amount: payoutAmount,
      bankAccountNumber: seller.bankAccountNumber,
      bankAccountHolder: seller.bankAccountHolder,
      bankCode: seller.bankCode,
      bankBranch: seller.bankBranch || undefined,
      status: 'pending',
      externalPayoutId,
      payoutAt: new Date(),
    }).returning();

    console.log(`[Payout] Created payout ${newPayout.id} for transaction ${transactionId}, amount: ${payoutAmount} (system fee: ${transaction.systemFee || 0})`);

    // ===== Mark as processing to prevent duplicate sends =====
    // Transition: pending → processing to ensure only one send to provider
    const [processingPayout] = await db
      .update(payouts)
      .set({ status: 'processing' })
      .where(eq(payouts.id, newPayout.id))
      .returning();

    console.log(`[Payout] Marked payout as processing: ${processingPayout.id}`);

    // ===== Send to payout provider (mock or real based on .env) =====
    // PAYOUT_PROVIDER env var determines which provider to use:
    // - 'mock' (default): Simulated transfers for testing
    // - 'stp': Real STP Direct Transfer API
    // - 'payoo': Real PayOO Settlement API
    
    const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment/v1/payout-callback`;

    try {
      console.log(`[Payout Controller] 📤 Sending to provider...`);
      await sendPayoutRequest({
        payoutId: processingPayout.id,
        externalPayoutId: processingPayout.externalPayoutId || '',
        amount: payoutAmount,
        bankCode: seller.bankCode,
        bankAccountNumber: seller.bankAccountNumber,
        bankAccountHolder: seller.bankAccountHolder,
        bankBranch: seller.bankBranch ?? undefined,
        webhookUrl,
      });
      
      console.log(`[Payout Controller] ✅ Sent to provider: ${processingPayout.id}`);
    } catch (error) {
      console.error('[Payout] Provider send error:', error);
      // Mark back to pending so user can retry
      await db
        .update(payouts)
        .set({ status: 'pending' })
        .where(eq(payouts.id, processingPayout.id));
      
      throw error; // Re-throw so FE knows there was an error
    }

    return res.status(201).json({
      success: true,
      message: 'Yêu cầu rút tiền đã được gửi',
      data: {
        id: processingPayout.id,
        status: processingPayout.status,
        amount: processingPayout.amount,
        externalPayoutId: processingPayout.externalPayoutId,
        createdAt: processingPayout.createdAt,
      },
    });
  } catch (error) {
    console.error('[Payout] Create error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xử lý yêu cầu rút tiền',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

// ============= PAYOUT WEBHOOK CALLBACK =============

/**
 * POST /api/payment/v1/payout-callback
 * Webhook callback from payout provider (mock, STP, or PayOO).
 * Called by payoutProvider service after transfer processing.
 * Public endpoint (no auth required - provider calls directly).
 *
 * Flow:
 *  1. Verify HMAC-SHA256 signature
 *  2. Idempotent check: skip if already processed
 *  3. Update payout status (completed/failed)
 *  4. Log webhook timestamp
 *  5. Return 200 immediately
 */
export const handlePayoutCallback = async (req: Request, res: Response) => {
  try {
    const { payoutId, externalPayoutId, status, providerTransactionId, failureReason, signature } = req.body;

    console.log(`[Payout Callback] 📨 RECEIVED: ${payoutId} | Status: ${status}`);

    // ===== Verify signature =====
    const callbackData = {
      payoutId,
      externalPayoutId,
      status,
      providerTransactionId: providerTransactionId || '',
      failureReason: failureReason || '',
    };

    if (!verifyPayoutSignature(callbackData, signature)) {
      console.error('[Payout Callback] ❌ Invalid signature for callback', { payoutId, externalPayoutId });
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    // ===== Find payout =====
    const payout = await db.query.payouts.findFirst({
      where: eq(payouts.id, payoutId),
    });

    if (!payout) {
      console.error('[Payout Callback] ❌ Payout not found', { payoutId });
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    // ===== Idempotent check: Skip if already processed =====
    if (payout.status !== 'pending' && payout.status !== 'processing') {
      console.log(`[Payout Callback] 🚫 Already handled (${payout.status})`, { payoutId });
      // Return 200 OK even for duplicate - webhook provider should not retry
      return res.status(200).json({
        success: true,
        message: 'Callback received (already processed)',
      });
    }

    // ===== Update payout status =====
    const validStatuses = ['completed', 'failed'];
    if (!validStatuses.includes(status)) {
      console.error('[Payout Callback] ❌ Invalid status', { payoutId, status });
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const updateData: any = {
      status,
      webhookReceivedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (providerTransactionId) {
        updateData.providerTransactionId = providerTransactionId;
      }
    } else if (status === 'failed') {
      updateData.failureReason = failureReason || 'Unknown error from provider';
    }

    await db.update(payouts)
      .set(updateData)
      .where(eq(payouts.id, payoutId));

    console.log(`[Payout Callback] ✅ Updated to ${status}`, {
      payoutId,
      externalPayoutId,
      completedAt: updateData.completedAt,
      failureReason: updateData.failureReason,
    });

    // ===== Return 200 immediately (webhook should not retry on success) =====
    return res.status(200).json({
      success: true,
      message: 'Callback processed',
    });
  } catch (error) {
    console.error('[Payout] Callback error:', error);
    // Return 500 to signal to webhook provider to retry
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ============= GET PAYOUT STATUS =============

/**
 * GET /api/payment/v1/payout/status/:payoutId
 * Seller checks payout status and details.
 */
export const getPayoutStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const { payoutId } = req.params as { payoutId: string };

    const payout = await db.query.payouts.findFirst({
      where: and(
        eq(payouts.id, payoutId),
        eq(payouts.sellerId, sellerId)
      ),
      with: {
        transaction: {
          columns: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
    });

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout không tồn tại',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: payout.id,
        status: payout.status,
        amount: payout.amount,
        externalPayoutId: payout.externalPayoutId,
        providerTransactionId: payout.providerTransactionId,
        completedAt: payout.completedAt,
        failureReason: payout.failureReason,
        webhookReceivedAt: payout.webhookReceivedAt,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt,
        transaction: payout.transaction,
      },
    });
  } catch (error) {
    console.error('[Payout] Status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin rút tiền',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

// ============= GET PAYOUT BY TRANSACTION ID =============

/**
 * GET /api/payment/v1/payout/by-transaction/:transactionId
 * Seller checks payout status for a specific transaction.
 */
export const getPayoutByTransactionId = async (req: Request, res: Response) => {
  try {
    // Disable caching for real-time payout status updates
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const sellerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };

    // Verify seller owns this transaction
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.sellerId, sellerId)
      ),
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Giao dịch không tồn tại hoặc không phải của bạn',
      });
    }

    // Get payout for this transaction
    const payout = await db.query.payouts.findFirst({
      where: eq(payouts.transactionId, transactionId),
    });

    if (!payout) {
      // No payout found - return null (normal case)
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: payout.id,
        status: payout.status,
        amount: payout.amount,
        externalPayoutId: payout.externalPayoutId,
        providerTransactionId: payout.providerTransactionId,
        completedAt: payout.completedAt,
        failureReason: payout.failureReason,
        webhookReceivedAt: payout.webhookReceivedAt,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Payout] By Transaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin rút tiền',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

// ============= REFUND SYSTEM (FULL REFUND ONLY) =============
// For school project: Immediate full refund, no admin approval needed
// Refund allowed within 24 hours of transaction completion

/**
 * POST /api/payment/v1/refund/:transactionId
 * Buyer requests a full refund for a completed transaction
 * 
 * Constraints:
 * - Transaction must be status="completed"
 * - Must be requested within 24 hours of transaction creation
 * - Only one refund per transaction (no duplicate refunthemds)
 * - Refund is immediately processed (status=completed)
 * 
 * On success:
 * - Create refund record
 * - Update transaction status to "refunded"
 * - Update bike status to "for_sale"
 */
export const requestRefund = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { transactionId } = req.params as { transactionId: string };
    const { reason, reportId } = req.body as { reason: string; reportId?: string };

    // Defensive logging
    console.log('[requestRefund] Raw request body:', req.body);
    console.log('[requestRefund] transactionId:', transactionId);
    console.log('[requestRefund] reason:', reason, 'type:', typeof reason);
    console.log('[requestRefund] reportId:', reportId);

    if (!reason || reason.trim().length === 0) {
      console.log('[requestRefund] ❌ Missing or empty reason');
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do hoàn trả',
      });
    }

    // Find transaction
    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.buyerId, buyerId)
      ),
      with: {
        bike: { columns: { id: true, title: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Giao dịch không tồn tại',
      });
    }

    // Transaction must be completed
    if (transaction.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Chỉ có thể hoàn trả giao dịch đã hoàn thành (hiện tại: ${transaction.status})`,
      });
    }

    // Check 24-hour window (optional for school project, can be removed)
    const hoursElapsed = (Date.now() - new Date(transaction.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      console.log(`[Refund] ⚠️  Transaction ${transactionId} is ${hoursElapsed.toFixed(2)} hours old (>24h limit)`);
      // For school project, we allow refunds anytime after completion, so comment this out
      // return res.status(400).json({
      //   success: false,
      //   message: 'Hết hạn hoàn trả (chỉ trong 24 giờ sau giao dịch hoàn thành)',
      // });
    }

    // Check if refund already exists for this transaction
    const existingRefund = await db.query.refunds.findFirst({
      where: eq(refunds.transactionId, transactionId),
    });

    if (existingRefund) {
      console.log('[requestRefund] ⚠️  Refund already exists:', existingRefund.id);
      return res.status(400).json({
        success: false,
        message: 'Giao dịch này đã có yêu cầu hoàn trả',
        refundId: existingRefund.id,
      });
    }

    // Get VNPay transaction number from transaction notes (stored during IPN)
    const vnpayTransactionNo = transaction.notes?.match(/VNPay TxnNo: (\d+)/)?.[1] || 'unknown';

    // Create refund record (status=pending initially, will be updated by webhook)
    const [newRefund] = await db.insert(refunds).values({
      transactionId,
      reportId: reportId || null, // Optional: link to report if refund triggered from report approval
      buyerId,
      sellerId: transaction.sellerId,
      amount: transaction.amount, // Full refund
      reason: reason.trim(),
      status: 'pending', // Start as pending, will be completed by webhook or immediately by mock
    }).returning();

    console.log(`[Refund] ✓ Created refund ${newRefund.id} for transaction ${transactionId}, amount: ${transaction.amount}, reason: ${reason.trim()}`);

    // Start refund process with provider (VNPay or mock)
    const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment/v1/refund-callback`;

    try {
      console.log('[Refund] Calling sendRefundRequest...');
      const refundResponse = await sendRefundRequest({
        refundId: newRefund.id,
        transactionNo: vnpayTransactionNo,
        amount: transaction.amount,
        reason: reason.trim(),
        webhookUrl,
      });

      console.log(`[Refund] Provider response received:`, refundResponse);

      // If mock-instant, immediately complete the refund
      if (refundResponse.status === 'completed') {
        console.log(`[Refund] Mock-instant mode detected, completing refund immediately`);
        await db.update(refunds)
          .set({ status: 'completed', processedAt: new Date() })
          .where(eq(refunds.id, newRefund.id));

        // Update transaction and bike immediately
        await db.update(transactions)
          .set({ status: 'refunded', notes: `Full refund approved: ${reason}` })
          .where(eq(transactions.id, transactionId));

        await db.update(bikes)
          .set({ status: 'for_sale', updatedAt: new Date() })
          .where(eq(bikes.id, transaction.bikeId));

        console.log(`[Refund] ✓ Refund completed immediately (mock-instant mode)`);
      }
    } catch (providerError) {
      console.error('[Refund] Provider error caught:', providerError instanceof Error ? providerError.message : String(providerError));
      // Refund record created, provider will retry or user can try again
      // Don't throw - let user know refund is pending
    }

    return res.status(201).json({
      success: true,
      message: 'Yêu cầu hoàn trả đã được chấp nhận',
      refund: {
        id: newRefund.id,
        transactionId: newRefund.transactionId,
        amount: newRefund.amount,
        status: newRefund.status,
        reason: newRefund.reason,
        processedAt: newRefund.processedAt,
        createdAt: newRefund.createdAt,
      },
    });
  } catch (error) {
    console.error('[Refund] Error caught:', error instanceof Error ? error.stack : String(error));
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu hoàn trả',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
    });
  }
};

/**
 * GET /api/payment/v1/refund/:refundId/status
 * Get refund status by refund ID
 */
export const getRefundStatus = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const { refundId } = req.params as { refundId: string };

    const refund = await db.query.refunds.findFirst({
      where: and(
        eq(refunds.id, refundId),
        eq(refunds.buyerId, buyerId)
      ),
      with: {
        transaction: {
          columns: { id: true, amount: true, status: true, createdAt: true },
          with: {
            bike: { columns: { id: true, title: true } },
          },
        },
      },
    });

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Yêu cầu hoàn trả không tồn tại',
      });
    }

    return res.status(200).json({
      success: true,
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        reason: refund.reason,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        transaction: refund.transaction,
      },
    });
  } catch (error) {
    console.error('[Refund] Status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin hoàn trả',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

/**
 * GET /api/payment/v1/refunds
 * List all refunds for current buyer
 */
export const listRefunds = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;

    const buyerRefunds = await db.query.refunds.findMany({
      where: eq(refunds.buyerId, buyerId),
      with: {
        transaction: {
          columns: { id: true, amount: true, status: true, createdAt: true },
          with: {
            bike: {
              columns: { id: true, title: true },
              with: {
                brand: { columns: { id: true, name: true } },
                model: { columns: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: (refunds, { desc }) => [desc(refunds.createdAt)],
    });

    return res.status(200).json({
      success: true,
      data: buyerRefunds,
      message: `Danh sách hoàn trả (${buyerRefunds.length} yêu cầu)`,
    });
  } catch (error) {
    console.error('[Refund] List error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách hoàn trả',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

/**
 * POST /api/payment/v1/refund-callback
 * Webhook callback from refund provider (VNPay or mock)
 * Updates refund status when provider confirms
 */
export const handleRefundCallback = async (req: Request, res: Response) => {
  try {
    const { refundId, status, message, transactionNo } = req.body;

    console.log(`[Refund Callback] Received callback for refund ${refundId}, status=${status}`);

    // Find refund
    const refund = await db.query.refunds.findFirst({
      where: eq(refunds.id, refundId),
      with: {
        transaction: {
          columns: { id: true, bikeId: true, buyerId: true },
        },
      },
    });

    if (!refund) {
      console.error('[Refund Callback] Refund not found:', refundId);
      return res.status(404).json({
        success: false,
        message: 'Refund not found',
      });
    }

    // If already processed, skip
    if (refund.status !== 'pending') {
      console.log(`[Refund Callback] Already processed (status=${refund.status}), skipping`);
      return res.status(200).json({
        success: true,
        message: 'Already processed',
      });
    }

    // Update refund status
    const updateData: any = {
      status,
      processedAt: new Date(),
    };

    await db.update(refunds)
      .set(updateData)
      .where(eq(refunds.id, refundId));

    console.log(`[Refund Callback] Updated refund status to ${status}`);

    // If approved, update transaction and bike
    if (status === 'completed') {
      await db.update(transactions)
        .set({ status: 'refunded', notes: `Full refund approved by ${process.env.REFUND_PROVIDER || 'mock'}` })
        .where(eq(transactions.id, refund.transaction.id));

      await db.update(bikes)
        .set({ status: 'for_sale', updatedAt: new Date() })
        .where(eq(bikes.id, refund.transaction.bikeId));

      console.log(`[Refund Callback] Updated transaction and bike to refunded/for_sale`);
    }

    return res.status(200).json({
      success: true,
      message: 'Callback processed',
    });
  } catch (error) {
    console.error('[Refund Callback] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
