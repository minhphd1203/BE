# Backend - Website Kết Nối Mua Bán Xe Đạp Thể Thao Cũ

Backend API cho nền tảng kết nối mua bán xe đạp thể thao đã qua sử dụng, được xây dựng với Node.js, Express.js và PostgreSQL.

## 🚀 Tính năng chính

### Các vai trò người dùng:
- **Guest**: Xem danh sách xe, tìm kiếm
- **Buyer**: Đặt mua, nhắn tin, đánh giá, wishlist
- **Seller**: Đăng tin bán xe, quản lý tin đăng, chat với buyer
- **Inspector**: Kiểm định xe, upload báo cáo
- **Admin**: Quản lý toàn hệ thống

### Chức năng:
- ✅ Xác thực JWT với phân quyền theo role
- ✅ CRUD tin đăng xe đạp với upload ảnh/video
- ✅ Tìm kiếm và lọc xe theo nhiều tiêu chí
- ✅ Hệ thống nhắn tin giữa buyer và seller
- ✅ Đặt mua và quản lý đơn hàng
- ✅ Đánh giá và reputation system
- ✅ Kiểm định xe với báo cáo chi tiết
- ✅ Wishlist
- ✅ Admin dashboard với thống kê

## 📦 Cài đặt

### 1. Cài đặt dependencies:
```bash
npm install
```

### 2. Tạo file .env:
```bash
cp .env.example .env
```

Chỉnh sửa `.env` với thông tin database của bạn:
```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bicycle_marketplace
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
```

### 3. Setup PostgreSQL Database:

#### Tạo database:
```sql
CREATE DATABASE bicycle_marketplace;
```

#### Chạy schema:
```bash
psql -U postgres -d bicycle_marketplace -f database/schema.sql
```

Hoặc copy nội dung file `database/schema.sql` và chạy trong PostgreSQL.

### 4. Chạy server:

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:5000`

## 📁 Cấu trúc thư mục

```
be/
├── config/
│   └── database.js          # Cấu hình kết nối PostgreSQL
├── controllers/
│   ├── authController.js    # Đăng ký, đăng nhập
│   ├── bikeController.js    # CRUD xe đạp
│   ├── orderController.js   # Quản lý đơn hàng
│   ├── messageController.js # Chat/nhắn tin
│   ├── reviewController.js  # Đánh giá
│   ├── wishlistController.js # Danh sách yêu thích
│   ├── inspectionController.js # Kiểm định
│   └── adminController.js   # Quản trị
├── models/
│   ├── User.js
│   ├── Bike.js
│   ├── Order.js
│   ├── Message.js
│   ├── Review.js
│   ├── Inspection.js
│   └── Wishlist.js
├── routes/
│   ├── authRoutes.js
│   ├── bikeRoutes.js
│   ├── orderRoutes.js
│   ├── messageRoutes.js
│   ├── reviewRoutes.js
│   ├── wishlistRoutes.js
│   ├── inspectionRoutes.js
│   └── adminRoutes.js
├── middleware/
│   ├── auth.js              # JWT authentication & authorization
│   ├── upload.js            # Multer file upload
│   └── errorHandler.js      # Error handling
├── database/
│   └── schema.sql           # PostgreSQL schema
├── uploads/                 # Uploaded files
├── .env.example
├── server.js
└── package.json
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Đăng ký tài khoản
- `POST /login` - Đăng nhập
- `GET /profile` - Lấy thông tin profile (authenticated)
- `PUT /profile` - Cập nhật profile (authenticated)
- `POST /change-password` - Đổi mật khẩu (authenticated)

### Bikes (`/api/bikes`)
- `GET /search` - Tìm kiếm và lọc xe (public)
- `GET /:id` - Xem chi tiết xe (public)
- `POST /` - Đăng tin bán xe (seller)
- `GET /my/listings` - Lấy xe của mình (seller)
- `PUT /:id` - Cập nhật tin đăng (seller)
- `DELETE /:id` - Xóa tin đăng (seller)
- `POST /:bikeId/images` - Upload ảnh (seller)
- `DELETE /images/:imageId` - Xóa ảnh (seller)

### Orders (`/api/orders`)
- `POST /` - Tạo đơn đặt mua (buyer)
- `GET /my-orders` - Lấy đơn của buyer (buyer)
- `GET /seller-orders` - Lấy đơn của seller (seller)
- `GET /:id` - Chi tiết đơn hàng (authenticated)
- `PUT /:id/status` - Cập nhật trạng thái (seller/admin)

### Messages (`/api/messages`)
- `POST /` - Gửi tin nhắn (authenticated)
- `GET /conversations` - Danh sách cuộc hội thoại (authenticated)
- `GET /conversation/:userId/:bikeId` - Lấy tin nhắn (authenticated)

### Reviews (`/api/reviews`)
- `POST /` - Tạo đánh giá (buyer)
- `GET /seller/:sellerId` - Xem đánh giá của seller (public)

### Wishlist (`/api/wishlist`)
- `POST /` - Thêm vào wishlist (authenticated)
- `GET /` - Lấy wishlist (authenticated)
- `DELETE /:bikeId` - Xóa khỏi wishlist (authenticated)
- `GET /check/:bikeId` - Kiểm tra (authenticated)

### Inspections (`/api/inspections`)
- `POST /request` - Yêu cầu kiểm định (seller)
- `GET /inspector/my-inspections` - Danh sách của inspector (inspector)
- `GET /pending` - Pending inspections (inspector/admin)
- `PUT /:id` - Cập nhật kết quả (inspector/admin)
- `GET /bike/:bikeId` - Lịch sử kiểm định (public)

### Admin (`/api/admin`)
- `GET /users` - Danh sách users
- `PUT /users/:userId/status` - Kích hoạt/khóa user
- `GET /bikes/pending` - Tin đăng chờ duyệt
- `PUT /bikes/:bikeId/approve` - Duyệt tin đăng
- `GET /statistics` - Thống kê hệ thống
- `GET /categories` - Danh mục xe
- `POST /categories` - Tạo danh mục
- `GET /brands` - Thương hiệu
- `POST /brands` - Tạo thương hiệu

## 🔐 Authentication

API sử dụng JWT Bearer token. Thêm token vào header:
```
Authorization: Bearer <your_token>
```

## 📊 Database Schema

Database bao gồm các bảng chính:
- **users**: Quản lý người dùng với các role
- **bikes**: Tin đăng xe đạp
- **bike_images**, **bike_videos**: Media files
- **bike_specs**: Thông số kỹ thuật
- **orders**: Đơn đặt mua
- **messages**: Tin nhắn
- **reviews**: Đánh giá
- **inspections**: Kiểm định
- **wishlists**: Danh sách yêu thích
- **categories**, **brands**: Danh mục và thương hiệu

## 🛠️ Tech Stack

- **Node.js** - Runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **pg** - PostgreSQL client
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **multer** - File upload
- **joi** - Validation
- **cors** - CORS middleware
- **dotenv** - Environment variables

## 📝 Lưu ý

- File uploads được lưu trong thư mục `uploads/`
- Mặc định max file size là 5MB
- JWT token expire sau 7 ngày
- Tin đăng mới cần admin duyệt trước khi hiển thị

## 🤝 Contributing

Đây là project học tập. Mọi đóng góp đều được hoan nghênh!

## 📄 License

ISC
