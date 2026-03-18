import express from 'express';
import {
  searchBikes,
  getBikeDetail,
  getRecommendedBikes,
  createTransaction,
  getMyTransactions,
  cancelTransaction,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  submitReport,
  addReview,
  sendMessageToSeller,
  getMessageWithSeller,
} from '../controllers/buyerController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/buyer/v1/bikes/recommended:
 *   get:
 *     summary: Get recommended bikes (latest approved bikes for homepage)
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of bikes to return
 *     responses:
 *       200:
 *         description: Recommended bikes fetched successfully
 *       401:
 *         description: Unauthorized - No token provided
 */
router.get('/v1/bikes/recommended', isAuthenticated, getRecommendedBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/search:
 *   get:
 *     summary: Search bikes with filters
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Bike brand (partial match)
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Bike model (partial match)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *           enum: [excellent, good, fair, poor]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, year, mileage, createdAt]
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
 *         description: Bikes searched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/search', isAuthenticated, searchBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/{bikeId}:
 *   get:
 *     summary: Get bike details by ID
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bike UUID
 *     responses:
 *       200:
 *         description: Bike detail with full info and inspection report
 *       400:
 *         description: Invalid bike ID format
 *       404:
 *         description: Bike not found
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/:bikeId', isAuthenticated, getBikeDetail);

// ============= TRANSACTIONS =============

/**
 * @swagger
 * /api/buyer/v1/transactions:
 *   post:
 *     summary: Đặt mua / đặt cọc một chiếc xe
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bikeId, transactionType]
 *             properties:
 *               bikeId:
 *                 type: string
 *                 format: uuid
 *                 description: "Bike ID to transaction"
 *               transactionType:
 *                 type: string
 *                 enum: [full_payment, deposit]
 *                 default: full_payment
 *                 description: "full_payment: thanh toán đầy đủ | deposit: đặt cọc để có ưu tiên (10%-30% giá xe)"
 *               amount:
 *                 type: number
 *                 description: "For full_payment: must equal bike price. For deposit: must be between 10% to 30% of bike price"
 *                 example: 6750000
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, vnpay, bank_transfer]
 *                 example: "vnpay"
 *               notes:
 *                 type: string
 *                 default: null
 *                 description: "(Optional) If not provided, automatically generated with deposit percentage and remaining balance"
 *                 example: "Tôi muốn đặt cọc 15% để giữ xe"
 *     responses:
 *       201:
 *         description: Giao dịch thành công
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 bikeId:
 *                   type: string
 *                   format: uuid
 *                 buyerId:
 *                   type: string
 *                   format: uuid
 *                 sellerId:
 *                   type: string
 *                   format: uuid
 *                 amount:
 *                   type: number
 *                 transactionType:
 *                   type: string
 *                   enum: [full_payment, deposit]
 *                 remainingBalance:
 *                   type: number
 *                   description: "For deposits, the remaining amount to pay. Null for full payments"
 *                 status:
 *                   type: string
 *       400:
 *         description: Xe không hợp lệ hoặc đã có đơn pending
 *       404:
 *         description: Xe không tồn tại
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/transactions', isAuthenticated, createTransaction);

/**
 * @swagger
 * /api/buyer/v1/transactions:
 *   get:
 *     summary: Danh sách đơn đặt mua của buyer
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
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
 *         description: Danh sách giao dịch của buyer
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/transactions', isAuthenticated, getMyTransactions);

/**
 * @swagger
 * /api/buyer/v1/transactions/{id}:
 *   delete:
 *     summary: Hủy đơn đặt mua (chỉ khi còn pending)
 *     tags: [Buyer]
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
 *         description: Đơn đặt mua đã hủy
 *       400:
 *         description: Giao dịch không ở trạng thái pending
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.delete('/v1/transactions/:id', isAuthenticated, cancelTransaction);

// ============= WISHLIST =============

/**
 * @swagger
 * /api/buyer/v1/wishlist:
 *   get:
 *     summary: Xem danh sách xe yêu thích
 *     tags: [Buyer]
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
 *         description: Danh sách xe yêu thích
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/wishlist', isAuthenticated, getWishlist);

/**
 * @swagger
 * /api/buyer/v1/wishlist/{bikeId}:
 *   post:
 *     summary: Thêm xe vào danh sách yêu thích
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Đã thêm vào wishlist
 *       400:
 *         description: Xe đã có trong wishlist
 *       404:
 *         description: Xe không tồn tại
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/wishlist/:bikeId', isAuthenticated, addToWishlist);

/**
 * @swagger
 * /api/buyer/v1/wishlist/{bikeId}:
 *   delete:
 *     summary: Xóa xe khỏi danh sách yêu thích
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Đã xóa khỏi wishlist
 *       404:
 *         description: Xe không có trong wishlist
 *       401:
 *         description: Unauthorized
 */
router.delete('/v1/wishlist/:bikeId', isAuthenticated, removeFromWishlist);

// ============= REPORTS =============

/**
 * @swagger
 * /api/buyer/v1/reports:
 *   post:
 *     summary: Báo cáo vi phạm (xe hoặc người dùng)
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason, description]
 *             properties:
 *               reportedUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID người bị báo cáo (tùy chọn)
 *               reportedBikeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID xe bị báo cáo (tùy chọn)
 *               reason:
 *                 type: string
 *                 example: "Thông tin xe không trung thực"
 *               description:
 *                 type: string
 *                 example: "Ảnh không đúng với thực tế, xe bị hỏng nhiều hơn mô tả"
 *     responses:
 *       201:
 *         description: Báo cáo đã gửi thành công
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/reports', isAuthenticated, submitReport);

// ============= REVIEWS =============

/**
 * @swagger
 * /api/buyer/v1/reviews:
 *   post:
 *     summary: Đánh giá seller sau khi giao dịch hoàn tất
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sellerId, rating]
 *             properties:
 *               sellerId:
 *                 type: string
 *                 format: uuid
 *               transactionId:
 *                 type: string
 *                 format: uuid
 *                 description: ID giao dịch để xác minh (tùy chọn nhưng khuyến nghị)
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Seller rất nhiệt tình, xe đúng như mô tả"
 *     responses:
 *       201:
 *         description: Đánh giá đã gửi thành công
 *       400:
 *         description: Giao dịch chưa hoàn tất hoặc đã đánh giá rồi
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/reviews', isAuthenticated, addReview);

// ============= MESSAGES =============

/**
 * @swagger
 * /api/buyer/v1/messages/{sellerId}:
 *   post:
 *     summary: Nhắn tin cho seller về một chiếc xe
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sellerId
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Xe còn không anh? Em muốn hỏi thêm về tình trạng"
 *               bikeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID xe liên quan (tùy chọn)
 *     responses:
 *       201:
 *         description: Tin nhắn đã gửi
 *       400:
 *         description: Nội dung trống
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/messages/:sellerId', isAuthenticated, sendMessageToSeller);

/**
 * @swagger
 * /api/buyer/v1/messages/{sellerId}:
 *   get:
 *     summary: Xem lịch sử tin nhắn với seller
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/messages/:sellerId', isAuthenticated, getMessageWithSeller);

export default router;
