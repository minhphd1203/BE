# 💳 Hướng Dẫn Cấu Hình & Sử Dụng VNPay Payment

---

## 📋 Mục Lục
1. [Đăng ký tài khoản Sandbox VNPay](#1-đăng-ký-tài-khoản-sandbox-vnpay)
2. [Lấy thông tin cấu hình](#2-lấy-thông-tin-cấu-hình)
3. [Cấu hình file .env](#3-cấu-hình-file-env)
4. [Cấu hình IPN URL (bắt buộc khi test)](#4-cấu-hình-ipn-url)
5. [Luồng thanh toán đầy đủ](#5-luồng-thanh-toán-đầy-đủ)
6. [Test với thẻ Sandbox](#6-test-với-thẻ-sandbox)
7. [Kiểm tra kết quả](#7-kiểm-tra-kết-quả)
8. [Lỗi thường gặp](#8-lỗi-thường-gặp)

---

## 1. Đăng Ký Tài Khoản Sandbox VNPay

1. Truy cập: **https://sandbox.vnpayment.vn/devreg/**
2. Điền thông tin đăng ký
3. Sau khi đăng ký → vào: **https://sandbox.vnpayment.vn/merchantv2/**
4. Đăng nhập bằng tài khoản vừa tạo

---

## 2. Lấy Thông Tin Cấu Hình

Sau khi đăng nhập vào Merchant Portal:

1. Vào menu **Quản lý** → **Website/App**
2. Tìm website của bạn (hoặc tạo mới)
3. Lấy 2 thông tin:

| Thông tin | Ở đâu | Dùng cho |
|-----------|-------|----------|
| **Terminal ID (TmnCode)** | Cột "Website ID" | `VNP_TMNCODE` |
| **Secret Key** | Click vào website → "Chỉnh sửa" | `VNP_SECRET` |

---

## 3. Cấu Hình File .env

Mở file `.env` trong thư mục `BE/`, thêm các dòng sau:

```env
# ============= VNPAY CONFIGURATION =============

# Terminal ID lấy từ VNPay Merchant Portal
VNP_TMNCODE=XXXXXXXX

# Secret Key lấy từ VNPay Merchant Portal  
VNP_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# URL VNPay redirect buyer về sau khi thanh toán
# Nếu test local với ngrok:
VNP_RETURN_URL=https://xxxx.ngrok-free.app/api/payment/v1/vnpay-return

# App URL (để Swagger hiển thị đúng server)
APP_URL=https://xxxx.ngrok-free.app
```

> ⚠️ **Quan trọng:** VNPay **không hỗ trợ localhost** — phải dùng URL public (ngrok)

---

## 4. Cấu Hình IPN URL

IPN (Instant Payment Notification) là URL VNPay gọi để thông báo kết quả thanh toán.

### Bước 1: Chạy ngrok
```powershell
ngrok http 3000
```
Lấy URL dạng: `https://xxxx.ngrok-free.app`

### Bước 2: Cập nhật .env
```env
VNP_RETURN_URL=https://xxxx.ngrok-free.app/api/payment/v1/vnpay-return
APP_URL=https://xxxx.ngrok-free.app
```

### Bước 3: Cấu hình trong Merchant Portal
1. Vào **https://sandbox.vnpayment.vn/merchantv2/**
2. Menu **Quản lý** → **Website/App** → chọn website
3. Click **Chỉnh sửa**
4. Tìm ô **"URL IPN"** → điền:
   ```
   https://xxxx.ngrok-free.app/api/payment/v1/vnpay-ipn
   ```
5. Click **Lưu**

### Bước 4: Restart server
```powershell
# Ctrl+C để tắt server cũ, sau đó:
npm run dev
```

---

## 5. Luồng Thanh Toán Đầy Đủ

```
Buyer                    Backend                   VNPay
  │                         │                         │
  │── POST /buyer/v1/       │                         │
  │   transactions ────────>│ Tạo transaction         │
  │<── { transactionId } ───│ (status=pending)        │
  │                         │                         │
  │── POST /payment/v1/     │                         │
  │   create/:txnId ───────>│ Tạo VNPay URL           │
  │<── { paymentUrl } ──────│                         │
  │                         │                         │
  │── redirect ─────────────┼────────────────────────>│
  │                         │                         │ Buyer thanh toán
  │                         │<── IPN (server call) ───│
  │                         │ Cập nhật DB             │
  │                         │ transaction=completed   │
  │                         │ bike=sold               │
  │<── redirect ────────────┼─────────────────────────│
  │   (vnpay-return)        │                         │
  │                         │                         │
  │── GET /payment/v1/      │                         │
  │   status/:txnId ───────>│ Kiểm tra trạng thái     │
  │<── { status:completed } │                         │
```

### API Calls Chi Tiết:

#### Bước 1: Tạo Transaction
```http
POST /api/buyer/v1/transactions
Authorization: Bearer <buyer_token>
Content-Type: application/json

{
  "bikeId": "uuid-của-xe",
  "amount": 15000000,
  "notes": "Mua xe Trek FX3"
}
```
**Response:** `{ "data": { "id": "transaction-uuid", "status": "pending" } }`

#### Bước 2: Tạo URL Thanh Toán
```http
POST /api/payment/v1/create/{transactionId}
Authorization: Bearer <buyer_token>
```
**Response:**
```json
{
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
    "transactionId": "uuid",
    "amount": 15000000
  }
}
```

#### Bước 3: Redirect đến paymentUrl
- Frontend mở `paymentUrl` trong browser
- Buyer nhập thông tin thẻ và thanh toán

#### Bước 4: Kiểm Tra Kết Quả
```http
GET /api/payment/v1/status/{transactionId}
Authorization: Bearer <buyer_token>
```
**Response:** `{ "data": { "status": "completed", "paymentMethod": "vnpay" } }`

---

## 6. Test Với Thẻ Sandbox

Dùng thông tin thẻ test sau khi được redirect đến trang VNPay:

### Thẻ Nội Địa (ATM)
| Thông tin | Giá trị |
|-----------|---------|
| **Ngân hàng** | NCB |
| **Số thẻ** | `9704198526191432198` |
| **Tên chủ thẻ** | `NGUYEN VAN A` |
| **Ngày phát hành** | `07/15` |
| **Mật khẩu OTP** | `123456` |

### Thẻ Quốc Tế (Visa)
| Thông tin | Giá trị |
|-----------|---------|
| **Số thẻ** | `4456530000001005` |
| **Ngày hết hạn** | `01/27` |
| **CVV** | `123` |
| **OTP** | `123456` |

---

## 7. Kiểm Tra Kết Quả

### Xem log server
```
[VNPay IPN] Payment success for transaction xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[200] GET /api/payment/v1/vnpay-ipn (12ms)
```

### Xem trong Merchant Portal
1. Vào **https://sandbox.vnpayment.vn/merchantv2/**
2. Menu **Báo cáo** → **Lịch sử giao dịch**

### Kiểm tra DB trực tiếp
```bash
npm run db:studio
```
Mở **http://localhost:4983** → xem bảng `transactions` và `bikes`

---

## 8. Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `VNP_SECRET is undefined` | Chưa set .env | Thêm `VNP_SECRET` vào `.env` |
| `Invalid checksum` | Secret key sai | Kiểm tra lại `VNP_SECRET` |
| `Order not found` | txnRef không match | Xem log, kiểm tra UUID format |
| Transaction vẫn `pending` sau thanh toán | IPN URL sai/chưa cấu hình | Kiểm tra IPN URL trong Merchant Portal |
| VNPay báo lỗi URL | Dùng localhost | Phải dùng ngrok URL |
| `Invalid amount` | Số tiền không khớp | Kiểm tra amount trong transaction |

---

## ⚡ Tóm Tắt Nhanh

```
1. Đăng ký: https://sandbox.vnpayment.vn/devreg/
2. Lấy TmnCode + Secret từ Merchant Portal
3. Cập nhật .env với TmnCode, Secret, ngrok URL
4. Cấu hình IPN URL trong Merchant Portal = https://ngrok/api/payment/v1/vnpay-ipn
5. Restart server
6. Test flow: tạo transaction → tạo paymentUrl → thanh toán → check status
```

---

**Tài liệu tham khảo:**
- VNPay Sandbox: https://sandbox.vnpayment.vn/merchantv2/
- VNPay Dev Docs: https://sandbox.vnpayment.vn/apis/docs/huong-dan-tich-hop/
- Thẻ test: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/
