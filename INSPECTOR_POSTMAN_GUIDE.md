# 🔍 Inspector APIs - Postman Testing Guide

## 📋 Tổng Quan

File `BESWP_SEED_DATA.postman_collection.json` đã được cập nhật với **đầy đủ Inspector APIs** để test mọi tính năng kiểm định xe đạp.

---

## 🚀 Quick Start

### 1. Import Collection vào Postman

```
File > Import > Choose File > BESWP_SEED_DATA.postman_collection.json
```

### 2. Setup Initial Data

Chạy các request theo thứ tự trong folder **🔧 Setup & Login**:

```
1. Register Admin → Tạo admin account
2. Login Admin → Lấy admin token
3. Create Test User → Tạo user account
4. Login Test User → Lấy user token
5. Create Test Inspector → Tạo inspector account
6. Login Test Inspector → Lấy inspector token
```

> ✅ Sau khi chạy xong, các token sẽ tự động lưu vào Collection Variables

### 3. Generate Test Data

Chạy các request trong folders:
- **🎲 Generate Categories** → Tạo categories
- **🎲 Generate Bikes** → Tạo bikes (cần có category trước)

### 4. Approve Bikes (Admin)

Trước khi inspector có thể kiểm định, admin cần approve bikes:

```
Sử dụng API Admin để approve bikes
hoặc update trực tiếp trong database:

UPDATE bikes 
SET status = 'approved', inspection_status = 'pending' 
WHERE status = 'pending';
```

---

## 🔍 Inspector APIs Flow

### Folder: **🔍 Inspector APIs**

#### 1️⃣ **Login Inspector**
```
POST /api/auth/login
```
- Login để lấy token
- Token tự động lưu vào `{{inspectorToken}}`

#### 2️⃣ **Get Dashboard**
```
GET /api/inspector/v1/dashboard
```
- Xem thống kê tổng quan
- Hiển thị: Đang chờ, Đã kiểm, Đạt, Không đạt

#### 3️⃣ **Get Pending Bikes**
```
GET /api/inspector/v1/bikes/pending
```
- Lấy danh sách xe chờ kiểm định
- Auto save `{{pendingBikeId}}` của xe đầu tiên

**Query Parameters** (optional):
- `search`: Tìm theo title, brand, model, seller
- `sort`: `newest`, `oldest`, `price_asc`, `price_desc`

**Example:**
```
GET /api/inspector/v1/bikes/pending?search=Giant&sort=price_desc
```

#### 4️⃣ **Get Bike Detail**
```
GET /api/inspector/v1/bikes/{{pendingBikeId}}
```
- Xem chi tiết xe trước khi kiểm định
- Hiển thị thông tin đầy đủ + lịch sử kiểm định

#### 5️⃣ **Start Inspection**
```
POST /api/inspector/v1/bikes/{{pendingBikeId}}/start
```
- Bắt đầu kiểm định
- Chuyển status từ `pending` → `in_progress`

#### 6️⃣ **Submit Inspection**

**Option A: PASSED (Đạt)**
```
POST /api/inspector/v1/bikes/{{pendingBikeId}}/inspect

Body:
{
  "status": "passed",
  "overallCondition": "good",
  "frameCondition": "excellent",
  "brakeCondition": "good",
  "drivetrainCondition": "fair",
  "wheelCondition": "good",
  "inspectionNote": "Xe trong tình trạng tốt..."
}
```

**Option B: FAILED (Không đạt)**
```
POST /api/inspector/v1/bikes/{{pendingBikeId}}/inspect

Body:
{
  "status": "failed",
  "overallCondition": "poor",
  "frameCondition": "fair",
  "brakeCondition": "poor",
  "drivetrainCondition": "poor",
  "wheelCondition": "fair",
  "inspectionNote": "Xe có nhiều vấn đề...",
  "recommendation": "Cần thay thế phanh..."
}
```

- Auto save `{{lastInspectionId}}`
- Bike status → `verified` hoặc `failed`
- Inspection status → `completed`

#### 7️⃣ **Get My Inspections**
```
GET /api/inspector/v1/inspections
```
- Xem lịch sử kiểm định của mình
- Danh sách tất cả xe đã kiểm

**Query Parameters** (optional):
- `search`: Tìm theo title, brand, seller
- `status`: `passed` | `failed`
- `sort`: `newest`, `oldest`, `price_asc`, `price_desc`

**Example:**
```
GET /api/inspector/v1/inspections?status=passed&sort=newest
```

#### 8️⃣ **Get Inspection Detail**
```
GET /api/inspector/v1/inspections/{{lastInspectionId}}
```
- Xem chi tiết báo cáo kiểm định
- Hiển thị tất cả thông tin inspection

#### 9️⃣ **Update Inspection**
```
PUT /api/inspector/v1/inspections/{{lastInspectionId}}

Body:
{
  "inspectionNote": "Updated: Đã kiểm tra lại...",
  "recommendation": "Nên bảo dưỡng định kỳ..."
}
```
- Cập nhật báo cáo nếu cần sửa

---

## 📦 Collection Variables

Các biến được tự động lưu sau mỗi request:

