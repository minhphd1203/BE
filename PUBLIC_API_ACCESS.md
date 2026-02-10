# 🌐 Public API Access

## URL Công khai của bạn:
```
https://acred-steamy-gilberte.ngrok-free.dev
```

## ✅ Đã kiểm tra - API hoạt động tốt!

Bất kỳ ai cũng có thể gọi API của bạn bằng URL này.

## ⚠️ LƯU Ý: NGROK FREE PLAN WARNING PAGE

Khi mở URL bằng browser, ngrok sẽ hiển thị trang cảnh báo trước:
- **Giải pháp Browser:** Click nút "Visit Site" để tiếp tục
- **Giải pháp Postman/Code:** Thêm header `ngrok-skip-browser-warning: true`

```javascript
// Example: Add header to bypass warning
headers: {
  "ngrok-skip-browser-warning": "true"
}
```

---

## 📝 Hướng dẫn sử dụng cho người khác

### 0. Test API Health (GET - Có thể test bằng browser)
```bash
GET https://acred-steamy-gilberte.ngrok-free.dev/
GET https://acred-steamy-gilberte.ngrok-free.dev/api/health
```
Nhớ click "Visit Site" trên trang cảnh báo ngrok lần đầu!

### 1. Đăng nhập để lấy token
```bash
POST https://acred-steamy-gilberte.ngrok-free.dev/api/auth/login
Content-Type: application/json
ngrok-skip-browser-warning: true

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": { ... }
  }
}
```
ngrok-skip-browser-warning: true

### 2. Sử dụng token để gọi các API khác
Thêm header: `Authorization: Bearer YOUR_TOKEN`

**Ví dụ - Lấy danh sách bikes:**
```bash
GET https://acred-steamy-gilberte.ngrok-free.dev/api/admin/bikes
Authorization: Bearer eyJhbGc...
```

---

## 📋 Danh sách API có sẵn

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập

### Admin APIs (cần token)
**Bikes:**
- `GET /api/admin/bikes` - Lấy tất cả bikes
- `PUT /api/admin/bikes/:id/approve` - Duyệt bike
- `PUT /api/admin/bikes/:id/reject` - Từ chối bike
- `DELETE /api/admin/bikes/:id` - Xóa bike

**Users:**
- `GET /api/admin/users` - Lấy tất cả users
- `PUT /api/admin/users/:id` - Cập nhật user
- `DELETE /api/admin/users/:id` - Xóa user

**Categories:**
- `GET /api/admin/categories` - Lấy tất cả categories
- `POST /api/admin/categories` - Tạo category mới
- `PUT /api/admin/categories/:id` - Cập nhật category
- `DELETE /api/admin/categories/:id` - Xóa category

**Transactions:**
- `GET /api/admin/transactions` - Lấy tất cả transactions
- `PUT /api/admin/transactions/:id` - Cập nhật transaction

**Reports:**
- `GET /api/admin/reports` - Lấy tất cả reports
- `PUT /api/admin/reports/:id/resolve` - Giải quyết report

---

## ⚠️ LƯU Ý QUAN TRỌNG

### Ngrok Free Plan:
- ✅ **Ưu điểm:** Miễn phí, setup nhanh, hoạt động ngay
- ⚠️ **Hạn chế:** 
  - URL này chỉ hoạt động khi terminal ngrok đang chạy
  - Nếu bạn tắt terminal hoặc tắt máy → URL sẽ không hoạt động
  - Khi restart ngrok → URL có thể thay đổi (free plan)
  - Giới hạn 40 kết nối/phút

### Để giữ API online:
1. **Không tắt terminal ngrok** (terminal ID: 1f246bdd-fc85-4552-a5b6-b780df21ceb7)
2. **Không tắt server Node.js** (đang chạy trên port 3000)
3. Nếu restart máy → phải chạy lại cả 2:
   ```powershell
   # Terminal 1: Start server
   npm run dev
   
   # Terminal 2: Start ngrok
   ngrok http 3000
   ```

---

## 🎯 Test nhanh bằng curl:

``Test health check (GET - dễ nhất)
# Windows PowerShell
Invoke-WebRequest -Uri "https://acred-steamy-gilberte.ngrok-free.dev/" -Headers @{"ngrok-skip-browser-warning"="true"} -UseBasicParsing

# Linux/Mac
curl -H "ngrok-skip-browser-warning: true" https://acred-steamy-gilberte.ngrok-free.dev/

# Test login (POST)
# Windows PowerShell
Invoke-WebRequest -Uri "https://acred-steamy-gilberte.ngrok-free.dev/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"; "ngrok-skip-browser-warning"="true"} -Body '{"email":"admin@example.com","password":"admin123"}' -UseBasicParsing

# Linux/Mac
curl -X POST https://acred-steamy-gilberte.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: truelberte.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## 📱 Postman Collection
Bạn có thể update file `BESWP_API.postman_collection.json` bằng cách thay:
- `http://localhost:3000` → `https://acred-steamy-gilberte.ngrok-free.dev`

---

## 🔄 Nếu cần URL cố định (không đổi):

1. **Ngrok Paid Plan** ($8/tháng): Cho phép custom domain
2. **Deploy lên Cloud:**
   - Vercel (miễn phí cho hobby)
   - Railway (miễn phí $5 credit/tháng)
   - Render (miễn phí nhưng sleep sau 15 phút không dùng)
   - Heroku (paid only)

