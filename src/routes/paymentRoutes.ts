import express from 'express';
import { createPaymentUrl, createRemainingPaymentUrl, vnpayReturn, vnpayIPN, getPaymentStatus, createPayout, getPayoutStatus, handlePayoutCallback } from '../controllers/paymentController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/payment/v1/create/{transactionId}:
 *   post:
 *     summary: Tạo URL thanh toán VNPay cho một giao dịch
 *     description: |
 *       Buyer gọi endpoint này sau khi đã tạo transaction.
 *       Backend trả về `paymentUrl`, frontend redirect buyer đến URL đó để thanh toán.
 *
 *       **Flow thanh toán:**
 *       1. `POST /api/buyer/v1/transactions` → tạo transaction (status=pending)
 *       2. `POST /api/payment/v1/create/:transactionId` → nhận paymentUrl
 *       3. Frontend redirect → `paymentUrl` (VNPay payment page)
 *       4. Buyer thanh toán trên VNPay
 *       5. VNPay gọi IPN → cập nhật DB tự động
 *       6. VNPay redirect buyer về `returnUrl`
 *     tags: [Payment - VNPay]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID giao dịch (phải ở trạng thái pending và thuộc buyer này)
 *     responses:
 *       200:
 *         description: URL thanh toán VNPay đã được tạo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                       example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
 *                     qrCode:
 *                       type: string
 *                       format: base64
 *                       description: "Base64 encoded QR code image (PNG) of the payment URL for scanning"
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..."
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: number
 *                       example: 45000000
 *                     orderInfo:
 *                       type: string
 *                       example: "Thanh toan xe dap Trek Domane - Ma GD: A1B2C3D4"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: "QR code and payment URL expire after 10 minutes"
 *                       example: "2026-03-24T20:25:00.000Z"
 *       400:
 *         description: Giao dịch không ở trạng thái pending
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/create/:transactionId', isAuthenticated, createPaymentUrl);

/**
 * @swagger
 * /api/payment/v1/vnpay-return:
 *   get:
 *     summary: VNPay Return URL (sau khi thanh toán)
 *     description: |
 *       VNPay redirect buyer về URL này sau khi hoàn tất thanh toán.
 *       Endpoint này chỉ phục vụ UX - KHÔNG cập nhật DB (DB được cập nhật qua IPN).
 *
 *       **Lưu ý cho frontend SPA (React/Vue):**
 *       Thay vì dùng endpoint này, hãy set `VNP_RETURN_URL` trong `.env`
 *       trỏ đến trang frontend của bạn. Frontend sẽ đọc query params:
 *       - `vnp_ResponseCode`: "00" = thành công
 *       - `vnp_TxnRef`: transactionId
 *       - `vnp_Amount`: số tiền đã thanh toán
 *     tags: [Payment - VNPay]
 *     parameters:
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: "00 = thành công, các mã khác = lỗi"
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: Transaction ID
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: number
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Kết quả thanh toán (thành công hoặc thất bại)
 *       400:
 *         description: Chữ ký không hợp lệ
 */
router.get('/v1/vnpay-return', vnpayReturn);

/**
 * @swagger
 * /api/payment/v1/vnpay-ipn:
 *   get:
 *     summary: VNPay IPN Webhook (server-to-server)
 *     description: |
 *       VNPay gọi endpoint này để thông báo kết quả thanh toán (Instant Payment Notification).
 *
 *       **⚠️ Cấu hình bắt buộc:**
 *       Vào VNPay Merchant Portal → Cấu hình IPN URL:
 *       `https://your-domain.com/api/payment/v1/vnpay-ipn`
 *
 *       **Endpoint này KHÔNG yêu cầu JWT** (VNPay gọi trực tiếp).
 *
 *       **Logic xử lý:**
 *       1. Xác thực chữ ký (checksum)
 *       2. Tìm transaction trong DB
 *       3. Kiểm tra số tiền khớp
 *       4. Cập nhật transaction → completed/cancelled
 *       5. Nếu thành công: đánh dấu xe → sold
 *       6. Trả về response format VNPay yêu cầu
 *     tags: [Payment - VNPay]
 *     responses:
 *       200:
 *         description: IPN đã được xử lý (luôn trả 200 với JSON VNPay format)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "00"
 *                 Message:
 *                   type: string
 *                   example: "Confirm Success"
 */
router.get('/v1/vnpay-ipn', vnpayIPN);

