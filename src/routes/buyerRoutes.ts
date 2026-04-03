import express from 'express';
import {
  getCategories,
  searchBikes,
  getBikeDetail,
  getRecommendedBikes,
  createTransaction,
  getMyTransactions,
  getTransactionDetail,
  cancelTransaction,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  submitReport,
  getMyReports,
  getSellerBikesForReport,
  getReportReasons,
  addReview,
  getConversations,
  sendMessageToSeller,
  getMessageWithSeller,
} from '../controllers/buyerController';
import { isAuthenticated, optionalAuth } from '../middleware/authMiddleware';
import { messageUpload, attachFileUrl } from '../middleware/messageUploadMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/buyer/v1/categories:
 *   get:
 *     summary: Get all categories
 *     description: Công khai — không cần đăng nhập. Lấy danh sách tất cả danh mục từ hệ thống.
 *     tags: [Buyer]
 *     security: []
 *     responses:
 *       200:
 *         description: Categories fetched successfully
 */
router.get('/v1/categories', getCategories);

/**
 * @swagger
 * /api/buyer/v1/bikes/recommended:
 *   get:
 *     summary: Get recommended bikes (latest approved bikes for homepage)
 *     description: Không cần đăng nhập. Có Bearer token thì vẫn dùng được (tuỳ chọn).
 *     tags: [Buyer]
 *     security: []
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
 */
