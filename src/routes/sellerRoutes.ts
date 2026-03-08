import express from 'express';
import {
  getDashboard,
  createBike,
  getMyBikes,
  getMyBikeDetail,
  updateBike,
  toggleBikeVisibility,
  deleteBike,
  getMyTransactions,
  updateTransactionStatus,
  getConversations,
  getMessageHistory,
  sendMessage,
  getMyReviews,
} from '../controllers/sellerController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

// Tất cả seller routes yêu cầu đăng nhập
router.use(isAuthenticated);

// ============= DASHBOARD =============

/**
 * @swagger
 * /api/seller/v1/dashboard:
 *   get:
 *     summary: Thống kê tổng quan cho seller (tin đăng, giao dịch, doanh thu, đánh giá)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/dashboard', getDashboard);

// ============= BIKE LISTINGS =============

/**
 * @swagger
 * /api/seller/v1/bikes:
 *   post:
 *     summary: Đăng tin bán xe mới (chờ admin duyệt)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, brand, model, year, price, condition]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Trek Domane SL 6 - 2022"
 *               description:
 *                 type: string
 *                 example: "Xe đạp đường trường cao cấp, ít sử dụng, còn mới 95%"
 *               brand:
 *                 type: string
 *                 example: "Trek"
 *               model:
 *                 type: string
 *                 example: "Domane SL 6"
 *               year:
 *                 type: integer
 *                 example: 2022
 *               price:
 *                 type: number
 *                 example: 45000000
 *               condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *                 example: "excellent"
 *               mileage:
 *                 type: integer
 *                 example: 500
 *               color:
 *                 type: string
 *                 example: "Đen"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://example.com/bike1.jpg"]
 *               video:
 *                 type: string
 *                 example: "https://youtube.com/watch?v=abc123"
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Tin đăng tạo thành công, chờ admin duyệt
 *       400:
 *         description: Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/bikes', createBike);

/**
 * @swagger
 * /api/seller/v1/bikes:
 *   get:
 *     summary: Danh sách tất cả tin đăng của seller (mọi trạng thái)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, hidden, sold]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo title, brand, model
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, year, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách tin đăng
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes', getMyBikes);

/**
 * @swagger
 * /api/seller/v1/bikes/{id}:
 *   get:
 *     summary: Chi tiết tin đăng (bao gồm inspections và transactions)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Chi tiết tin đăng
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Không tìm thấy tin đăng
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/:id', getMyBikeDetail);

/**
 * @swagger
 * /api/seller/v1/bikes/{id}:
 *   put:
 *     summary: Chỉnh sửa tin đăng (sẽ reset về pending nếu sửa thông tin cốt lõi)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               year:
 *                 type: integer
 *               price:
 *                 type: number
 *               condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *               mileage:
 *                 type: integer
 *               color:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               video:
 *                 type: string
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Tin đăng đã cập nhật
 *       400:
 *         description: ID không hợp lệ hoặc tin đã bán
 *       404:
 *         description: Không tìm thấy tin đăng
 *       401:
 *         description: Unauthorized
 */
router.put('/v1/bikes/:id', updateBike);

/**
 * @swagger
 * /api/seller/v1/bikes/{id}/visibility:
 *   put:
 *     summary: Ẩn / hiện tin đăng (chỉ áp dụng cho tin đã approved hoặc hidden)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Trạng thái hiển thị đã thay đổi
 *       400:
 *         description: Tin không ở trạng thái approved/hidden
 *       404:
 *         description: Không tìm thấy tin đăng
 *       401:
 *         description: Unauthorized
 */
router.put('/v1/bikes/:id/visibility', toggleBikeVisibility);

/**
 * @swagger
 * /api/seller/v1/bikes/{id}:
 *   delete:
 *     summary: Xóa tin đăng (không thể xóa nếu có giao dịch pending hoặc đã bán)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tin đăng đã xóa
 *       400:
 *         description: Không thể xóa (có giao dịch pending hoặc đã bán)
 *       404:
 *         description: Không tìm thấy tin đăng
 *       401:
 *         description: Unauthorized
 */
router.delete('/v1/bikes/:id', deleteBike);

// ============= TRANSACTIONS =============

/**
 * @swagger
 * /api/seller/v1/transactions:
 *   get:
 *     summary: Danh sách đơn đặt mua nhận được từ buyer
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Lọc theo trạng thái giao dịch
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách giao dịch
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/transactions', getMyTransactions);

/**
 * @swagger
 * /api/seller/v1/transactions/{id}:
 *   put:
 *     summary: Xác nhận bán (completed) hoặc hủy (cancelled) đơn đặt mua
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [completed, cancelled]
 *               notes:
 *                 type: string
 *                 example: "Đã giao xe, giao dịch hoàn tất"
 *     responses:
 *       200:
 *         description: Giao dịch đã cập nhật
 *       400:
 *         description: Trạng thái không hợp lệ hoặc giao dịch không ở pending
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.put('/v1/transactions/:id', updateTransactionStatus);

// ============= MESSAGES =============

/**
 * @swagger
 * /api/seller/v1/messages:
 *   get:
 *     summary: Danh sách cuộc hội thoại (nhóm theo người mua + xe)
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách cuộc hội thoại
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/messages', getConversations);

/**
 * @swagger
 * /api/seller/v1/messages/{partnerId}:
 *   get:
 *     summary: Lịch sử tin nhắn với một người dùng cụ thể
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID buyer/người nhắn tin
 *       - in: query
 *         name: bikeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lọc theo xe cụ thể (tùy chọn)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Lịch sử tin nhắn
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/messages/:partnerId', getMessageHistory);

/**
 * @swagger
 * /api/seller/v1/messages/{partnerId}:
 *   post:
 *     summary: Gửi tin nhắn phản hồi cho buyer
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID buyer cần nhắn tin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Xe vẫn còn, bạn có thể đến xem bất cứ lúc nào"
 *               bikeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID xe liên quan (tùy chọn)
 *     responses:
 *       201:
 *         description: Tin nhắn đã gửi
 *       400:
 *         description: ID không hợp lệ hoặc nội dung trống
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/messages/:partnerId', sendMessage);

// ============= REVIEWS / REPUTATION =============

/**
 * @swagger
 * /api/seller/v1/reviews:
 *   get:
 *     summary: Xem đánh giá uy tín của seller
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách đánh giá và điểm trung bình
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/reviews', getMyReviews);

export default router;