/**
 * @swagger
 * /api/payment/v1/status/{transactionId}:
 *   get:
 *     summary: Kiểm tra trạng thái thanh toán của một giao dịch
 *     tags: [Payment - VNPay]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Thông tin giao dịch và trạng thái thanh toán
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/status/:transactionId', isAuthenticated, getPaymentStatus);

/**
 * @swagger
 * /api/payment/v1/create-remaining/{depositTransactionId}:
 *   post:
 *     summary: Tạo URL thanh toán cho phần tiền còn lại sau khi đặt cọc
 *     description: |
 *       Buyer gọi endpoint này để thanh toán phần tiền còn lại sau khi đã đặt cọc.
 *       Endpoint này chỉ hoạt động khi:
 *       - Transaction là deposit (transactionType = 'deposit')
 *       - Deposit đã được thanh toán xong (status = 'completed')
 *       - Còn tiền lỗi cần thanh toán (remainingBalance > 0)
 *
 *       **Flow thanh toán phần còn lại:**
 *       1. Buyer đặt cọc → tạo deposit transaction
 *       2. `POST /api/payment/v1/create/:depositTransactionId` → thanh toán deposit
 *       3. Xe chuyển sang trạng thái 'reserved'
 *       4. Buyer gọi `POST /api/payment/v1/create-remaining/:depositTransactionId` → nhận paymentUrl
 *       5. Frontend redirect → paymentUrl (VNPay payment page)
 *       6. Buyer thanh toán phần còn lại
 *       7. VNPay gọi IPN → cập nhật DB, xe chuyển sang 'sold'
 *     tags: [Payment - VNPay]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositTransactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của deposit transaction đã thanh toán
 *     responses:
 *       200:
 *         description: URL thanh toán phần còn lại đã được tạo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                       example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
 *                     qrCode:
 *                       type: string
 *                       format: base64
 *                       description: "Base64 encoded QR code image (PNG) of the payment URL for scanning"
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..."
 *                     remainingTransactionId:
 *                       type: string
 *                       format: uuid
 *                       description: ID của remaining payment transaction mới
 *                     depositTransactionId:
 *                       type: string
 *                       format: uuid
 *                     remainingBalance:
 *                       type: number
 *                       example: 18000000
 *                     depositAmount:
 *                       type: number
 *                       example: 2000000
 *                     totalPrice:
 *                       type: number
 *                       example: 20000000
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: "QR code and payment URL expire after 10 minutes"
 *                       example: "2026-03-24T20:25:00.000Z"
 *       400:
 *         description: Transaction không phải là deposit hoặc chưa thanh toán
 *       404:
 *         description: Không tìm thấy deposit transaction
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/create-remaining/:transactionId', isAuthenticated, createRemainingPaymentUrl);

// ============= SELLER PAYOUT ENDPOINTS =============

/**
 * @swagger
 * /api/payment/v1/payout/create/{transactionId}:
 *   post:
 *     summary: Seller initiates payout after delivery confirmed
 *     description: |
 *       Seller initiates payout after delivery is confirmed.
 *       - Validates delivery status and seller bank account info
 *       - Creates payout record (status: pending)
 *       - Simulates async processing (90% success rate)
 *       - Updates status to completed/failed
 *
 *       **Prerequisites:**
 *       1. Delivery must be confirmed (deliveryStatus='delivered')
 *       2. Buyer must have confirmed receipt (receiptConfirmedAt set)
 *       3. Seller must have valid bank account info (bankCode, bankAccountNumber, bankAccountHolder)
 *     tags: [Payment - Seller Payout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of a completed transaction with confirmed delivery
 *     responses:
 *       201:
 *         description: Payout request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 payout:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, failed]
 *                     amount:
 *                       type: number
 *                     externalPayoutId:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: |
 *           Invalid request:
 *           - Delivery not confirmed (deliveryStatus != 'delivered')
 *           - Receipt not confirmed (receiptConfirmedAt not set)
 *           - Transaction not completed
 *           - Bank info missing
 *           - Payout already exists
 *       404:
 *         description: Transaction not found or does not belong to seller
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/payout/create/:transactionId', isAuthenticated, createPayout);

/**
 * @swagger
 * /api/payment/v1/payout/status/{payoutId}:
 *   get:
 *     summary: Get payout status
 *     description: |
 *       Seller checks payout status and details.
 *       Returns current status: pending, completed, or failed.
 *     tags: [Payment - Seller Payout]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payout status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payout:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, completed, failed]
 *                     amount:
 *                       type: number
 *                     externalPayoutId:
 *                       type: string
 *                     providerTransactionId:
 *                       type: string
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     failureReason:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Payout not found or does not belong to seller
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/payout/status/:payoutId', isAuthenticated, getPayoutStatus);

/**
 * @swagger
 * /api/payment/v1/payout-callback:
 *   post:
 *     summary: Payout provider webhook callback
 *     description: |
 *       Webhook callback from payout provider (mock, STP, or PayOO).
 *       Called by provider after transfer processing completes.
 *       
 *       **No authentication required:** Provider calls server-to-server.
 *       
 *       **Security:** HMAC-SHA256 signature verification.
 *
 *       **Flow:**
 *       1. Provider processes transfer (2-7s in mock mode)
 *       2. Provider sends callback to this endpoint
 *       3. Signature verified
 *       4. Payout status updated (completed/failed)
 *       5. Backend returns 200 OK immediately
 *       6. Provider will NOT retry if HTTP 200 received
 *
 *       **Idempotent:** Duplicate callbacks are skipped (safe for retries).
 *     tags: [Payment - Seller Payout]
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [mock, stp, payoo]
 *         description: Payout provider type (for logging)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payoutId, externalPayoutId, status, signature]
 *             properties:
 *               payoutId:
 *                 type: string
 *                 format: uuid
 *                 description: Internal payout ID from backend
 *               externalPayoutId:
 *                 type: string
 *                 description: External transaction ID from provider
 *               status:
 *                 type: string
 *                 enum: [completed, failed]
 *                 description: Transfer status
 *               providerTransactionId:
 *                 type: string
 *                 description: Provider transaction reference (for completed)
 *               failureReason:
 *                 type: string
 *                 description: Failure details (for failed)
 *               signature:
 *                 type: string
 *                 description: HMAC-SHA256 signature for verification
 *           example:
 *             payoutId: "550e8400-e29b-41d4-a716-446655440000"
 *             externalPayoutId: "EXT-2026-03-24-12345"
 *             status: "completed"
 *             providerTransactionId: "STP-2026-03-24-12345"
 *             signature: "a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2"
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Invalid signature
 *       404:
 *         description: Payout not found
 *       500:
 *         description: Internal error (provider will retry)
 */
router.post('/v1/payout-callback', handlePayoutCallback);

export default router;