router.get('/v1/bikes/recommended', optionalAuth, getRecommendedBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/search:
 *   get:
 *     summary: Search bikes with filters
 *     description: Công khai — không cần đăng nhập. Chỉ hiển thị xe approved; đã đăng nhập có thể thấy thêm xe reserved liên quan.
 *     tags: [Buyer]
 *     security: []
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
 */
router.get('/v1/bikes/search', optionalAuth, searchBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/{bikeId}:
 *   get:
 *     summary: Get bike details by ID
 *     description: |
 *       Khách chỉ xem được xe **approved**.
 *       Seller (có JWT) xem được mọi trạng thái **tin của chính mình** (pending/rejected/…).
 *       Buyer đã đặt cọc xong có thể xem xe **reserved** của mình (giống kết quả search).
 *     tags: [Buyer]
 *     security: []
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
 */
router.get('/v1/bikes/:bikeId', optionalAuth, getBikeDetail);

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
 *               address:
 *                 type: string
 *                 nullable: true
 *                 description: "Địa chỉ giao hàng / liên hệ (optional, tối đa 2000 ký tự)"
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
 *                 address:
 *                   type: string
 *                   nullable: true
 *                   description: "Địa chỉ giao hàng nếu buyer đã gửi"
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
 *   get:
 *     summary: Xem chi tiết một đơn đặt mua
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
 *         description: Chi tiết đơn đặt mua
 *       404:
 *         description: Không tìm thấy giao dịch
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/transactions/:id', isAuthenticated, getTransactionDetail);

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
 * /api/buyer/v1/sellers/{sellerId}/bikes:
 *   get:
 *     summary: "[FORM SUPPORT] Get seller's APPROVED bikes for report selection"
 *     description: |
 *       Fetch list of **APPROVED bikes only** from a seller to populate bike selection in report form.
 *       Only bikes with status='approved' are shown (available for purchase/report).
 *       Bikes in other states (pending, rejected, reserved, sold, hidden) are excluded.
 *       
 *       **Report Form Flow:**
 *       1. Get seller's bikes (this endpoint) → populate bike dropdown (approved only)
 *       2. Get report reasons (GET /report-reasons) → populate reason dropdown
 *       3. User selects bike + reason + enters description
 *       4. Submit report (POST /reports) with selected reasonId (from database, not free-text)
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
 *         description: ID of seller whose bikes to display
 *     responses:
 *       200:
 *         description: Seller's approved bikes fetched successfully for report form
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     seller:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                     bikes:
 *                       type: array
 *                       description: List of seller's APPROVED bikes only to choose from when reporting
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           brand:
 *                             type: string
 *                           condition:
 *                             type: string
 *                           price:
 *                             type: number
 *                           status:
 *                             type: string
 *                             example: "approved"
 *       404:
 *         description: Seller not found
 */
router.get('/v1/sellers/:sellerId/bikes', isAuthenticated, getSellerBikesForReport);

/**
 * @swagger
 * /api/buyer/v1/reports:
 *   post:
 *     summary: Submit a violation report (bike or seller user)
 *     description: |
 *       Submit a report with **reason selected from database** (not free-text).
 *       
 *       **Prerequisites:**
 *       1. Frontend MUST first call GET /report-reasons to fetch available options
 *       2. Display reasons as **dropdown/multi-select form** to user
 *       3. User selects one reason from the list
 *       4. If reason is "Others (Khác)", require user to enter reasonText field
 *       5. Submit report with selected reasonId here
 *       
 *       **System Auto-Resolution:**
 *       - Some reasons (e.g., "Bike Quality Unmatched Reality") have isSystemAutoResolvable=true
 *       - When admin approves these, system automatically executes action (e.g., delete bike)
 *       - Frontend can rely on backend auto-action OR make optional delete call for safety
 *       
 *       **Field Requirement Logic:**
 *       - reasonId="others" → reasonText is **REQUIRED** (free-text custom violation)
 *       - reasonId=any-uuid → reasonText is **IGNORED** (system-defined reason)
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reasonId, description]
 *             properties:
 *               reportedUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of reported user (optional, if reporting user misconduct)
 *               reportedBikeId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of reported bike (optional, if reporting bike issue)
 *               reasonId:
 *                 type: string
 *                 description: |
 *                   **Reason selection from database dropdown** (from GET /report-reasons).
 *                   Must be one of the returned UUIDs OR the string 'others'
 *                 example: "10000000-0000-0000-0000-000000000001"
 *               reasonText:
 *                 type: string
 *                 description: |
 *                   **REQUIRED ONLY if reasonId='others'**
 *                   Custom violation description when user selects "Others" option.
 *                   IGNORED if reasonId is a system reason UUID.
 *                 example: "Chiếc xe được bán nhưng vẫn còn được listing"
 *               description:
 *                 type: string
 *                 description: Detailed explanation/evidence of the violation
 *                 example: "Ảnh không đúng với thực tế, xe bị hỏng nhiều hơn mô tả"
 *     responses:
 *       201:
 *         description: Report submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     reasonId:
 *                       type: string
 *                     reasonText:
 *                       type: string
 *                       nullable: true
 *                     description:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     createdAt:
 *                       type: string
 *       400:
 *         description: |
 *           Bad request. Common errors:
 *           - reasonId not in dropdown list
 *           - reasonId='others' but reasonText missing
 *           - Missing reportedUserId or reportedBikeId
 *       401:
 *         description: Unauthorized - must be logged in
 */
router.post('/v1/reports', isAuthenticated, submitReport);

/**
 * @swagger
 * /api/buyer/v1/reports:
 *   get:
 *     summary: View buyer's submitted reports
 *     description: |
 *       Retrieve all reports submitted by current buyer.
 *       Each report shows the selected reason (fetched from database, not free-text).
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved]
 *         description: Filter by report status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of buyer's reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       reasonId:
 *                         type: string
 *                         format: uuid
 *                         description: "Reference to reason from report-reasons table (or 'others' for custom)"
 *                       reasonText:
 *                         type: string
 *                         nullable: true
 *                         description: "Custom text if reasonId='others'"
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, resolved]
 *                       reportedUser:
 *                         type: object
 *                       reportedBike:
 *                         type: object
 *                       resolution:
 *                         type: string
 *                       autoResolutionAction:
 *                         type: string
 *                         description: "Action auto-executed by system (e.g., 'delete_bike'). Null if reason is not auto-resolvable"
 *                         example: "auto bike deletion performed"
 *                       createdAt:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/reports', isAuthenticated, getMyReports);

/**
 * @swagger
 * /api/buyer/v1/report-reasons:
 *   get:
 *     summary: "[FORM DROPDOWN] Fetch report reasons from database"
 *     description: |
 *       Fetch list of all available violation reasons (database-driven dropdown).
 *       Used to populate the "reason" selection field in report form.
 *       
 *       **Flow:**
 *       1. Frontend calls this endpoint on report form load
 *       2. Displays all reasons as selectable options (dropdown/multi-select)
 *       3. User selects one reason option
 *       4. Frontend submits report with selected reasonId to POST /v1/reports
 *       
 *       **Special Option:** "Others (Khác)" always included at bottom for custom violations
 *       - If user selects "Others", reasonText field becomes required in report submission
 *       - System will not auto-resolve "Others" violations (manual admin review)
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available violation reasons for selection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   description: "Array of selectable options for report reason field"
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "10000000-0000-0000-0000-000000000001"
 *                       name:
 *                         type: string
 *                         description: "Display name shown in dropdown"
 *                         example: "Bike's Quality Unmatched Reality"
 *                       description:
 *                         type: string
 *                         description: "Detailed explanation of this violation type"
 *                         example: "Bike received is different from seller description - misleading info or quality defect"
 *                       isSystemAutoResolvable:
 *                         type: boolean
 *                         description: "If true, system will auto-execute action when admin approves (e.g., auto-delete bike)"
 *                         example: true
 *             examples:
 *               success_example:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: "10000000-0000-0000-0000-000000000001"
 *                       name: "Bike's Quality Unmatched Reality"
 *                       description: "Bike received is different from seller description"
 *                       isSystemAutoResolvable: true
 *                     - id: "20000000-0000-0000-0000-000000000002"
 *                       name: "Prohibited Item"
 *                       description: "Item appears to be prohibited or illegal"
 *                       isSystemAutoResolvable: false
 *                     - id: "others"
 *                       name: "Others (Khác)"
 *                       description: "Custom violation - requires detailed explanation"
 *                       isSystemAutoResolvable: false
 *       401:
 *         description: Unauthorized - must be logged in
 */
router.get('/v1/report-reasons', isAuthenticated, getReportReasons);

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
 *     summary: Send message to seller, admin, or inspector
 *     description: |
 *       Send a message to a seller, admin, or inspector.
 *       
 *       **Supports file/image attachments:**
 *       - Upload single file via `attachment` form field (multipart/form-data)
 *       - Allowed formats: images (jpeg, png, webp, gif) and documents (pdf, doc, docx, txt)
 *       - Max file size: 10MB
 *       - Optional: leave empty to send text-only message
 *       
 *       **Constraints:**
 *       - **Cannot initiate** to admin/inspector (403 error if no prior conversation)
 *       - **Can reply** to messages from admin/inspector if they messaged first
 *       - **Cannot send** if conversation is closed by admin/inspector (403 error)
 *       - **Can freely** message sellers/buyers (bidirectional, any time)
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
 *         multipart/form-data:
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
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (image or document, max 10MB)
 *     responses:
 *       201:
 *         description: Tin nhắn đã gửi
 *       403:
 *         description: |
 *           Cannot send message:
 *           - Cannot initiate messages to admin/inspector
 *           - Conversation has been closed
 *       400:
 *         description: Nội dung trống, seller không tồn tại, hoặc loại file không hỗ trợ
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/messages/:sellerId', isAuthenticated, messageUpload, attachFileUrl, sendMessageToSeller);

/**
 * @swagger
 * /api/buyer/v1/messages:
 *   get:
 *     summary: Xem danh sách cuộc hội thoại với các seller
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách cuộc hội thoại
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/messages', isAuthenticated, getConversations);

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
