# Payment System - Complete Overview

## 📂 File Structure

```
BE/
├── src/
│   ├── controllers/
│   │   └── paymentController.ts          ← Main payment logic (VNPay integration)
│   ├── routes/
│   │   └── paymentRoutes.ts              ← Payment API endpoints + Swagger docs
│   ├── middleware/
│   │   └── authMiddleware.ts             ← JWT authentication middleware
│   └── db/
│       └── schema.ts                     ← Database schema (transactions, bikes, users)
├── package.json                          ← Dependencies (qrcode, crypto, express)
├── .env                                  ← Configuration (VNP_SECRET, VNP_TMNCODE, etc)
├── server.ts                             ← Express server setup
└── VNPAY_GUIDE.md                       ← VNPay setup instructions
```

---

## 🔑 Key Components

### 1. **Payment Controller** (`src/controllers/paymentController.ts`)

#### Core Functions:

| Function | Purpose | Auth |
|----------|---------|------|
| `buildVNPayUrl()` | Generates VNPay payment URL with HMAC signature | Internal |
| `verifyVNPaySignature()` | Verifies HMAC-SHA512 signature from VNPay | Internal |
| `generateQRCode()` | Creates QR code from payment URL | Internal |
| `createPaymentUrl()` | POST endpoint - creates payment URL for full payment | Bearer Token |
| `createRemainingPaymentUrl()` | POST endpoint - creates payment URL for remaining balance | Bearer Token |
| `vnpayReturn()` | GET endpoint - returns after VNPay payment (browser redirect) | None |
| `vnpayIPN()` | GET endpoint - server-to-server callback from VNPay | None |
| `getPaymentStatus()` | GET endpoint - check transaction status | Bearer Token |

---

### 2. **Payment Routes** (`src/routes/paymentRoutes.ts`)

```
POST   /api/payment/v1/create/:transactionId
       ↑ Creates payment URL for approved transaction
       
GET    /api/payment/v1/vnpay-return
       ↑ VNPay redirects here after payment (UX only)
       
GET    /api/payment/v1/vnpay-ipn
       ↑ VNPay calls here to notify payment result (DB updates)
       
GET    /api/payment/v1/status/:transactionId
       ↑ Check payment status
       
POST   /api/payment/v1/create-remaining/:transactionId
       ↑ Creates payment URL for remaining balance after deposit
```

---

### 3. **Database Schema** (`src/db/schema.ts`)

#### **transactions table**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT random_uuid(),
  bikeId UUID NOT NULL → references bikes(id),
  buyerId UUID NOT NULL → references users(id),
  sellerId UUID NOT NULL → references users(id),
  
  -- Amount info
  amount DOUBLE PRECISION NOT NULL,           -- Amount paid in this txn
  transactionType VARCHAR(50) DEFAULT 'full_payment',  -- 'full_payment' | 'deposit' | 'remaining_payment'
  remainingBalance DOUBLE PRECISION,          -- For deposits: remaining amount to pay
  
  -- Status & Payment
  status VARCHAR(50) DEFAULT 'pending',       -- 'pending' | 'approved' | 'completed' | 'cancelled'
  paymentMethod VARCHAR(50),                  -- 'vnpay', etc.
  
  -- Metadata
  notes TEXT,                                 -- Transaction notes
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);
```

#### **bikes table** (relevant fields)
```sql
CREATE TABLE bikes (
  id UUID PRIMARY KEY,
  sellerId UUID NOT NULL → references users(id),
  price DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'approved', 'rejected', 'hidden', 'reserved', 'sold'
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);
```

---

## 🔐 Signature Verification Flow

### **Building VNPay URL (Backend → Browser → VNPay)**

```
Input: params = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'XXXX',
  vnp_Amount: '450000000',
  ...
}

Step 1: Sort keys alphabetically
  sortedKeys = ['vnp_Amount', 'vnp_Command', ...]

Step 2: Build raw hash string (NO URL encoding)
  hashData = 'vnp_Amount=450000000&vnp_Command=pay&...'

Step 3: Calculate HMAC-SHA512
  hmac = crypto.createHmac('sha512', VNP_SECRET)
  secureHash = hmac.update(hashData).digest('hex')
  → e.g., 'abcdef123456...'

Step 4: URL encode values for query string
  queryString = 'vnp_Amount=' + encodeURIComponent('450000000') + '&...'

Output: URL to browser
  https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=450000000&...&vnp_SecureHash=abcdef123456...