| Variable | Description | Auto Set By |
|----------|-------------|-------------|
| `adminToken` | Admin JWT token | Login Admin |
| `userToken` | User JWT token | Login User |
| `inspectorToken` | Inspector JWT token | Login Inspector |
| `inspectorId` | Inspector user ID | Login Inspector |
| `pendingBikeId` | ID xe đang test | Get Pending Bikes |
| `lastInspectionId` | ID inspection vừa tạo | Submit Inspection |
| `lastCategoryId` | ID category vừa tạo | Create Category |

> 💡 **Tip**: Check **Console** tab trong Postman để xem logs chi tiết sau mỗi request

---

## 🎯 Testing Scenarios

### Scenario 1: Inspector Flow Hoàn Chỉnh

```
1. Run: 1. Login Inspector
2. Run: 2. Get Dashboard (xem stats)
3. Run: 3. Get Pending Bikes (lấy bike ID)
4. Run: 4. Get Bike Detail (xem chi tiết)
5. Run: 5. Start Inspection (bắt đầu)
6. Run: 6. Submit Inspection - PASSED (hoàn tất)
7. Run: 7. Get My Inspections (xem lịch sử)
8. Run: 8. Get Inspection Detail (xem chi tiết báo cáo)
```

### Scenario 2: Test Search & Filter

```
1. Generate nhiều bikes (chạy Create Random Bike nhiều lần)
2. Admin approve các bikes
3. Login Inspector
4. Test search:
   - GET /bikes/pending?search=Giant
   - GET /bikes/pending?search=Trek
5. Test sorting:
   - GET /bikes/pending?sort=price_desc
   - GET /bikes/pending?sort=oldest
6. Test filter inspections:
   - GET /inspections?status=passed
   - GET /inspections?status=failed
```

### Scenario 3: Test Update Inspection

```
1. Run full inspection flow
2. Run: 9. Update Inspection (sửa note/recommendation)
3. Run: 8. Get Inspection Detail (verify changes)
```

---

## 🔄 Workflow Chart

```
┌─────────────────────────────────────────────────────┐
│                  SETUP (Once)                        │
├─────────────────────────────────────────────────────┤
│ 1. Register accounts (Admin, User, Inspector)       │
│ 2. Login to get tokens                              │
│ 3. Generate categories & bikes                      │
│ 4. Admin approve bikes                              │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              INSPECTOR WORKFLOW                      │
├─────────────────────────────────────────────────────┤
│ 1. Login Inspector                                  │
│ 2. View Dashboard → Get statistics                  │
│ 3. Get Pending Bikes → Select a bike               │
│ 4. Get Bike Detail → Review info                   │
│ 5. Start Inspection → Change status                │
│ 6. Submit Inspection → PASSED or FAILED            │
│ 7. View History → See all inspections              │
│ 8. View Detail → Check specific report             │
│ 9. Update (optional) → Edit if needed              │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Troubleshooting

### ❌ "No bikes pending inspection"

**Solution:**
1. Generate bikes: Run **Create Random Bike** (nhiều lần)
2. Admin approve: Update bikes status to `approved`
3. Try again: Run **Get Pending Bikes**

### ❌ "Unauthorized" or "403 Forbidden"

**Solution:**
1. Check token: Run **Login Inspector** again
2. Verify role: Ensure user has `role: "inspector"`
3. Check expiry: Token may be expired

### ❌ "Bike not found" or Invalid bikeId

**Solution:**
1. Run **Get Pending Bikes** first
2. Variable `{{pendingBikeId}}` will auto-set
3. Then run other bike endpoints

### ❌ "Inspection already completed"

**Solution:**
- Bike đã được kiểm định rồi
- Generate bike mới hoặc chọn bike khác từ pending list

---

## 📝 Tips & Best Practices

### 1. Check Console Logs
Mỗi request có script tự động log kết quả:
```javascript
console.log('✅ Found 5 bikes pending inspection');
console.log('   First bike: Giant Pro 500');
```

### 2. Use Query Parameters
Enable/disable params trong Postman:
- Checkbox ☑️ = enabled
- Checkbox ☐ = disabled

### 3. Run Collection
Chạy toàn bộ collection một lúc:
```
Right click on collection > Run collection
Select requests > Run
```

### 4. Environment Variables
Nếu có nhiều environments (dev, staging, prod):
```
Create Environment:
- baseUrl: http://localhost:3000
- Update all URLs: {{baseUrl}}/api/...
```

---

## 📚 Related Documentation

- **Full API Docs**: `INSPECTOR_API_GUIDE.md`
- **Implementation Guide**: `INSPECTOR_IMPLEMENTATION_GUIDE.md`
- **General Postman Guide**: `POSTMAN_GUIDE.md`

---

## ✅ Checklist

- [ ] Import collection vào Postman
- [ ] Chạy Setup & Login (4 requests)
- [ ] Generate categories & bikes
- [ ] Admin approve bikes
- [ ] Test Inspector login
- [ ] Test Dashboard API
- [ ] Test Pending Bikes list
- [ ] Test complete inspection flow
- [ ] Test search & filters
- [ ] Test inspection history
- [ ] Test update inspection

---

**Happy Testing!** 🚀🔍

Nếu có vấn đề, check Console logs hoặc Response body để debug.
