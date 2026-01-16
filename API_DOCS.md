# API DOCUMENTATION - Bicycle Marketplace

Base URL: `http://localhost:5000/api`

## 📝 Authentication

Tất cả protected endpoints yêu cầu JWT token trong header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication Endpoints

### 1. Đăng ký

**POST** `/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "123456",
  "full_name": "Nguyễn Văn A",
  "phone": "0901234567",
  "role": "buyer"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Đăng ký thành công!",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "Nguyễn Văn A",
      "role": "buyer"
    },
    "token": "jwt_token_here"
  }
}
```

### 2. Đăng nhập

**POST** `/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

### 3. Lấy Profile

**GET** `/auth/profile`

**Headers:** `Authorization: Bearer <token>`

### 4. Cập nhật Profile

**PUT** `/auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "full_name": "Nguyễn Văn B",
  "phone": "0909999999"
}
```

---

## 🚲 Bike Endpoints

### 1. Tìm kiếm xe

**GET** `/bikes/search`

**Query Parameters:**
- `keyword`: Từ khóa tìm kiếm
- `category_id`: ID danh mục
- `brand_id`: ID thương hiệu
- `condition`: Tình trạng (new, like_new, good, fair, poor)
- `min_price`: Giá tối thiểu
- `max_price`: Giá tối đa
- `is_inspected`: true/false
- `sort_by`: created_at, price, view_count
- `order`: asc, desc
- `page`: Trang (default: 1)
- `limit`: Số lượng/trang (default: 20)

**Example:**
```
GET /bikes/search?keyword=giant&min_price=5000000&max_price=20000000&sort_by=price&order=asc&page=1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Giant TCR Advanced Pro",
      "price": 25000000,
      "condition": "like_new",
      "location": "TP.HCM",
      "category_name": "Xe đạp đua",
      "brand_name": "Giant",
      "seller_name": "Nguyễn Văn A",
      "primary_image": "/uploads/bikes/image.jpg",
      "view_count": 150,
      "is_inspected": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### 2. Chi tiết xe

**GET** `/bikes/:id`

### 3. Đăng tin bán xe (Seller only)

**POST** `/bikes`

**Headers:** `Authorization: Bearer <seller_token>`

**Body:**
```json
{
  "category_id": 1,
  "brand_id": 2,
  "title": "Giant TCR Advanced Pro - Carbon",
  "description": "Mô tả chi tiết về xe...",
  "price": 25000000,
  "condition": "like_new",
  "frame_size": "52cm",
  "year_of_manufacture": 2023,
  "color": "Đen/Đỏ",
  "location": "Quận 1, TP.HCM",
  "specs": {
    "frame_material": "Carbon",
    "brake_type": "Shimano 105",
    "gear_system": "2x11 speed",
    "wheel_size": "700c",
    "suspension_type": "Không",
    "usage_history": "Đã sử dụng 6 tháng"
  }
}
```

### 4. Upload ảnh xe

**POST** `/bikes/:bikeId/images`

**Headers:** 
- `Authorization: Bearer <seller_token>`
- `Content-Type: multipart/form-data`

**Body (Form-data):**
- `images`: File[] (tối đa 10 ảnh)

### 5. Lấy xe của mình (Seller)

**GET** `/bikes/my/listings`

**Headers:** `Authorization: Bearer <seller_token>`

### 6. Cập nhật tin đăng

**PUT** `/bikes/:id`

**Headers:** `Authorization: Bearer <seller_token>`

### 7. Xóa tin đăng

**DELETE** `/bikes/:id`

---

## 📦 Order Endpoints

### 1. Tạo đơn đặt mua

**POST** `/orders`

**Headers:** `Authorization: Bearer <buyer_token>`

**Body:**
```json
{
  "bike_id": "uuid",
  "deposit_amount": 5000000,
  "notes": "Tôi muốn xem xe vào cuối tuần"
}
```

### 2. Lấy đơn hàng của mình (Buyer)

**GET** `/orders/my-orders`

### 3. Lấy đơn hàng seller

**GET** `/orders/seller-orders`

### 4. Chi tiết đơn hàng

**GET** `/orders/:id`

### 5. Cập nhật trạng thái

**PUT** `/orders/:id/status`

**Body:**
```json
{
  "status": "completed"
}
```

---

## 💬 Message Endpoints

### 1. Gửi tin nhắn

**POST** `/messages`

**Body:**
```json
{
  "receiver_id": "uuid",
  "bike_id": "uuid",
  "content": "Xe còn không bạn?"
}
```

### 2. Danh sách cuộc hội thoại

**GET** `/messages/conversations`

### 3. Lấy tin nhắn với user về xe

**GET** `/messages/conversation/:userId/:bikeId`

---

## ⭐ Review Endpoints

### 1. Đánh giá seller

**POST** `/reviews`

**Body:**
```json
{
  "order_id": "uuid",
  "rating": 5,
  "comment": "Seller rất tốt, xe đẹp như mô tả"
}
```

### 2. Xem đánh giá của seller

**GET** `/reviews/seller/:sellerId`

---

## ❤️ Wishlist Endpoints

### 1. Thêm vào wishlist

**POST** `/wishlist`

**Body:**
```json
{
  "bike_id": "uuid"
}
```

### 2. Lấy wishlist

**GET** `/wishlist`

### 3. Xóa khỏi wishlist

**DELETE** `/wishlist/:bikeId`

### 4. Kiểm tra xe trong wishlist

**GET** `/wishlist/check/:bikeId`

---

## 🔍 Inspection Endpoints

### 1. Yêu cầu kiểm định (Seller)

**POST** `/inspections/request`

**Body:**
```json
{
  "bike_id": "uuid"
}
```

### 2. Danh sách kiểm định (Inspector)

**GET** `/inspections/inspector/my-inspections`

### 3. Pending inspections

**GET** `/inspections/pending`

### 4. Cập nhật kết quả kiểm định

**PUT** `/inspections/:id`

**Body:**
```json
{
  "status": "completed",
  "frame_condition": "excellent",
  "brake_condition": "good",
  "drivetrain_condition": "good",
  "overall_rating": 8.5,
  "notes": "Xe trong tình trạng tốt",
  "report_url": "/uploads/reports/report.pdf"
}
```

### 5. Lịch sử kiểm định của xe

**GET** `/inspections/bike/:bikeId`

---

## 👨‍💼 Admin Endpoints

**Tất cả endpoints yêu cầu admin role**

### 1. Danh sách users

**GET** `/admin/users?role=seller&is_active=true`

### 2. Kích hoạt/Khóa user

**PUT** `/admin/users/:userId/status`

**Body:**
```json
{
  "is_active": false
}
```

### 3. Tin đăng chờ duyệt

**GET** `/admin/bikes/pending`

### 4. Duyệt tin đăng

**PUT** `/admin/bikes/:bikeId/approve`

**Body:**
```json
{
  "status": "active"
}
```

### 5. Thống kê hệ thống

**GET** `/admin/statistics`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_users": 150,
    "total_bikes": 320,
    "total_orders": 85,
    "pending_bikes": 12,
    "active_bikes": 245
  }
}
```

### 6. Quản lý categories

**GET** `/admin/categories`

**POST** `/admin/categories`
```json
{
  "name": "Xe đạp Fixed Gear",
  "slug": "fixed-gear",
  "description": "Xe đạp bánh răng cố định"
}
```

### 7. Quản lý brands

**GET** `/admin/brands`

**POST** `/admin/brands`

---

## 📊 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Server Error

## 🚨 Error Response Format

```json
{
  "success": false,
  "message": "Mô tả lỗi"
}
```
