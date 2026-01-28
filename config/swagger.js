const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bicycle Marketplace API',
      version: '1.0.0',
      description: 'API Documentation cho Website Kết Nối Mua Bán Xe Đạp Thể Thao Cũ',
      contact: {
        name: 'API Support',
        email: 'support@bicyclemarketplace.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.bicyclemarketplace.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập JWT token (chỉ token, không cần "Bearer ")'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email của user'
            },
            full_name: {
              type: 'string',
              description: 'Họ và tên'
            },
            phone: {
              type: 'string',
              description: 'Số điện thoại'
            },
            avatar_url: {
              type: 'string',
              description: 'URL avatar'
            },
            role: {
              type: 'string',
              enum: ['buyer', 'seller', 'inspector', 'admin'],
              description: 'Vai trò của user'
            },
            is_active: {
              type: 'boolean',
              description: 'Trạng thái hoạt động'
            },
            reputation_score: {
              type: 'number',
              format: 'float',
              description: 'Điểm uy tín'
            }
          }
        },
        Bike: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Bike ID'
            },
            title: {
              type: 'string',
              description: 'Tiêu đề tin đăng'
            },
            description: {
              type: 'string',
              description: 'Mô tả chi tiết'
            },
            price: {
              type: 'number',
              description: 'Giá bán (VND)'
            },
            condition: {
              type: 'string',
              enum: ['new', 'like_new', 'good', 'fair', 'poor'],
              description: 'Tình trạng xe'
            },
            year: {
              type: 'integer',
              description: 'Năm sản xuất'
            },
            status: {
              type: 'string',
              enum: ['active', 'sold', 'hidden', 'pending_review'],
              description: 'Trạng thái tin đăng'
            },
            category_id: {
              type: 'integer',
              description: 'ID danh mục'
            },
            brand_id: {
              type: 'integer',
              description: 'ID thương hiệu'
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Order ID'
            },
            bike_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID xe đạp'
            },
            buyer_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID người mua'
            },
            seller_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID người bán'
            },
            total_price: {
              type: 'number',
              description: 'Tổng giá'
            },
            deposit_amount: {
              type: 'number',
              description: 'Tiền đặt cọc'
            },
            status: {
              type: 'string',
              enum: ['pending', 'deposit_paid', 'completed', 'cancelled'],
              description: 'Trạng thái đơn hàng'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Thông báo lỗi'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Thông báo thành công'
            },
            data: {
              type: 'object',
              description: 'Dữ liệu trả về'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'API đăng nhập, đăng ký, quản lý tài khoản'
      },
      {
        name: 'Bikes',
        description: 'API quản lý xe đạp (listings)'
      },
      {
        name: 'Orders',
        description: 'API đặt hàng và quản lý đơn hàng'
      },
      {
        name: 'Reviews',
        description: 'API đánh giá và nhận xét'
      },
      {
        name: 'Messages',
        description: 'API tin nhắn giữa người mua và người bán'
      },
      {
        name: 'Wishlist',
        description: 'API danh sách yêu thích'
      },
      {
        name: 'Inspections',
        description: 'API kiểm định xe'
      },
      {
        name: 'Admin',
        description: 'API quản trị hệ thống (yêu cầu quyền admin)'
      }
    ]
  },
  apis: ['./routes/*.js', './controllers/*.js', './server.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
