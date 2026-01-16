# ⚡ QUICK START GUIDE

## Khởi động nhanh trong 5 phút!

### Bước 1: Cài đặt PostgreSQL
- Download: https://www.postgresql.org/download/
- Cài đặt và nhớ password cho user `postgres`

### Bước 2: Tạo Database
```bash
# Mở psql hoặc pgAdmin
CREATE DATABASE bicycle_marketplace;
```

### Bước 3: Chạy Schema
```bash
# Trong terminal
psql -U postgres -d bicycle_marketplace -f database/schema.sql
```

### Bước 4: Setup môi trường
```bash
# Copy .env
cp .env.example .env

# Chỉnh sửa .env với password PostgreSQL của bạn
```

### Bước 5: Cài đặt và chạy
```bash
# Cài đặt
npm install

# Chạy
npm run dev
```

### Bước 6: Test API
Server chạy tại: `http://localhost:5000`

**Test đăng ký:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456",
    "full_name": "Test User",
    "phone": "0901234567",
    "role": "buyer"
  }'
```

**Hoặc dùng Postman:**
1. Import file: `Bicycle_Marketplace_API.postman_collection.json`
2. Chạy request "Register Buyer"
3. Chạy request "Login" để lấy token
4. Test các API khác

---

## 🎯 Test Flow đầy đủ:

### 1. Đăng ký Seller
```json
POST /api/auth/register
{
  "email": "seller@example.com",
  "password": "123456",
  "full_name": "Nguyễn Văn Seller",
  "phone": "0909999999",
  "role": "seller"
}
```

### 2. Login Seller
```json
POST /api/auth/login
{
  "email": "seller@example.com",
  "password": "123456"
}
```
➡️ Lưu `token` từ response

### 3. Tạo tin đăng xe (dùng token)
```json
POST /api/bikes
Header: Authorization: Bearer <token>
{
  "category_id": 1,
  "brand_id": 1,
  "title": "Giant TCR Advanced Pro",
  "description": "Xe đạp đua carbon cao cấp...",
  "price": 25000000,
  "condition": "like_new",
  "location": "TP.HCM"
}
```

### 4. Đăng ký Buyer
```json
POST /api/auth/register
{
  "email": "buyer@example.com",
  "password": "123456",
  "full_name": "Nguyễn Văn Buyer",
  "role": "buyer"
}
```

### 5. Login Buyer và tìm xe
```json
GET /api/bikes/search?page=1
```

### 6. Đặt mua (dùng buyer token)
```json
POST /api/orders
Header: Authorization: Bearer <buyer_token>
{
  "bike_id": "<bike_id_from_search>",
  "deposit_amount": 5000000
}
```

---

## 🔧 Troubleshooting

### Lỗi: "Cannot connect to database"
```bash
# Kiểm tra PostgreSQL đang chạy
# Windows: Services -> PostgreSQL
# Mac: brew services list
# Linux: sudo systemctl status postgresql
```

### Lỗi: "JWT_SECRET is not defined"
```bash
# Đảm bảo file .env tồn tại và có JWT_SECRET
# Copy từ .env.example nếu chưa có
```

### Lỗi: "Cannot find module"
```bash
npm install
```

---

## 📱 Contact & Support

Nếu gặp vấn đề, kiểm tra:
1. ✅ PostgreSQL đang chạy
2. ✅ Database đã được tạo
3. ✅ Schema đã chạy thành công
4. ✅ File .env đã được cấu hình
5. ✅ npm install đã hoàn tất

**Xem chi tiết:** `SETUP.md` và `README.md`

Chúc bạn thành công! 🚀
