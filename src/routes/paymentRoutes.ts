import express from 'express';
import { createPaymentUrl, vnpayReturn, vnpayIPN, getPaymentStatus } from '../controllers/paymentController';
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
 *                     transactionId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: number
 *                       example: 45000000
 *                     orderInfo:
 *                       type: string
 *                       example: "Thanh toan xe dap Trek Domane - Ma GD: A1B2C3D4"
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

export default router;
