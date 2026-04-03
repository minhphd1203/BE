import express from 'express';
import {
  getDashboard,
  createBike,
  getMyBikes,
  getMyBikeDetail,
  updateBike,
  toggleBikeVisibility,
  deleteBike,
  resubmitBike,
  getMyTransactions,
  getMyTransactionById,
  updateTransactionStatus,
  getMyReviews,
  getCategoriesForSeller,
} from '../controllers/sellerController';
import { isAuthenticated, requireRole } from '../middleware/authMiddleware';
import { parseBikeListingMultipart, parseBikeUpdateMultipart } from '../middleware/bikeUploadMiddleware';
import { messageUpload, attachFileUrl } from '../middleware/messageUploadMiddleware';

const router = express.Router();

// Chỉ user có role seller mới được gọi (tránh buyer/admin dùng nhầm / lạm dụng API)
router.use(isAuthenticated);
router.use(requireRole('seller'));

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

/**
 * @swagger
 * /api/seller/v1/categories:
 *   get:
 *     summary: Danh sách danh mục xe (dropdown đăng/sửa tin)
 *     description: Trả về id, name, slug. Khi gửi tin có thể dùng categoryId = UUID, hoặc slug, hoặc tên khớp DB.
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách danh mục
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/categories', getCategoriesForSeller);

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
 *       description: |
 *         **Upload ảnh:** chọn `multipart/form-data`. Field `images` = file ảnh; `video` = **URL chuỗi** (YouTube/link), không upload file video.
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, brand, model, year, price, condition]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               brand: { type: string }
 *               model: { type: string }
 *               year: { type: string }
 *               price: { type: string }
 *               condition: { type: string, enum: [excellent, good, fair, poor] }
 *               mileage: { type: string }
 *               color: { type: string }
 *               categoryId:
 *                 type: string
 *                 description: "UUID, slug (vd mountain-bike) hoặc tên (vd Mountain Bike). GET /api/seller/v1/categories"
 *                 example: "mountain-bike"
 *               images:
 *                 type: string
 *                 format: binary
 *                 description: "Ảnh xe (jpeg/png/webp/gif). Có thể thêm nhiều part cùng tên `images` (Postman/FE); Swagger Try it thường chỉ 1 file/part."
 *               video:
 *                 type: string
 *                 description: "URL video (YouTube, link mp4...), tùy chọn — không gửi file."
 *                 example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 *           encoding:
 *             images:
 *               contentType: image/png, image/jpeg, image/webp, image/gif
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
 *                 description: Mảng URL ảnh (không upload file)
 *                 example: ["https://example.com/bike1.jpg"]
 *               video:
 *                 type: string
 *                 description: URL video (YouTube/Direct URL)
 *                 example: "https://youtube.com/watch?v=abc123"
 *               categoryId:
 *                 type: string
 *                 description: "UUID, slug hoặc tên danh mục. GET /api/seller/v1/categories"
 *                 example: "Road Bike"
 *     responses:
 *       201:
 *         description: Tin đăng tạo thành công, chờ admin duyệt
 *       400:
 *         description: Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/bikes', parseBikeListingMultipart, createBike);

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
 *       description: JSON hoặc multipart (upload ảnh file; video chỉ URL text).
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               brand: { type: string }
 *               model: { type: string }
 *               year: { type: string }
 *               price: { type: string }
 *               condition: { type: string, enum: [excellent, good, fair, poor] }
 *               mileage: { type: string }
 *               color: { type: string }
 *               categoryId:
 *                 type: string
 *                 description: "UUID, slug hoặc tên. GET /api/seller/v1/categories"
 *                 example: "e-bikes"
 *               images:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mới (field images; nhiều file dùng Postman/FE)
 *               video:
 *                 type: string
 *                 description: URL video, tùy chọn
 *           encoding:
 *             images:
 *               contentType: image/png, image/jpeg, image/webp, image/gif
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
 *                 description: "UUID, slug hoặc tên danh mục"
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
router.put('/v1/bikes/:id', parseBikeUpdateMultipart, updateBike);

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

/**
 * @swagger
 * /api/seller/v1/bikes/{id}/resubmit:
 *   post:
 *     summary: Gửi lại xe kiểm định
 *     description: Chỉ có thể resubmit nếu xe bị rejected. Seller cập nhật thông tin xe rồi gọi endpoint này để gửi lại kiểm định
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
 *         description: ID xe cần resubmit
 *     responses:
 *       200:
 *         description: Xe đã gửi lại kiểm định
 *       400:
 *         description: Xe không ở trạng thái rejected
 *       404:
 *         description: Không tìm thấy xe
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/bikes/:id/resubmit', resubmitBike);

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
 *   get:
 *     summary: Chi tiết một giao dịch (đơn của seller)
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
 *         description: Chi tiết giao dịch (kèm bike, buyer)
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/transactions/:id', getMyTransactionById);

/**
 * @swagger
 * /api/seller/v1/transactions/{id}:
 *   put:
 *     summary: Phê duyệt đơn (approved) hoặc hủy (cancelled)
 *     description: |
 *       - **pending → approved:** Seller chấp nhận đơn; buyer mới được thanh toán (VNPay).
 *       - **pending | approved → cancelled:** Hủy đơn trước khi thanh toán xong.
 *       - **completed** không gửi từ đây: hệ thống gán sau khi thanh toán thành công (IPN).
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
 *                 enum: [approved, cancelled]
 *               notes:
 *                 type: string
 *                 example: "Đồng ý bán, vui lòng thanh toán"
 *     responses:
 *       200:
 *         description: Giao dịch đã cập nhật
 *       400:
 *         description: Trạng thái không hợp lệ hoặc chuyển trạng thái không được phép
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.put('/v1/transactions/:id', updateTransactionStatus);

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
