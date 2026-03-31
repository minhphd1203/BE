import express from 'express';
import { register, login, logout, checkRoles } from '../controllers/authController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới (role mặc định là buyer)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Test@123
 *               name:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserPublic'
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: Email đã tồn tại
 */
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập và lấy JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: seller1@beswp.com
 *               password:
 *                 type: string
 *                 example: Test@123
 *           examples:
 *             Admin:
 *               value:
 *                 email: admin@beswp.com
 *                 password: admin123
 *             Inspector:
 *               value:
 *                 email: inspector1@beswp.com
 *                 password: Test@123
 *             Buyer/Seller:
 *               value:
 *                 email: seller1@beswp.com
 *                 password: Test@123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công - copy token để dùng nút Authorize 🔒
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
 *                     token:
 *                       type: string
 *                       description: "JWT token (hiệu lực 24h) - dùng cho nút Authorize 🔒"
 *                     user:
 *                       $ref: '#/components/schemas/UserPublic'
 *                 message:
 *                   type: string
 *                   example: Login successful
 *       401:
 *         description: Sai email hoặc password
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/check-roles:
 *   post:
 *     summary: Kiểm tra các roles có sẵn cho email (cho multi-role login)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Test@123
 *     responses:
 *       200:
 *         description: Trả về danh sách roles có sẵn
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
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [buyer, seller]
 *                       example: [buyer, seller]
 *                     hasMultipleRoles:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Email không tìm thấy hoặc sai mật khẩu
 */
router.post('/check-roles', checkRoles);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất tài khoản (xóa token khỏi client)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
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
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                 message:
 *                   type: string
 *                   example: Logged out successfully. Please delete the token from your client.
 *       401:
 *         description: Unauthorized - No token provided
 *       500:
 *         description: Server error
 */
router.post('/logout', isAuthenticated, logout);

export default router;