```

### **Verifying Signature (IPN Callback)**

```
VNPay calls: GET /api/payment/v1/vnpay-ipn?vnp_TxnRef=xxx&...&vnp_SecureHash=yyy

Step 1: Extract received signature
  receivedHash = params['vnp_SecureHash']

Step 2: Remove signature from params
  filteredParams = params (without vnp_SecureHash & vnp_SecureHashType)

Step 3: Rebuild hash (same logic as above)
  sortedKeys = Object.keys(filteredParams).sort()
  hashData = sortedKeys.map(k => `${k}=${filteredParams[k]}`).join('&')
  calculatedHash = HMAC-SHA512(hashData, VNP_SECRET)

Step 4: Compare
  if (calculatedHash === receivedHash) → Valid ✓
  else → Invalid ✗
```

---

## 📋 Payment Flow Diagrams

### **Flow 1: Full Payment (100%)**

```
Buyer                   Backend                 VNPay              Bike
  │                        │                       │                │
  ├─ Create Txn ──────────→│ transactionType:'full_payment'         │
  │ (Buy bike)        status:'pending'            │                │
  │                   bike.status:'approved'      │                │
  │                        │                       │                │
  │◄──────────────────────┤ Return txn.id         │                │
  │                        │                       │                │
  ├─ Seller approves ─────→│ Seller response       │                │
  │                   status → 'approved'          │                │
  │◄─ Approved ───────────│                        │                │
  │                        │                       │                │
  ├─ Request paymentUrl ──→│ POST /payment/v1/create/:txnId         │
  │  (with bearer token)   ├─ Check: status='approved'             │
  │                        ├─ buildVNPayUrl(params)                │
  │                        ├─ generateQRCode()     │                │
  │◄─ paymentUrl ─────────│ Return: {paymentUrl, qrCode, expiresAt=now+10m}
  │ + QR code              │                       │                │
  │                        │                       │                │
  ├─ Redirect paymentUrl ──┼─────────────────────→│ Payment Form    │
  │ (frontend)             │                   (Card payment page) │
  │                        │                       │                │
  │                        │  VNPay Success        │                │
  │                        │◄──────────────────────┤                │
  │◄───────────────────────┼─── Redirect vnpay-return
  │ (UX - shows success)   │                       │                │
  │                        │                       │                │
  │                        │  ↓ IPN Callback (parallel)             │
  │                        │◄──────────────────────┤ (server-to-server)
  │                        │ Verify signature      │                │
  │                        │ Check amount ✓        │                │
  │                        ├─ Update txn.status='completed'         │
  │                        ├─ Set bike.status='sold' ──────────────→│
  │                        ├─ Return: {RspCode:'00'} │               │
  │                        │                       │                │
  │                        │ DB Updated ✓          │                │
  └────────────────────────┴───────────────────────┴────────────────┘

Database Result:
  transactions.status = 'completed' ✓
  bikes.status = 'sold' ✓
```

### **Flow 2: Deposit + Remaining Payment**

```
PHASE 1: DEPOSIT (10%)
─────────────────────

Buyer                   Backend                 VNPay              Bike
  │                        │                       │                │
  ├─ Create Txn ──────────→│ transactionType:'deposit'              │
  │ (10% deposit)     amount:2M (10%)             │                │
  │                   remainingBalance:18M        │
  │                   status:'pending'            │                │
  │                   bike.status:'awaiting_deposit'  │             │
  │◄──────────────────────┤ Return txn.id         │                │
  │                        │                       │                │
  ├─ Seller approves ─────→│ status → 'approved'   │                │
  │                        │                       │                │
  ├─ Request paymentUrl ──→│ buildVNPayUrl(2M)     │                │
  │ (for 2M deposit)  ├─ generateQRCode()         │                │
  │◄─ paymentUrl ─────────│ Return: {paymentUrl, qrCode}           │
  │                        │                       │                │
  ├─ Pay 2M ──────────────┼──────────────────────→│ [Pay 2M]       │
  │                        │                       │                │
  │                        │◄──────── IPN ─────────┤                │
  │                        │ Verify signature ✓    │                │
  │                        ├─ txn.status='completed'                │
  │                        ├─ bike.status='reserved' ──────────────→│
  │◄──────────────────────┤ 7 days to pay remaining                │
  │ (Bike reserved)        │                       │                │
  │                        │                       │

PHASE 2: REMAINING PAYMENT (90%)
────────────────────────────────

