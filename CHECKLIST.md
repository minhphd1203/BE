# ✅ CHECKLIST - KIỂM TRA TRƯỚC KHI CHẠY

## 📋 Chuẩn bị môi trường

### 1. PostgreSQL
- [ ] PostgreSQL đã được cài đặt
- [ ] PostgreSQL service đang chạy
- [ ] Có thể kết nối với user `postgres`
- [ ] Biết password của user `postgres`

### 2. Node.js & npm
- [ ] Node.js version >= 14.x đã được cài đặt
- [ ] npm hoạt động bình thường
- [ ] Có thể chạy `npm install`

### 3. Database Setup
- [ ] Database `bicycle_marketplace` đã được tạo
- [ ] File `database/schema.sql` đã được chạy thành công
- [ ] Các tables đã tồn tại (check bằng psql hoặc pgAdmin)
- [ ] Sample categories và brands đã được insert

### 4. Configuration
- [ ] File `.env` đã được tạo từ `.env.example`
- [ ] `DB_HOST` đã được cấu hình
- [ ] `DB_PORT` đã được cấu hình (default: 5432)
- [ ] `DB_NAME` = `bicycle_marketplace`
- [ ] `DB_USER` = `postgres` (hoặc user của bạn)
- [ ] `DB_PASSWORD` đã được set đúng
- [ ] `JWT_SECRET` đã được thay đổi (không để mặc định)
- [ ] `PORT` đã được set (default: 5000)

### 5. Dependencies
- [ ] `npm install` đã chạy thành công
- [ ] `node_modules/` folder tồn tại
- [ ] Không có error trong quá trình install

---

## 🚀 Chạy thử lần đầu

### 1. Start Server
```bash
npm run dev
```

- [ ] Server khởi động không lỗi
- [ ] Thấy message: "✅ Đã kết nối thành công tới PostgreSQL"
- [ ] Thấy message: "🚀 Server đang chạy tại http://localhost:5000"

### 2. Test Connection
Mở browser hoặc Postman:
```
GET http://localhost:5000
```

- [ ] Response trả về JSON với danh sách endpoints
- [ ] Status code: 200 OK

### 3. Test Register
```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456",
  "full_name": "Test User",
  "phone": "0901234567",
  "role": "buyer"
}
```

- [ ] Status code: 201
- [ ] Response có `success: true`
- [ ] Response có `token`
- [ ] User được tạo trong database

### 4. Test Login
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456"
}
```

- [ ] Status code: 200
- [ ] Response có `token`
- [ ] Token là JWT hợp lệ

---

## 🔍 Kiểm tra Database

### Chạy queries để verify:

```sql
-- 1. Kiểm tra tables đã tồn tại
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. Kiểm tra categories
SELECT * FROM categories;

-- 3. Kiểm tra brands
SELECT * FROM brands;

-- 4. Kiểm tra user vừa tạo
SELECT id, email, full_name, role 
FROM users 
WHERE email = 'test@example.com';
```

- [ ] Tất cả tables tồn tại (15 tables)
- [ ] Categories có dữ liệu (5 rows)
- [ ] Brands có dữ liệu (7 rows)
- [ ] User test đã được tạo

---

## 📱 Test với Postman

### 1. Import Collection
- [ ] File `Bicycle_Marketplace_API.postman_collection.json` đã import
- [ ] Collection hiển thị trong Postman
- [ ] Variable `baseUrl` đã được set

### 2. Test Authentication Flow
- [ ] Register Buyer - Success ✅
- [ ] Register Seller - Success ✅
- [ ] Login Buyer - Success ✅ (token saved)
- [ ] Login Seller - Success ✅ (token saved)
- [ ] Get Profile - Success ✅

### 3. Test Bike Flow (Seller)
- [ ] Create Bike - Success ✅
- [ ] Get My Bikes - Success ✅
- [ ] Upload Images - Success ✅
- [ ] Update Bike - Success ✅

### 4. Test Search (Public)
- [ ] Search Bikes - Success ✅
- [ ] Get Bike Detail - Success ✅

### 5. Test Order Flow (Buyer)
- [ ] Create Order - Success ✅
- [ ] Get My Orders - Success ✅

### 6. Test Wishlist (Buyer)
- [ ] Add to Wishlist - Success ✅
- [ ] Get Wishlist - Success ✅
- [ ] Remove from Wishlist - Success ✅

---

## 🛡️ Security Check

- [ ] JWT token được verify đúng
- [ ] Buyer không thể đăng tin bán xe
- [ ] Seller không thể edit xe của seller khác
- [ ] Guest không thể tạo order
- [ ] Password không hiển thị trong response
- [ ] File upload chỉ chấp nhận ảnh/video

---

## 📊 Performance Check

- [ ] Search bikes response < 500ms
- [ ] Database queries không có N+1 problem
- [ ] Images được serve từ static folder
- [ ] CORS hoạt động với frontend

---

## 📝 Documentation Check

- [ ] README.md rõ ràng và đầy đủ
- [ ] SETUP.md có hướng dẫn chi tiết
- [ ] API_DOCS.md có tất cả endpoints
- [ ] Postman collection hoạt động
- [ ] Comments trong code đủ dễ hiểu

---

## 🎯 Final Check

### Trước khi commit code:
- [ ] Không có file `.env` trong git
- [ ] `.gitignore` đã cấu hình đúng
- [ ] `node_modules/` không trong git
- [ ] Không có lỗi trong console
- [ ] Tất cả API endpoints đã test
- [ ] Database schema hoàn chỉnh
- [ ] Documentation đầy đủ

### Trước khi deploy:
- [ ] Change JWT_SECRET thành giá trị ngẫu nhiên
- [ ] Set NODE_ENV=production
- [ ] Database có backup
- [ ] SSL được enable
- [ ] Rate limiting được thêm vào
- [ ] Logging được cấu hình

---

## ✨ Tất cả đã sẵn sàng khi:

✅ Server chạy không lỗi  
✅ Database kết nối thành công  
✅ Register/Login hoạt động  
✅ Tất cả API endpoints test pass  
✅ Postman collection hoạt động  
✅ Documentation đầy đủ  

## 🎉 Chúc mừng! Hệ thống đã sẵn sàng!

**Next steps:**
1. Tạo frontend để kết nối với API
2. Test integration với frontend
3. Deploy lên production server
4. Setup monitoring và logging

---

**Lưu ý:** Nếu có bất kỳ bước nào chưa pass, quay lại check lại cấu hình hoặc xem SETUP.md để biết chi tiết.
