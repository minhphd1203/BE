import express from 'express';
import { register, login } from '../controllers/authController';

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

export default router;
