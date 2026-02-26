# 🎲 HƯỚNG DẪN TẠO DỮ LIỆU NGẪU NHIÊN QUA POSTMAN

## 📥 Bước 1: Import Collection

1. Mở Postman
2. Click **Import**
3. Chọn file: `BESWP_SEED_DATA.postman_collection.json`
4. Collection sẽ xuất hiện với tên: **"BESWP - Seed Random Data"**

---

## 🔧 Bước 2: Setup Admin & User (Chạy 1 lần đầu tiên)

### Chạy lần lượt các request trong folder **"Setup & Login"**:

1. **1. Register Admin**
   - Tạo admin account: `admin@beswp.com / Admin@123`

2. **2. Login Admin**
   - Token tự động lưu vào biến `{{adminToken}}`

3. **3. Create Test User**
   - Tạo test user: `testuser@beswp.com / Test@123`

4. **4. Login Test User**
   - Token tự động lưu vào biến `{{userToken}}`

✅ **Sau bước này bạn đã có:**

- Admin token
- User token
- Sẵn sàng tạo data!

---

## 🎲 Bước 3: Tạo Dữ Liệu Ngẫu Nhiên

### A. Tạo Users Ngẫu Nhiên

📁 Folder: **"🎲 Generate Users"**

#### **Create Random User**

- Mỗi lần chạy → tạo 1 user mới với:
  - ✅ Tên tiếng Việt ngẫu nhiên
  - ✅ Email auto-generate
  - ✅ SĐT ngẫu nhiên
  - ✅ Password mặc định: `Test@123`

**Muốn tạo 20 users?**
→ Click **Send** 20 lần! (hoặc dùng Collection Runner)

---

#### **Create Random Inspector**

- Tạo Inspector với email dạng: `inspector{timestamp}@beswp.com`
- Password: `Test@123`

---

### B. Tạo Categories Ngẫu Nhiên

📁 Folder: **"🎲 Generate Categories"**

#### **Create Random Category**

- Mỗi lần chạy → tạo 1 category
- Tự động lưu `categoryId` vào biến để dùng tạo bike

**⚠️ Lưu ý:** Cần Admin token!

**Muốn tạo 10 categories?**
→ Click **Send** 10 lần!

---

### C. Tạo Bikes Ngẫu Nhiên

📁 Folder: **"🎲 Generate Bikes"**

#### **Create Random Bike (User)**

- Mỗi lần chạy → tạo 1 bike với:
  - ✅ Brand ngẫu nhiên (Giant, Trek, Specialized...)
  - ✅ Model tự generate
  - ✅ Giá 5-100 triệu
  - ✅ Năm 2018-2024
  - ✅ Màu sắc random
  - ✅ Mileage phù hợp với condition
  - ✅ Ảnh từ picsum.photos (random mỗi lần)
  - ✅ Mô tả chi tiết tự động

**⚠️ Lưu ý:**

- Cần User token!
- Cần có category (chạy Create Category trước)

**Muốn tạo 50 bikes?**
→ Click **Send** 50 lần!

---

## 🚀 Bước 4: Tạo Hàng Loạt với Collection Runner

### Cách chạy nhiều requests cùng lúc:

1. Click **Collection** → **BESWP - Seed Random Data**
2. Click nút **Run** (▶️)
3. Chọn requests muốn chạy:
   - ✅ Create Random User
   - ✅ Create Random Category
   - ✅ Create Random Bike
4. Set **Iterations**: 50 (sẽ chạy 50 lần)
5. Click **Run BESWP - Seed Random Data**

**Kết quả:**

- 50 users mới
- 50 categories mới
- 50 bikes mới

Tất cả đều random! 🎉

---

## 📊 Kiểm Tra Dữ Liệu

### Sau khi seed, kiểm tra bằng:

```bash
npm run start scripts/check-database.ts
```

Hoặc:

```bash
npm run db:studio
```

---

## 💡 Tips & Tricks

### 1. Tạo Bulk Data Nhanh

**Collection Runner Settings:**

- Iterations: 100
- Delay: 50ms (tránh spam server)

→ Tạo 100 records trong vài giây!

---

### 2. Customize Random Logic

Muốn thay đổi cách generate?

→ Sửa **Pre-request Script** trong từng request:

```javascript
// Ví dụ: Thêm brand mới
const brands = ["Giant", "Trek", "YourBrand"];

// Ví dụ: Đổi range giá
const price = randomInt(10, 50) * 1000000; // 10-50tr
```

---

### 3. Variables Có Sẵn

Collection này sử dụng các biến:

| Variable             | Mô tả                 |
| -------------------- | --------------------- |
| `{{adminToken}}`     | JWT token của Admin   |
| `{{userToken}}`      | JWT token của User    |
| `{{lastCategoryId}}` | Category ID vừa tạo   |
| `{{randomName}}`     | Tên ngẫu nhiên        |
| `{{randomEmail}}`    | Email ngẫu nhiên      |
| `{{bikeTitle}}`      | Tiêu đề xe ngẫu nhiên |

---

## 🎯 Workflow Hoàn Chỉnh

```
1. Import Collection
   ↓
2. Register & Login Admin → Lưu adminToken
   ↓
3. Register & Login User → Lưu userToken
   ↓
4. Chạy "Create Random Category" nhiều lần → Lưu categoryId
   ↓
5. Chạy "Create Random User" nhiều lần → Tạo sellers
   ↓
6. Chạy "Create Random Bike" nhiều lần → Tạo bikes
   ↓
7. Kiểm tra database
```

---

## ⚙️ Cấu Hình Mặc Định

| Thuộc tính       | Giá trị              |
| ---------------- | -------------------- |
| Password         | `Test@123`           |
| Bike price range | 5tr - 100tr          |
| Year range       | 2018 - 2024          |
| Images           | Picsum.photos random |

---

## 🔧 Troubleshooting

### ❌ Lỗi: "No token provided"

→ Chạy lại **Login Admin** hoặc **Login Test User**

### ❌ Lỗi: "categoryId is required"

→ Chạy **Create Random Category** trước

### ❌ Lỗi: "Email already exists"

→ Bình thường! Chỉ cần chạy lại, email sẽ tự động đổi

### ❌ Server trả về 500

→ Kiểm tra database connection, chạy migrations

---

## 📈 Ví Dụ Sử Dụng Thực Tế

### Demo Project:

1. Tạo 1 Admin
2. Tạo 5 Inspectors
3. Tạo 10 Categories
4. Tạo 20 Users (sellers)
5. Tạo 100 Bikes

**Collection Runner:**

- Iteration: 100
- Delay: 100ms
- Time: ~15 giây

---

## 🎉 Kết Luận

✅ **Không cần code**  
✅ **Không cần script**  
✅ **Chỉ cần Postman**  
✅ **Data hoàn toàn random**  
✅ **Dễ customize**

**Tạo hàng trăm records trong vài phút! 🚀**

---

Có thắc mắc? Xem thêm tại [POSTMAN_GUIDE.md](POSTMAN_GUIDE.md)
