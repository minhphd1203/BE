# Nhật ký thay đổi - Hệ thống Thanh toán & Hóa đơn

**Nhánh:** `feature/payout`  
**Commit:** `6d7e951`  
**Ngày:** April 7, 2026

---

## 📋 Tóm tắt thay đổi

Phiên bản này triển khai hệ thống thanh toán bán hàng hoàn chỉnh với tích hợp giao hàng, cập nhật hồ sơ người dùng toàn diện, và cải thiện xác thực dữ liệu.

---

## ✨ Tính năng mới

### 1. **Hệ thống thanh toán bán hàng** 🏦
- Thêm 4 trường thông tin ngân hàng vào bảng `users`:
  - `bank_account_number` - Số tài khoản ngân hàng
  - `bank_account_holder` - Tên chủ tài khoản
  - `bank_code` - Mã ngân hàng (VCB, ACB, MB, v.v.)
  - `bank_branch` - Chi nhánh ngân hàng
- Tạo bảng `payouts` để theo dõi yêu cầu thanh toán
- API endpoint: `PUT /api/profile/v1/update` - Cập nhật thông tin ngân hàng

### 2. **Tách bảng Giao hàng** 📦
- Tạo bảng `deliveries` riêng biệt (trước đây bị nhúng trong `transactions`)
- Trường trong bảng `deliveries`:
  - `id` - ID duy nhất
  - `deliveryStatus` - Trạng thái (preparing → delivering → delivered)
  - `deliveryNotes` - Ghi chú giao hàng
  - `receiptConfirmedAt` - Thời gian xác nhận nhận hàng
  - `createdAt`, `updatedAt` - Timestamps
- Thiết lập khóa ngoại từ `transactions` → `deliveries`

### 3. **Cập nhật hồ sơ người dùng** 👤
- Endpoint mới: `PUT /api/profile/v1/update`
- Cho phép cập nhật:
  - Tên (`name`)
  - Số điện thoại (`phone`)
  - Ảnh đại diện (`avatar`)
  - Thông tin ngân hàng (4 trường)
- Xác thực toàn bộ dữ liệu bằng Zod schema
- Yêu cầu: Nếu cung cấp bất kỳ trường ngân hàng nào, tất cả các trường bắt buộc phải có

### 4. **Xác thực Số điện thoại Việt Nam** 📞
- Mẫu xác thực: `^0\d{9}$`
- Bắt buộc: Bắt đầu bằng `0`, theo sau bởi 9 chữ số
- Ví dụ hợp lệ: `0901234567`, `0912345678`
- Được sử dụng trong `profileValidator` và `transactionValidator`

### 5. **Kết nối dữ liệu Giao hàng với Giao dịch** 🔗
- Tất cả các endpoint giao dịch bây giờ bao gồm chi tiết giao hàng:
  - `GET /api/admin/v1/transaction` - Admin danh sách giao dịch
  - `GET /api/seller/v1/my-transactions` - Giao dịch bán hàng
  - `GET /api/seller/v1/my-transactions/:id` - Chi tiết giao dịch bán hàng
  - `GET /api/buyer/v1/my-transactions` - Giao dịch mua hàng
  - `GET /api/buyer/v1/transaction/:id` - Chi tiết giao dịch mua hàng

---

## 🔧 Cải thiện kỹ thuật

### Hợp nhất Bộ xác thực
Tạo kiến trúc xác thực tập trung:
- **`commonValidators.ts`** - Bộ xác thực tái sử dụng:
  - Số điện thoại Việt Nam
  - Email, URL, số tài khoản ngân hàng
  - Hỗ trợ ký tự Việt Nam
  
- **`profileValidator.ts`** - Zod schema cho cập nhật hồ sơ
  - Xác thực từng trường riêng lẻ
  - Xác thực kết hợp cho trường ngân hàng (all-or-nothing)
  
- **`transactionValidator.ts`** - Cập nhật sử dụng bộ xác thực chung

### Cập nhật Controller
Tất cả 7 controller được cập nhật:
1. **`adminController.ts`** - Thêm kết nối giao hàng cho `getAllTransaction`
2. **`sellerController.ts`** - Thêm kết nối giao hàng cho giao dịch bán hàng
3. **`buyerController.ts`** - Thêm kết nối giao hàng cho giao dịch mua hàng
4. **`profileController.ts`** - Thêm trường ngân hàng vào response, endpoint cập nhật mới
5. **`authController.ts`** - Đã sửa lỗi cache schema Drizzle
6. **`paymentController.ts`** - Cập nhật để phù hợp với schema
7. **`fulfillmentController.ts`** - Sửa lỗi truy cập mảng

### Dự phòng Bộ sưu tập hỗ trợ
- 9 tệp script hỗ trợ để xác minh, làm sạch và backfill dữ liệu
- Tài liệu hướng dẫn thiết lập hỗn hợp cho nhóm

---

## 🗑️ Dọn dẹp Database & Migration

