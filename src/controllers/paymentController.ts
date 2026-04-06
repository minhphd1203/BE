import { Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db';
import { transactions, bikes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { withShippingAddressAlias } from '../utils/transactionResponse';
import { markFulfillmentPreparingAfterBikeSold } from '../services/fulfillmentSync';

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
        bike: { columns: { title: true, brand: true, model: true } },
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
        bike: { columns: { title: true, brand: true, model: true } },
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
    const [remainingTransaction] = await db
      .insert(transactions)
      .values({
        bikeId: depositTransaction.bikeId,
        buyerId,
        sellerId: depositTransaction.sellerId,
        amount: depositTransaction.remainingBalance,
        transactionType: 'remaining_payment',
        remainingBalance: 0,
        notes: `Thanh toán phần còn lại của đơn đặt cọc: ${transactionId}`,
        address: depositTransaction.address ?? null,
        fullName: depositTransaction.fullName ?? null,
        status: 'pending',
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

    if (bikeStatus === 'sold') {
      await markFulfillmentPreparingAfterBikeSold(
        transaction.bikeId,
        transaction.buyerId,
        transaction.sellerId
      );
      console.log(`[VNPay IPN] ✓ Fulfillment initialized (preparing) for sold bike ${transaction.bikeId}`);
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
        bike: { columns: { id: true, title: true, brand: true, model: true, images: true } },
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
