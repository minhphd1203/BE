# 📚 Swagger API Documentation

## Truy cập Swagger UI

Sau khi chạy server, truy cập:

```
http://localhost:5000/api-docs
```

## Tính năng

✅ **Interactive API Documentation** - Test API trực tiếp trên trình duyệt  
✅ **JWT Authentication** - Hỗ trợ Bearer Token authentication  
✅ **Request/Response Examples** - Ví dụ rõ ràng cho mỗi endpoint  
✅ **Schema Definitions** - Cấu trúc dữ liệu chi tiết  
✅ **Try it out** - Thực thi API ngay trên giao diện

---

## Cách sử dụng Authentication

### 1. Đăng nhập để lấy token

1. Mở Swagger UI: http://localhost:5000/api-docs
2. Tìm endpoint **POST /api/auth/login** trong section **Authentication**
3. Click **"Try it out"**
4. Nhập thông tin:
   ```json
   {
     "email": "admin@example.com",
     "password": "admin123"
   }
   ```
5. Click **"Execute"**
6. Copy token từ response (không bao gồm dấu ngoặc kép)

### 2. Authorize với token

1. Click nút **"Authorize"** 🔒 ở góc trên bên phải
2. Paste token vào field **Value**
3. Click **"Authorize"**
4. Click **"Close"**

✅ Bây giờ bạn có thể test các API yêu cầu authentication!

---

## Các API đã có documentation

### 🔐 Authentication APIs
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy thông tin profile
- `PUT /api/auth/profile` - Cập nhật profile
- `POST /api/auth/change-password` - Đổi mật khẩu

### 👨‍💼 Admin APIs
- `GET /api/admin/statistics` - Thống kê Dashboard
- `GET /api/admin/recent-listings` - Listings gần đây
- `GET /api/admin/listings` - Quản lý listings (filter, pagination)
- `GET /api/admin/listings/:bikeId` - Chi tiết listing
- `POST /api/admin/listings/:bikeId/review` - Approve/Reject listing
- `GET /api/admin/inspectors` - Quản lý inspectors
- `POST /api/admin/inspectors` - Tạo inspector mới
- `PUT /api/admin/inspectors/:inspectorId/status` - Toggle inspector

---

## Thêm JSDoc cho routes khác

Để thêm documentation cho routes khác (bikes, orders, reviews, etc.), thêm JSDoc comment trước mỗi route:

```javascript
/**
 * @swagger
 * /api/bikes:
 *   get:
 *     summary: Lấy danh sách xe đạp
 *     tags: [Bikes]
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
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách xe đạp
 */
router.get('/', bikeController.getAllBikes);
```

---

## Cấu hình nâng cao

### Thay đổi URL server trong Swagger

Sửa file `config/swagger.js`:

```javascript
servers: [
  {
    url: 'http://localhost:5000',
    description: 'Development server'
  },
  {
    url: 'https://api.bicyclemarketplace.com',
    description: 'Production server'
  }
]
```

### Custom CSS

Swagger đã được tùy chỉnh để ẩn top bar. Có thể thêm CSS khác trong `server.js`:

```javascript
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
  `,
  customSiteTitle: 'Bicycle Marketplace API'
}));
```

---

## Swagger JSON Spec

Nếu cần export JSON spec:

```
http://localhost:5000/api-docs.json
```

Hoặc tạo route mới trong `server.js`:

```javascript
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
```

---

## Tips

1. **Testing Admin APIs**: Cần đăng nhập với tài khoản admin
2. **UUID Parameters**: Sử dụng UUID hợp lệ từ database
3. **File Upload**: Swagger hỗ trợ file upload (sẽ thêm sau)
4. **Error Handling**: Tất cả errors đều trả về format chuẩn

---

## Screenshots

### 1. Swagger UI Homepage
![Swagger Homepage](screenshots/swagger-home.png)

### 2. Authentication Section
![Auth APIs](screenshots/swagger-auth.png)

### 3. Admin Dashboard APIs
![Admin APIs](screenshots/swagger-admin.png)

---

## Deploy Swagger lên Production

### Option 1: Swagger UI public
Giữ nguyên như hiện tại, ai cũng xem được docs

### Option 2: Protect Swagger với Basic Auth
```javascript
const basicAuth = require('express-basic-auth');

app.use('/api-docs', 
  basicAuth({
    users: { 'admin': 'password123' },
    challenge: true
  }),
  swaggerUi.serve, 
  swaggerUi.setup(swaggerSpec)
);
```

### Option 3: Disable Swagger trên Production
```javascript
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

---

**🎉 Swagger đã được cấu hình thành công!**

Truy cập: **http://localhost:5000/api-docs**
