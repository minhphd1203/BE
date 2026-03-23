import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bike Exchange System API',
      version: '1.0.0',
      description: `## Bike Exchange System API\n\nHệ thống mua bán xe đạp cũ có kiểm định chất lượng.\n\n### 🔐 Hướng dẫn xác thực\n1. Gọi **POST /api/auth/login** để lấy JWT token\n2. Click nút **Authorize** 🔒 ở trên cùng bên phải\n3. Nhập vào ô Value: \`Bearer <token_của_bạn>\`\n4. Click **Authorize** → **Close**\n5. Tất cả API có 🔒 sẽ tự động dùng token đó\n\n### 👥 Tài khoản test\n| Role | Email | Password |\n|------|-------|----------|\n| 👑 Admin | admin@beswp.com | admin123 |\n| 🔍 Inspector | inspector1@beswp.com | Test@123 |\n| 🛒 Buyer / Seller | seller1@beswp.com | Test@123 |`,
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
    tags: [
      { name: 'Auth', description: '🔐 Đăng ký và đăng nhập' },
      { name: 'Admin - Bikes', description: '👑 Quản lý xe đạp (Admin only)' },
      { name: 'Admin - Users', description: '👑 Quản lý người dùng (Admin only)' },
      { name: 'Admin - Transactions', description: '👑 Quản lý giao dịch (Admin only)' },
      { name: 'Admin - Reports', description: '👑 Quản lý khiếu nại (Admin only)' },
      { name: 'Admin - Categories', description: '👑 Quản lý danh mục xe (Admin only)' },
      { name: 'Seller', description: '🏪 Đăng bán xe, quản lý tin đăng và giao dịch' },
      { name: 'Buyer', description: '🛒 Tìm kiếm, mua xe và quản lý giao dịch' },
      { name: 'Inspector', description: '🔍 Kiểm định xe đạp (Inspector only)' },
      { name: 'Payment', description: '💳 Thanh toán VNPay' },
      { name: 'Health', description: '🟢 Kiểm tra trạng thái server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập token theo format: Bearer <token>',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
        UserPublic: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string', nullable: true },
            avatar: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['buyer', 'inspector', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Bike: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            brand: { type: 'string' },
            model: { type: 'string' },
            year: { type: 'integer' },
            price: { type: 'number' },
            condition: { type: 'string', enum: ['excellent', 'good', 'fair'] },
            mileage: { type: 'integer', nullable: true },
            color: { type: 'string', nullable: true },
            images: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            isVerified: { type: 'string', enum: ['not_verified', 'verified', 'failed'] },
            inspectionStatus: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            categoryId: { type: 'string', format: 'uuid', nullable: true },
            sellerId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            bikeId: { type: 'string', format: 'uuid' },
            buyerId: { type: 'string', format: 'uuid' },
            sellerId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
            paymentMethod: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Inspection: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            bikeId: { type: 'string', format: 'uuid' },
            inspectorId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['passed', 'failed'] },
            overallCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] },
            frameCondition: { type: 'string', nullable: true },
            brakeCondition: { type: 'string', nullable: true },
            drivetrainCondition: { type: 'string', nullable: true },
            wheelCondition: { type: 'string', nullable: true },
            inspectionNote: { type: 'string', nullable: true },
            recommendation: { type: 'string', nullable: true },
            inspectionImages: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Report: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reporterId: { type: 'string', format: 'uuid' },
            reportedUserId: { type: 'string', format: 'uuid', nullable: true },
            reportedBikeId: { type: 'string', format: 'uuid', nullable: true },
            reason: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'resolved', 'rejected'] },
            resolution: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './server.ts',
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const specs = swaggerJsdoc(options);
