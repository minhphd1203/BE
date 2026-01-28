# API Documentation - Admin Panel

Base URL: `http://localhost:5000/api/admin`

**Tất cả endpoints yêu cầu:**
- Header: `Authorization: Bearer <admin_token>`
- Role: `admin`

---

## 🎯 DASHBOARD APIs

### 1. Lấy thống kê tổng quan
```http
GET /api/admin/statistics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_users": 12450,
    "new_listings": 320,
    "pending_reviews": 85,
    "reports": 18
  }
}
```

### 2. Lấy danh sách listing gần đây
```http
GET /api/admin/recent-listings?limit=10
```

**Query Parameters:**
- `limit` (optional): Số lượng listing (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123-456",
      "title": "Toyota Alp Hlân",
      "status": "pending",
      "user_name": "Actier",
      "created_at": "2022-04-18T00:00:00.000Z"
    }
  ]
}
```

---

## 📋 MANAGE LISTINGS APIs

### 3. Lấy tất cả listings với filter
```http
GET /api/admin/listings?status=all&page=1&limit=20
```

**Query Parameters:**
- `status` (optional): `all`, `pending`, `active`, `approved`, `rejected`, `sold`, `hidden`
- `category` (optional): ID của category
- `user` (optional): Tên user để tìm kiếm
- `page` (optional): Trang hiện tại (default: 1)
- `limit` (optional): Số item/trang (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123-456",
      "title": "Nguyễn Alp Hlân",
      "category": "Premium",
      "user_name": "Minh Lê",
      "status": "approved",
      "created_at": "2022-04-18T00:00:00.000Z",
      "price": 15000000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 4. Lấy chi tiết listing để review
```http
GET /api/admin/listings/:bikeId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "bike-uuid",
    "title": "Honda SH 150i 2020",
    "price": 75000000,
    "description": "Điệp tính tiều phúc...",
    "condition": "good",
    "year": 2020,
    "status": "pending_review",
    "seller_name": "Nguyễn Văn A",
    "seller_email": "user@example.com",
    "seller_phone": "0909 123 456",
    "category_name": "Scooter",
    "brand_name": "Honda",
    "images": [
      {
        "id": 1,
        "image_url": "/uploads/bikes/image1.jpg",
        "display_order": 1
      }
    ],
    "specs": {
      "engine_size": "150cc",
      "mileage": 12000,
      "color": "White"
    }
  }
}
```

### 5. Approve/Reject listing
```http
POST /api/admin/listings/:bikeId/review
```

**Request Body:**
```json
{
  "action": "approve",  // or "reject"
  "reason": "Xe hư hỏng nhiều quá."  // required khi reject
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã phê duyệt listing"
}
```

---

## 👥 MANAGE INSPECTORS APIs

### 6. Lấy danh sách inspectors
```http
GET /api/admin/inspectors
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "inspector-uuid",
      "full_name": "Thuận Võ",
      "email": "inspector@example.com",
      "phone": "0909123456",
      "avatar_url": "/uploads/avatars/avatar.jpg",
      "is_active": true,
      "total_reviews": 992,
      "completed_reviews": 794,
      "approval_rate": 80,
      "created_at": "2022-01-01T00:00:00.000Z"
    }
  ]
}
```

### 7. Tạo inspector mới
```http
POST /api/admin/inspectors
```

**Request Body:**
```json
{
  "email": "new.inspector@example.com",
  "full_name": "Nguyễn Văn B",
  "phone": "0909999888",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tạo inspector thành công",
  "data": {
    "id": "new-inspector-uuid",
    "email": "new.inspector@example.com",
    "full_name": "Nguyễn Văn B",
    "role": "inspector"
  }
}
```

### 8. Toggle inspector status (Active/Offline)
```http
PUT /api/admin/inspectors/:inspectorId/status
```

**Request Body:**
```json
{
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã vô hiệu hóa inspector"
}
```

---

## 📊 USER MANAGEMENT APIs

### 9. Lấy tất cả users
```http
GET /api/admin/users?role=buyer&is_active=true
```

**Query Parameters:**
- `role` (optional): `buyer`, `seller`, `inspector`, `admin`
- `is_active` (optional): `true`, `false`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "full_name": "Nguyễn Văn A",
      "role": "buyer",
      "is_active": true,
      "reputation_score": 4.5,
      "created_at": "2022-01-01T00:00:00.000Z"
    }
  ]
}
```

### 10. Toggle user status
```http
PUT /api/admin/users/:userId/status
```

**Request Body:**
```json
{
  "is_active": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vô hiệu hóa user thành công!"
}
```

---

## 🚨 REPORTS MANAGEMENT APIs

### 11. Lấy danh sách reports
```http
GET /api/admin/reports?status=pending&page=1&limit=20
```

**Query Parameters:**
- `status` (optional): `pending`, `resolved`, `dismissed` (default: `pending`)
- `page` (optional): Trang hiện tại (default: 1)
- `limit` (optional): Số item/trang (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "reporter_name": "Nguyễn Văn A",
      "bike_title": "Honda SH 150i",
      "reason": "Thông tin sai lệch",
      "description": "Xe bị tai nạn nhưng không khai báo",
      "status": "pending",
      "created_at": "2022-04-18T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 18,
    "totalPages": 1
  }
}
```

### 12. Xử lý report
```http
POST /api/admin/reports/:reportId/handle
```

**Request Body:**
```json
{
  "action": "resolve",  // or "dismiss"
  "note": "Đã xác minh và xử lý"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã xử lý report"
}
```

---

## 🏷️ CATEGORIES & BRANDS APIs

### 13. Lấy danh sách categories
```http
GET /api/admin/categories
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Xe đạp đường trường",
      "slug": "road-bike",
      "description": "Xe đạp chuyên dụng cho đường trường"
    }
  ]
}
```

### 14. Tạo category mới
```http
POST /api/admin/categories
```

**Request Body:**
```json
{
  "name": "Xe đạp leo núi",
  "slug": "mountain-bike",
  "description": "Xe đạp địa hình"
}
```

### 15. Lấy danh sách brands
```http
GET /api/admin/brands
```

### 16. Tạo brand mới
```http
POST /api/admin/brands
```

**Request Body:**
```json
{
  "name": "Giant",
  "slug": "giant",
  "logo_url": "/uploads/brands/giant.png"
}
```

---

## 📝 NOTES

**Status Values:**
- Bike Status: `active`, `sold`, `hidden`, `pending_review`
- Order Status: `pending`, `deposit_paid`, `completed`, `cancelled`
- Inspection Status: `pending`, `in_progress`, `completed`, `rejected`

**Authentication:**
Tất cả requests phải có header `Authorization: Bearer <token>` với token của user có role `admin`.

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error message here"
}
```