Buyer                   Backend                 VNPay              Bike
  │                        │                       │                │
  ├─ Request remaining ───→│ POST /payment/v1/create-remaining/:depositId
  │ paymentUrl       ├─ Check: txn.status='completed'  │            │
  │                        ├─ Check: remainingBalance > 0           │
  │                        ├─ Create NEW txn:      │                │
  │                        │   type:'remaining_payment'             │
  │                        │   amount:18M           │                │
  │                        │   status:'pending'     │                │
  │                        ├─ buildVNPayUrl(18M)   │                │
  │◄─ paymentUrl ─────────│ Return: {paymentUrl, depositTxnId, newTxnId}
  │ (for 18M)             │                       │                │
  │                        │                       │                │
  ├─ Pay 18M ─────────────┼──────────────────────→│ [Pay 18M]      │
  │                        │                       │                │
  │                        │◄──────── IPN ─────────┤                │
  │                        │ Verify signature ✓    │                │
  │                        ├─ remaining_txn.status='completed'      │
  │                        ├─ bike.status='sold'   ──────────────────│
  │                        ├─ UPDATE original deposit txn │         │
  │                        │   notes → 'FULLY PAID' │               │
  │◄──────────────────────┤ Full payment received  │                │
  │ (Sale complete)        │                       │                │
  │                        │                       │

Database Result:
  deposit_txn.status = 'completed' ✓
  remaining_txn.status = 'completed' ✓
  bikes.status = 'sold' ✓
```

---

## ⚙️ Configuration (.env)

```env
# VNPay Sandbox Configuration
VNP_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX          # Sandbox Secret Key
VNP_TMNCODE=XXXXXXXX                                 # Sandbox Terminal ID

# URLs
VNP_RETURN_URL=https://xxxx.ngrok-free.app/api/payment/v1/vnpay-return
APP_URL=https://xxxx.ngrok-free.app

# JWT
JWT_SECRET=your_jwt_secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bike_marketplace_db
```

---

## 🔧 Dependencies

```json
{
  "express": "~4.16.1",           // Web framework
  "crypto": "built-in",            // HMAC-SHA512 signature
  "qrcode": "^1.5.4",             // QR code generation
  "jsonwebtoken": "^9.0.3",       // JWT auth
  "drizzle-orm": "^0.45.1",       // ORM
  "pg": "^8.18.0",                // PostgreSQL driver
  "vnpay": "^2.4.4"               // Optional VNPay SDK (not used in manual impl)
}
```

---

## 🚀 API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/payment/v1/create/:transactionId` | POST | Bearer | Create payment URL (full payment) |
| `/api/payment/v1/create-remaining/:transactionId` | POST | Bearer | Create payment URL (remaining balance) |
| `/api/payment/v1/vnpay-return` | GET | None | VNPay return redirect (UX) |
| `/api/payment/v1/vnpay-ipn` | GET | None | VNPay IPN callback (DB update) |
| `/api/payment/v1/status/:transactionId` | GET | Bearer | Check payment status |

---

## ✅ Transaction Status States

```
                    ┌─ pending ──────────→ approved ──┐
                    │                                  │
                    │                                  ↓
Full Payment:  create_txn ──→ [VNPay] ──→ completed ──→ [SUCCESS]
                    │                           │
                    └──────→ cancelled ─────────┘
                    

                           ┌─ pending ──→ approved ──→ [VNPay] ──→ completed (Deposit 10%)
                           │                                            │
Deposit + Remaining:  [create] ┴─────────────────────────────────────────┐
                           │                                            │
                           │  Bike status: 'reserved' ━━━━━━━━━━━━━━━┓ │
                           │                                         │ │
                           ├─ pending ──→ [VNPay] ──→ completed ────→┫─ bike: 'sold'
                           │   (remaining 90%)                  ┃    │
                           └──────────────────────────────────→┛    │
                                                  [SUCCESS]
```

---

## 🔍 Transaction Types

| Type | Amount | Next Step | Bike Status |
|------|--------|-----------|------------|
| `full_payment` | 100% of price | Direct payment | sold (if success) |
| `deposit` | Typically 10% | Remaining payment in 7 days | reserved |
| `remaining_payment` | Remaining % | None (finalizes) | sold (if success) |

---

## 📝 Key Notes

1. **Signature Verification**: Uses HMAC-SHA512 with raw (non-encoded) parameter string
2. **IPN is Authoritative**: Database updates only happen via IPN (vnpay-ipn), not vnpay-return
3. **QR Code**: Expires after 10 minutes (same as payment URL)
4. **Two flows**: Full payment (single) or deposit+remaining (two transactions)
5. **Bike Status Transition**:
   - Full payment: approved → sold
   - Deposit: awaiting_deposit → reserved → sold
