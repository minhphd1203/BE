# 🔍 INSPECTOR API GUIDE

## Tổng quan

Inspector là vai trò chuyên trách kiểm định chất lượng xe đạp trong hệ thống BESWP. Inspector có quyền:

- ✅ Xem danh sách xe chờ kiểm định
- ✅ Kiểm tra và đánh giá kỹ thuật xe
- ✅ Gắn nhãn "Đã kiểm định" cho xe đạt chuẩn
- ❌ KHÔNG được: sửa giá, xóa xe, chỉnh sửa thông tin seller

---

## 🔐 Authentication

Tất cả API cần Header:

```
Authorization: Bearer <inspector_jwt_token>
```

**Chú ý**: Token phải có `role: "inspector"` trong payload.

---

## 📋 API Endpoints

### 1. 📊 Dashboard - Thống kê tổng quan

**Endpoint:**

```
GET /api/inspector/v1/dashboard
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pendingInspections": 15,
    "completedInspections": 42,
    "passedCount": 38,
    "failedCount": 4,
    "disputesCount": 2
  }
}
```

---

### 2. 🔍 Lấy danh sách xe chờ kiểm định

**Endpoint:**

```
GET /api/inspector/v1/bikes/pending
```

**Điều kiện xe hiển thị:**

- ✅ `status = 'approved'` (đã được Admin duyệt)
- ✅ `inspection_status IN ('pending', 'in_progress')`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "title": "Giant ATX 2023",
      "brand": "Giant",
      "model": "ATX",
      "year": 2023,
      "price": 8500000,
      "condition": "good",
      "images": ["url1", "url2"],
      "status": "approved",
      "isVerified": "not_verified",
      "inspectionStatus": "pending",
      "sellerId": "uuid-seller",
      "sellerName": "Nguyễn Văn A",
      "categoryName": "Xe đạp địa hình",
      "createdAt": "2026-02-10T..."
    }
  ],
  "message": "Found 15 bikes pending inspection"
}
```

---

### 3. 📄 Xem chi tiết một xe để kiểm định

**Endpoint:**

```
GET /api/inspector/v1/bikes/:bikeId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "bike": {
      "id": "uuid-123",
      "title": "Giant ATX 2023",
      "description": "Xe còn mới...",
      "brand": "Giant",
      "model": "ATX",
      "year": 2023,
      "price": 8500000,
      "condition": "good",
      "mileage": 500,
      "color": "Đen",
      "images": ["url1", "url2"],
      "status": "approved",
      "isVerified": "not_verified",
      "inspectionStatus": "pending",
      "sellerId": "uuid",
      "sellerName": "Nguyễn Văn A",
      "sellerPhone": "0901234567",
      "sellerEmail": "nguyen@example.com",
      "categoryName": "Xe đạp địa hình",
      "createdAt": "2026-02-10T..."
    },
    "inspectionHistory": [
      // Lịch sử kiểm định trước (nếu có)
    ]
  }
}
```

---

### 4. 🚀 Bắt đầu kiểm định

**Endpoint:**

```
POST /api/inspector/v1/bikes/:bikeId/start
```

**Chức năng:**

- Cập nhật `inspection_status` từ `'pending'` → `'in_progress'`
- Đánh dấu inspector đang kiểm tra xe này

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "inspectionStatus": "in_progress",
    ...
  },
  "message": "Inspection started successfully"
}
```

---

### 5. ✅ Submit Form Kiểm Định (Hoàn tất)

**Endpoint:**

```
POST /api/inspector/v1/bikes/:bikeId/inspect
```

**Request Body:**

```json
{
  "status": "passed", // Required: "passed" | "failed"
  "overallCondition": "good", // Required: "excellent" | "good" | "fair" | "poor"
  "frameCondition": "Khung xe tốt, không nứt vỡ",
  "brakeCondition": "Phanh mòn nhẹ (~70%)",
  "drivetrainCondition": "Xích đã mòn, nên thay",
  "wheelCondition": "Bánh xe tốt",
  "inspectionNote": "Xe còn khá tốt, cần bảo dưỡng nhẹ.",
  "recommendation": "Nên thay xích và tăng phanh",
  "inspectionImages": ["url_anh_kiem_dinh_1", "url_anh_kiem_dinh_2"],
  "reportFile": "url_bao_cao_pdf"
}
```

**Kết quả:**

- ✅ Tạo bản ghi trong bảng `inspections`
- ✅ Cập nhật bike:
  - `is_verified = 'verified'` (nếu passed)
  - `is_verified = 'failed'` (nếu failed)
  - `inspection_status = 'completed'`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "inspection-uuid",
    "bikeId": "bike-uuid",
    "inspectorId": "inspector-uuid",
    "status": "passed",
    "overallCondition": "good",
    ...
  },
  "message": "Inspection completed. Bike status: verified"
}
```

---

### 6. 📋 Lấy lịch sử kiểm định của mình

**Endpoint:**

```
GET /api/inspector/v1/inspections
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "inspection": { ... },
      "bikeTitle": "Giant ATX 2023",
      "bikeBrand": "Giant",
      "bikeModel": "ATX",
      "sellerName": "Nguyễn Văn A"
    },
    ...
  ]
}
```

---

### 7. 📊 Xem chi tiết một báo cáo kiểm định

**Endpoint:**

```
GET /api/inspector/v1/inspections/:inspectionId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "inspection": { ... },
    "bike": { ... },
    "inspector": {
      "id": "uuid",
      "name": "Inspector Nguyễn",
      "email": "inspector@beswp.com"
    }
  }
}
```

---

### 8. 🔄 Cập nhật báo cáo kiểm định

**Endpoint:**

```
PUT /api/inspector/v1/inspections/:inspectionId
```

**Request Body:** (Gửi những trường cần update)

```json
{
  "inspectionNote": "Cập nhật: đã kiểm tra lại phanh...",
  "recommendation": "Cập nhật khuyến nghị mới"
}
```

**Điều kiện:**

- ✅ Chỉ inspector tạo báo cáo mới được sửa

**Response:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Inspection updated successfully"
}
```