### Xóa Migration Trùng lặp
Đã xóa 6 tệp migration trùng lặp:
- ❌ `0004_add_reserved_status.sql` (giữ: `0004_awesome_hellcat.sql`)
- ❌ `0004_add_transaction_types.sql` (giữ: `0004_awesome_hellcat.sql`)
- ❌ `0015_add_buyer_contact_to_transactions.sql` (giữ: `0015_transaction_fulfillment.sql`)
- ❌ `0016_spotty_jackpot.sql` (giữ: `0016_split_delivery_table.sql`)
- ❌ `0017_add_seller_payout.sql` (giữ: `0017_thankful_pixie.sql`)
- ❌ `0021_add_bank_columns_to_users.sql` (dư thừa)

### Chuỗi Migration Thắt chặt
**Bây giờ: 21 migration sạch (0000-0020)**

| Migration | Mục đích | Trạng thái |
|-----------|---------|-----------|
| 0000-0003 | Thiết lập schema ban đầu | ✅ |
| 0004 | Hợp nhất schema (vendors, categories, roles) | ✅ |
| 0005-0008 | Tính năng nhắn tin | ✅ |
| 0009-0013 | Thread nhắn tin & theo dõi | ✅ |
| 0014 | Trường địa chỉ giao dịch | ✅ |
| 0015 | Tích hợp thực hiện giao dịch | ✅ |
| 0016 | **Tách bảng Giao hàng** (MỚI) | ✅ |
| 0017 | **Thanh toán bán hàng + Trường ngân hàng** | ✅ |
| 0018-0020 | Làm sạch schema & thiết lập FK | ✅ |

---

## 📊 Thống kê Thay đổi

```
42 tệp thay đổi, 5619 bổ sung(+), 206 xóa(-)

Tài liệu:
  + MIGRATION_SETUP_GUIDE.md
  + drizzle/MIGRATION_CONSOLIDATION.md

Migrations:
  - 6 tệp xóa (trùng lặp)
  + 5 tệp mới (0016-0020)

Controllers:
  ~ 7 tệp sửa

Validators:
  + commonValidators.ts (MỚI)
  + profileValidator.ts (MỚI)
  ~ transactionValidator.ts

Services:
  + payoutProvider.ts (MỚI)
  ~ fulfillmentSync.ts

Routes:
  ~ profileRoutes.ts
  ~ paymentRoutes.ts

Scripts:
  + 8 tệp hỗ trợ cho kiểm tra/dọn dẹp
```

---

## 🚀 Hướng dẫn Triển khai

### Cho Đội ngũ - Thiết lập Ban đầu
```bash
# Kéo mã mới
git pull origin feature/payout

# Cài đặt migration
npm run db:push

# Xác minh (không nên có migration mới)
npm run db:migrate

# Khởi động máy chủ
npm run dev
```

### Kiểm tra Tính năng
```bash
# 1. Cập nhật hồ sơ người dùng với thông tin ngân hàng
curl -X PUT http://localhost:3000/api/profile/v1/update \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "bankAccountNumber": "1234567890",
    "bankAccountHolder": "Nguyễn Văn A",
    "bankCode": "VCB",
    "bankBranch": "TP. HCM"
  }'

# 2. Lấy hồ sơ (bây giờ có trường ngân hàng)
curl http://localhost:3000/api/profile/v1/info

# 3. Lấy giao dịch (bây giờ có chi tiết giao hàng)
curl http://localhost:3000/api/buyer/v1/my-transactions
```

---

## ⚠️ Lưu ý Quan trọng

### Xác thực Số điện thoại
- **Mẫu bắt buộc:** `0` + 9 chữ số
- ✅ Hợp lệ: `0901234567`, `0987654321`
- ❌ Không hợp lệ: `901234567`, `0901234`, `09012345678`

### Trường Ngân hàng
- Nếu cung cấp **bất kỳ** trường ngân hàng nào, **tất cả** trường bắt buộc phải có
- Hoặc không cung cấp bất kỳ trường nào

### Cache Drizzle
- Đã sửa cách compile để loại bỏ các trường cũ khỏi bộ nhớ cache
- Tất cả controller đã được kiểm tra lại

### Migration Push
- `npm run db:push` sẽ áp dụng 21 migration
- Không nên có xung đột

---

## 📚 Tài liệu Tham khảo

- **Setup Guide:** `MIGRATION_SETUP_GUIDE.md`
- **Migration Details:** `drizzle/MIGRATION_CONSOLIDATION.md`
- **Profile API:** `src/controllers/profileController.ts`
- **Validators:** `src/validators/`
- **Payout Service:** `src/services/payoutProvider.ts`

---

## ✅ Danh sách Kiểm tra Xác minh

- [x] 21 migration sạch (0000-0020)
- [x] Không có migration trùng lặp
- [x] Số điện thoại Việt Nam xác thực (0 + 9 chữ số)
- [x] Endpoint cập nhật hồ sơ hoạt động
- [x] Giao dịch bao gồm chi tiết giao hàng
- [x] Trường ngân hàng trong response
- [x] Server build thành công
- [x] npm run db:push thực hiện 0 lỗi

---

**Phát hành bởi:** GitHub Copilot  
**Trạng thái:** ✅ Sẵn sàng để Merge
