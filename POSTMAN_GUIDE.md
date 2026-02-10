# Hướng dẫn test API với Postman

## 1. Khởi động server

```bash
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

---

## 2. Tạo tài khoản Admin

**Method:** `POST`  
**URL:** `http://localhost:3000/api/auth/register`  
**Headers:**

```json
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "Admin User",
  "phone": "0123456789",
  "role": "admin"
}
```

**Response thành công:**

```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "email": "admin@example.com",
    "name": "Admin User",
    "phone": "0123456789",
    "role": "admin",
    "createdAt": "2026-02-10T..."
  },
  "message": "User registered successfully"
}
```

---

## 3. Đăng nhập để lấy Token

**Method:** `POST`  
**URL:** `http://localhost:3000/api/auth/login`  
**Headers:**

```json
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response thành công:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid...",
      "email": "admin@example.com",
      "name": "Admin User",
      "phone": "0123456789",
      "role": "admin"
    }
  },
  "message": "Login successful"
}
```

⚠️ **LƯU TOKEN NÀY** - Bạn sẽ dùng nó cho tất cả các API admin

---

## 4. Test các Admin APIs

### 4.1. Lấy danh sách xe đạp

**Method:** `GET`  
**URL:** `http://localhost:3000/api/admin/v1/bike`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4.2. Duyệt tin đăng xe đạp

**Method:** `PUT`  
**URL:** `http://localhost:3000/api/admin/v1/bike/{bike_id}/approve`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4.3. Từ chối tin đăng

**Method:** `PUT`  
**URL:** `http://localhost:3000/api/admin/v1/bike/{bike_id}/reject`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body (JSON - optional):**

```json
{
  "reason": "Nội dung không phù hợp"
}
```

### 4.4. Xóa tin đăng

**Method:** `DELETE`  
**URL:** `http://localhost:3000/api/admin/v1/bike/{bike_id}`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4.5. Lấy danh sách người dùng

**Method:** `GET`  
**URL:** `http://localhost:3000/api/admin/v1/user`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
```

### 4.6. Cập nhật thông tin người dùng

**Method:** `PUT`  
**URL:** `http://localhost:3000/api/admin/v1/user/{user_id}`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "name": "Updated Name",
  "phone": "0987654321",
  "role": "admin"
}
```

### 4.7. Xóa người dùng

**Method:** `DELETE`  
**URL:** `http://localhost:3000/api/admin/v1/user/{user_id}`  
**Headers:**

```json
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 📝 Lưu ý

1. **Token có hiạn hạn 24 giờ** - Sau đó cần đăng nhập lại
2. **Authorization Header:** Phải có format `Bearer <token>` (có dấu cách sau Bearer)
3. **Content-Type:** Nhớ set `application/json` khi gửi body
4. **Replace {bike_id}, {user_id}** bằng ID thực tế từ database

---

## 🔧 Cách set Authorization trong Postman

1. Chọn tab **Authorization**
2. Type: **Bearer Token**
3. Paste token vào ô **Token**
4. Hoặc thêm manual vào Headers: `Authorization: Bearer YOUR_TOKEN`

---

## ❌ Các lỗi thường gặp

- **401 Unauthorized:** Token sai hoặc hết hạn → Đăng nhập lại
- **403 Forbidden:** User không phải admin → Kiểm tra role
- **404 Not Found:** ID không tồn tại
- **500 Internal Server Error:** Lỗi server → Check logs
