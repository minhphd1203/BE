const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Tất cả routes đều yêu cầu admin role
router.use(authenticate, authorize('admin'));

/**
 * @swagger
 * /api/admin/statistics:
 *   get:
 *     summary: Lấy thống kê tổng quan cho Dashboard
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê thành công
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
 *                     total_users:
 *                       type: integer
 *                       example: 12450
 *                     new_listings:
 *                       type: integer
 *                       example: 320
 *                     pending_reviews:
 *                       type: integer
 *                       example: 85
 *                     reports:
 *                       type: integer
 *                       example: 18
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền truy cập
 */
router.get('/statistics', adminController.getStatistics);

/**
 * @swagger
 * /api/admin/recent-listings:
 *   get:
 *     summary: Lấy danh sách listing gần đây
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng listing
 *     responses:
 *       200:
 *         description: Danh sách listing
 */
router.get('/recent-listings', adminController.getRecentListings);

/**
 * @swagger
 * /api/admin/listings:
 *   get:
 *     summary: Lấy tất cả listings với filter
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, active, approved, rejected, sold, hidden]
 *         description: Trạng thái listing
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: ID danh mục
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Tên user để tìm kiếm
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách listings với pagination
 */
router.get('/listings', adminController.getAllListings);

/**
 * @swagger
 * /api/admin/listings/{bikeId}:
 *   get:
 *     summary: Lấy chi tiết listing để review
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của bike
 *     responses:
 *       200:
 *         description: Chi tiết listing
 *       404:
 *         description: Không tìm thấy listing
 */
router.get('/listings/:bikeId', adminController.getListingDetail);

/**
 * @swagger
 * /api/admin/listings/{bikeId}/review:
 *   post:
 *     summary: Approve hoặc Reject listing
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
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
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Hành động (approve hoặc reject)
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối (bắt buộc khi reject)
 *             example:
 *               action: approve
 *               reason: Xe hư hỏng nhiều quá
 *     responses:
 *       200:
 *         description: Xử lý thành công
 */
router.post('/listings/:bikeId/review', adminController.reviewListing);

/**
 * @swagger
 * /api/admin/inspectors:
 *   get:
 *     summary: Lấy danh sách tất cả inspectors
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách inspectors với thống kê
 */
router.get('/inspectors', adminController.getAllInspectors);

/**
 * @swagger
 * /api/admin/inspectors:
 *   post:
 *     summary: Tạo inspector mới
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - full_name
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               full_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo inspector thành công
 */
router.post('/inspectors', adminController.createInspector);

/**
 * @swagger
 * /api/admin/inspectors/{inspectorId}/status:
 *   put:
 *     summary: Bật/tắt inspector
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inspectorId
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
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put('/inspectors/:inspectorId/status', adminController.toggleInspectorStatus);

// === USER MANAGEMENT ===
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/status', adminController.toggleUserStatus);

// === REPORTS MANAGEMENT ===
router.get('/reports', adminController.getReports);
router.post('/reports/:reportId/handle', adminController.handleReport);

// Các routes cũ (để backward compatibility)
router.get('/bikes/pending', adminController.getPendingBikes);
router.put('/bikes/:bikeId/approve', adminController.approveBike);

// === CATEGORIES & BRANDS ===
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.get('/brands', adminController.getBrands);
router.post('/brands', adminController.createBrand);

module.exports = router;
