# HƯỚNG DẪN SETUP VÀ CHẠY BACKEND

## Bước 1: Cài đặt PostgreSQL

1. Tải và cài đặt PostgreSQL từ: https://www.postgresql.org/download/
2. Trong quá trình cài đặt, nhớ mật khẩu cho user `postgres`

## Bước 2: Tạo Database

Mở PostgreSQL command line (psql) hoặc pgAdmin và chạy:

```sql
CREATE DATABASE bicycle_marketplace;
```

## Bước 3: Chạy Database Schema

### Cách 1: Dùng command line
```bash
psql -U postgres -d bicycle_marketplace -f database/schema.sql
```

### Cách 2: Dùng pgAdmin
1. Mở pgAdmin
2. Kết nối đến database `bicycle_marketplace`
3. Mở Query Tool
4. Copy toàn bộ nội dung file `database/schema.sql`
5. Paste vào Query Tool và Execute

## Bước 4: Cấu hình Environment Variables

1. Copy file .env.example thành .env:
```bash
cp .env.example .env
```

2. Chỉnh sửa file .env với thông tin của bạn:
```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bicycle_marketplace
DB_USER=postgres
DB_PASSWORD=your_actual_password_here

JWT_SECRET=change_this_to_random_string_123456789
JWT_EXPIRE=7d

MAX_FILE_SIZE=5242880
```

## Bước 5: Cài đặt Node Modules

```bash
npm install
```

## Bước 6: Chạy Server

### Development mode (với nodemon - tự động restart khi code thay đổi):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server sẽ chạy tại: **http://localhost:5000**

## Bước 7: Test API

### Kiểm tra server đang chạy:
Mở trình duyệt hoặc Postman và truy cập:
```
http://localhost:5000
```

Bạn sẽ thấy response JSON với danh sách các endpoints.

### Test đăng ký user:

**Endpoint:** `POST http://localhost:5000/api/auth/register`

**Body (JSON):**
```json
{
  "email": "buyer1@example.com",
  "password": "123456",
  "full_name": "Nguyễn Văn A",
  "phone": "0901234567",
  "role": "buyer"
}
```

**Response thành công:**
```json
{
  "success": true,
  "message": "Đăng ký thành công!",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "buyer1@example.com",
      "full_name": "Nguyễn Văn A",
      "role": "buyer"
    },
    "token": "jwt-token-here"
  }
}
```

### Test đăng nhập:

**Endpoint:** `POST http://localhost:5000/api/auth/login`

**Body (JSON):**
```json
{
  "email": "buyer1@example.com",
  "password": "123456"
}
```

## Bước 8: Tạo Admin User (Optional)

Vì admin không thể đăng ký qua API, bạn cần tạo trực tiếp trong database:

```sql
-- Đăng ký 1 user bình thường trước qua API
-- Sau đó update role thành admin:

UPDATE users 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

## Bước 9: Test các API khác

### Với Postman hoặc Thunder Client:

1. **Tạo tin đăng xe (Seller):**
   - Đăng ký/login với role='seller'
   - POST `/api/bikes` với Bearer token
   - Body: thông tin xe

2. **Tìm kiếm xe (Public):**
   - GET `/api/bikes/search?keyword=giant&min_price=1000000`

3. **Upload ảnh:**
   - POST `/api/bikes/:bikeId/images`
   - Form-data với field `images` (file)

4. **Đặt mua (Buyer):**
   - POST `/api/orders` với Bearer token
   - Body: bike_id, deposit_amount

## Các lỗi thường gặp:

### 1. Connection refused to PostgreSQL
- Kiểm tra PostgreSQL đang chạy
- Kiểm tra thông tin DB_HOST, DB_PORT trong .env

### 2. JWT_SECRET missing
- Đảm bảo đã set JWT_SECRET trong file .env

### 3. Cannot find module
- Chạy lại `npm install`

### 4. Upload file lỗi
- Kiểm tra thư mục uploads/ đã được tạo
- Kiểm tra permissions của thư mục

## Tools hữu ích:

- **Postman**: Test API - https://www.postman.com/
- **Thunder Client**: VS Code extension để test API
- **pgAdmin**: Quản lý PostgreSQL GUI
- **DBeaver**: Database management tool đa nền tảng

## Các bước tiếp theo:

1. Test tất cả các API endpoints
2. Tạo dữ liệu mẫu (categories, brands, users, bikes)
3. Kết nối với frontend
4. Deploy lên server (Heroku, Railway, VPS)

Chúc bạn thành công! 🚀