---

## 🗄️ Database Schema

### Bảng `inspections`

| Column               | Type      | Description                    |
| -------------------- | --------- | ------------------------------ |
| id                   | UUID      | Primary key                    |
| bike_id              | UUID      | Foreign key → bikes            |
| inspector_id         | UUID      | Foreign key → users            |
| status               | VARCHAR   | passed / failed                |
| overall_condition    | VARCHAR   | excellent / good / fair / poor |
| frame_condition      | VARCHAR   | Tình trạng khung xe            |
| brake_condition      | VARCHAR   | Tình trạng phanh               |
| drivetrain_condition | VARCHAR   | Tình trạng bộ truyền động      |
| wheel_condition      | VARCHAR   | Tình trạng bánh xe             |
| inspection_note      | TEXT      | Ghi chú chi tiết               |
| recommendation       | TEXT      | Khuyến nghị sửa chữa           |
| inspection_images    | TEXT[]    | Ảnh thực tế khi kiểm định      |
| report_file          | TEXT      | URL file báo cáo PDF           |
| created_at           | TIMESTAMP | Thời gian tạo                  |
| updated_at           | TIMESTAMP | Thời gian cập nhật             |

### Cập nhật bảng `bikes`

**Thêm 2 trường mới:**

- `is_verified` VARCHAR(20): `'not_verified'` | `'verified'` | `'failed'`
- `inspection_status` VARCHAR(50): `'pending'` | `'in_progress'` | `'completed'`

---

## 🔧 Workflow Kiểm Định

```
1. Admin duyệt tin đăng
   → bike.status = 'approved'
   → bike.inspection_status = 'pending'

2. Inspector thấy xe trong danh sách chờ kiểm định
   → GET /api/inspector/v1/bikes/pending

3. Inspector bắt đầu kiểm định
   → POST /api/inspector/v1/bikes/:id/start
   → bike.inspection_status = 'in_progress'

4. Inspector điền form và submit
   → POST /api/inspector/v1/bikes/:id/inspect
   → Tạo record trong bảng inspections
   → bike.is_verified = 'verified' / 'failed'
   → bike.inspection_status = 'completed'

5. Nếu xe đạt → Hiển thị badge "✅ ĐÃ KIỂM ĐỊNH" cho buyer
   Nếu xe không đạt → Gửi thông báo cho seller yêu cầu sửa chữa
```

---

## 👤 Tạo Inspector User

### Cách 1: Qua API Register

```bash
POST /api/auth/register
{
  "email": "inspector@beswp.com",
  "password": "secure_password",
  "name": "Kiểm định viên Nguyễn",
  "phone": "0901234567",
  "role": "inspector"  # Chỉ định role
}
```

### Cách 2: Admin cấp quyền

Trong màn hình Admin → Users → Sửa user → Đổi role thành `"inspector"`

```bash
PUT /api/admin/v1/user/:userId
{
  "role": "inspector"
}
```

---

## 🚀 Chạy Migration

Sau khi cập nhật schema, chạy lệnh:

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate

# Hoặc push trực tiếp (dev only)
npm run db:push
```

---

## 🧪 Test với Postman

1. **Login với Inspector account:**

```
POST /api/auth/login
{
  "email": "inspector@beswp.com",
  "password": "password"
}
```

2. **Copy token từ response**

3. **Test các endpoint:**

```
GET /api/inspector/v1/dashboard
Headers: Authorization: Bearer <token>
```

---

## 📌 Lưu ý quan trọng

### ⚠️ Inspector KHÔNG được:

- ❌ Sửa giá xe
- ❌ Xóa xe
- ❌ Thay đổi thông tin seller
- ❌ Duyệt/từ chối tin đăng (đó là việc của Admin)

### ✅ Inspector CHỈ được:

- ✅ Xem xe đã được Admin duyệt
- ✅ Kiểm định kỹ thuật
- ✅ Gắn nhãn verified/failed
- ✅ Viết báo cáo kiểm định

---

## 🎨 Frontend Suggestions

### Badge cho xe đã kiểm định:

```jsx
{
  bike.isVerified === "verified" && (
    <span className="badge-verified">✅ ĐÃ KIỂM ĐỊNH</span>
  );
}
```

### Màu sắc:

- 🟢 Verified: màu xanh lá
- 🔴 Failed: màu đỏ
- ⚪ Not Verified: màu xám

---

## 📞 Support

Nếu có vấn đề với Inspector API:

- 📧 Email: support@beswp.com
- 📱 Hotline: 1900-xxxx
- 📖 Docs: /docs/inspector-guide

---

**Happy Inspecting! 🚴‍♂️🔍**
