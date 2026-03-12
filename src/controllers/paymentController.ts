import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { transactions, bikes } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// ============= VNPAY MANUAL IMPLEMENTATION =============
// Implement theo đúng tài liệu chính thức VNPay để tránh encoding issues

const VNPAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

function dateFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}


function buildVNPayUrl(params: Record<string, string>): string {
  const secret = process.env.VNP_SECRET!;
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();

  const encoded = sortedKeys.map(k => `${k}=${encodeURIComponent(params[k])}`);

  const hashData = encoded.join('&');
  const queryString = encoded.join('&');
  // Sign
  const hmac = crypto.createHmac('sha512', secret);
  const secureHash = hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
  return `${VNPAY_URL}?${queryString}&vnp_SecureHash=${secureHash}`;
}

function verifyVNPaySignature(params: Record<string, string>): boolean {
  const secret = process.env.VNP_SECRET!;
  const receivedHash = params['vnp_SecureHash'];
  const filteredParams = { ...params };
  delete filteredParams['vnp_SecureHash'];
  delete filteredParams['vnp_SecureHashType'];
  const sortedKeys = Object.keys(filteredParams).sort();
  const hashData = sortedKeys.map(k => `${k}=${filteredParams[k]}`).join('&');
  const hmac = crypto.createHmac('sha512', secret);
  const calculatedHash = hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
  return calculatedHash === receivedHash;
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

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Giao dịch không ở trạng thái pending (hiện tại: ${transaction.status})`,
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

    res.status(200).json({
      success: true,
      data: {
        paymentUrl,
        transactionId,
        amount: transaction.amount,
        orderInfo,
      },
      message: 'URL thanh toán đã được tạo. Redirect buyer đến paymentUrl.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo URL thanh toán VNPay',
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
    const params = req.query as Record<string, string>;
    const isValid = verifyVNPaySignature(params);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Xác thực chữ ký thất bại',
        code: 'INVALID_CHECKSUM',
      });
    }

    const responseCode = params['vnp_ResponseCode'];
    const txnRef = params['vnp_TxnRef'];

    if (responseCode !== '00') {
      return res.status(200).json({
        success: false,
        message: 'Thanh toán thất bại hoặc bị huỷ',
        code: responseCode,
        txnRef,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Thanh toán thành công',
      data: {
        txnRef,
        amount: parseInt(params['vnp_Amount']) / 100,
        bankCode: params['vnp_BankCode'],
        payDate: params['vnp_PayDate'],
        transactionNo: params['vnp_TransactionNo'],
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Dữ liệu trả về không hợp lệ',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
    const params = req.query as Record<string, string>;

    // Bước 1: Xác thực chữ ký
    if (!verifyVNPaySignature(params)) {
      return res.json({ RspCode: '97', Message: 'Invalid checksum' });
    }

    const txnRef = params['vnp_TxnRef'];
    const responseCode = params['vnp_ResponseCode'];
    const vnpAmount = parseInt(params['vnp_Amount']);

    // Bước 2: Tìm giao dịch (txnRef = transactionId without dashes, first 20 chars)
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, txnRef),
    });

    if (!transaction) {
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    // Bước 3: Kiểm tra số tiền
    const expectedAmount = Math.round(transaction.amount * 100);
    if (vnpAmount !== expectedAmount) {
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }

    // Bước 4: Idempotent check
    if (transaction.status === 'completed') {
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (responseCode !== '00') {
      await db
        .update(transactions)
        .set({ status: 'cancelled', notes: `VNPay failed: ${responseCode}` })
        .where(eq(transactions.id, transaction.id));
      return res.json({ RspCode: '00', Message: 'Confirm success' });
    }

    // Bước 5: Cập nhật thành công
    await db
      .update(transactions)
      .set({
        status: 'completed',
        paymentMethod: 'vnpay',
        notes: `VNPay TxnNo: ${params['vnp_TransactionNo']}, Bank: ${params['vnp_BankCode']}`,
      })
      .where(eq(transactions.id, transaction.id));

    await db.update(bikes).set({ status: 'sold' }).where(eq(bikes.id, transaction.bikeId));

    console.log(`[VNPay IPN] Payment success for transaction ${transaction.id}`);
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
      data: transaction,
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
