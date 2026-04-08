# 🎯 Project Workflow Breakdown - Complete Codebase Flow

## Table of Contents
1. [Authentication Flow](#1-authentication-flow)
2. [Payment Flow](#2-payment-flow)
3. [Refund Flow](#3-refund-flow)
4. [Payout Flow](#4-payout-flow)
5. [Deposit + Remaining Payment Flow](#5-deposit--remaining-payment-flow)
6. [System Fee Flow](#6-system-fee-flow)
7. [Seller Profile & Bike Listing Flow](#7-seller-profile--bike-listing-flow)
8. [Search & Browse Bikes Flow](#8-search--browse-bikes-flow)
9. [Wishlist Flow](#9-wishlist-flow)
10. [Inspection Flow](#10-inspection-flow)
11. [Fulfillment & Delivery Flow](#11-fulfillment--delivery-flow)
12. [Message & Chat Flow](#12-message--chat-flow)
13. [Report Flow](#13-report-flow)
14. [Review Flow](#14-review-flow)
15. [Admin Dashboard Flow](#15-admin-dashboard-flow)
16. [Key Database Tables](#16-key-database-tables)
17. [API Endpoints Reference](#17-api-endpoints-reference)

---

## 1. AUTHENTICATION FLOW

### Overview
Users register as buyer/seller, login with JWT tokens, check available roles

### Step 1: Check Available Roles
```
API: POST /api/auth/check-roles
File: src/controllers/authController.ts → checkRoles()

Code Flow:
├─ Extract email & password from body
├─ Query all users with this email
│  └─ One email can have multiple roles (buyer + seller)
├─ Verify password with bcrypt:
│  └─ bcrypt.compare(password, hashedPassword)
├─ Extract all roles for this email
├─ Return available roles (buyer, seller, or both)
└─ Return hasMultipleRoles flag

Database Query:
users table:
  └─ SELECT * FROM users WHERE email = ?
     └─ One email = multiple rows (one per role)

Response Example:
{
  "success": true,
  "data": {
    "email": "john@example.com",
    "roles": ["buyer", "seller"],
    "hasMultipleRoles": true
  }
}
```

### Step 2: Register New Account
```
API: POST /api/auth/register
File: src/controllers/authController.ts → register()

Code Flow:
├─ Extract: email, password, name, phone, role (buyer|seller)
├─ Validate:
│  ├─ Role must be "buyer" or "seller"
│  └─ Check email + role doesn't already exist (unique key: email + role)
├─ Hash password:
│  └─ bcrypt.hash(password, 10 rounds)
├─ Create user record:
│  ├─ id: uuid
│  ├─ email, hashedPassword, name, phone
│  ├─ role: buyer OR seller (ONE role per registration)
│  └─ avatar: null (can upload later)
├─ Return user data (without password)
└─ Return status 201 Created

Database Changes:
users table (INSERT):
  ├─ id: uuid
  ├─ email: "john@example.com"
  ├─ password: "$2a$10$..." (bcrypt hash)
  ├─ name: "John Doe"
  ├─ phone: "0912345678"
  ├─ role: "buyer" (just one)
  └─ avatar: null

Notes:
├─ Same user can have buyer + seller role
├─ Must register TWICE (once as buyer, once as seller)
└─ Each registration creates new user record with same email
```

### Step 3: Login
```
API: POST /api/auth/login
File: src/controllers/authController.ts → login()

Code Flow:
├─ Extract: email, password, role
├─ Find user:
│  └─ WHERE email = ? AND role = ?
│     └─ Specific role required (not just email)
├─ Verify password:
│  └─ bcrypt.compare(password, user.password)
├─ Generate JWT token:
│  ├─ Sign with JWT_SECRET
│  ├─ Payload: { userId, email, role }
│  ├─ ExpiresIn: "7d"
│  └─ token: "eyJhbGc..."
├─ Return token + user info
└─ Frontend stores token in localStorage

JWT Structure:
{
  "iss": "bike-marketplace",
  "sub": userId,
  "userId": "user-123",
  "email": "john@example.com",
  "role": "buyer",
  "iat": 1712000000,
  "exp": 1712604800  (7 days)
}

Response Example:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "user-123",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "buyer",
    "phone": "0912345678"
  }
}
```

### Step 4: Use JWT Token
```
All subsequent requests:
└─ Header: Authorization: Bearer <token>

Middleware: extractJWT (src/middleware/extractJWT.ts)
├─ Verify token signature
├─ Extract userId, email, role from payload
├─ Attach to req.user:
│  └─ req.user = { userId, email, role }
├─ If invalid/expired: Return 401 Unauthorized
└─ Continue to controller

Request Example:
GET /api/buyer/v1/transactions
Header: Authorization: Bearer eyJhbGc...

Middleware:
├─ Verify token
├─ Extract userId
└─ req.user.userId = "buyer-1"

Controller:
const buyerId = req.user!.userId  ← Use extracted userId
```

### Step 5: Logout
```
API: POST /api/auth/logout
File: src/controllers/authController.ts → logout()

Code Flow:
├─ Frontend includes Authorization header (verified by middleware)
├─ Backend returns 200 OK
└─ Frontend: localStorage.removeItem("token")

Note:
├─ JWT is stateless (no server-side session)
├─ Logout is FRONTEND-only (delete token)
├─ Token still valid until expiration if someone intercepts it
├─ For security: implement token blacklist (optional enhancement)
└─ Current implementation: no server-side tracking
```

### Authentication Flow Diagram
```
User                          Backend               Database
  │                             │                      │
  ├─ POST /check-roles ────────→ Query users email     │
  │ (email: john@x, pwd: 123)   │                      │
  │                             ├─ SELECT WHERE email──→
  │                             │◄─ roles: [buyer, seller]
  │◄────{roles}────────────────│
  │                             │
  ├─ User selects "seller"      │
  │                             │
  ├─ POST /register ──────────→ Create user           │
  │ (email, pwd, name, phone)   │ role: seller         │
  │ role: seller                │ hash password        │
  │                             ├──────INSERT─────────→
  │                             │◄─ user created
  │◄────201 Created────────────│
  │                             │
  ├─ POST /login ────────────→ Find user             │
  │ (email, pwd, role=seller)   │ Verify password     │
  │                             ├──────SELECT─────────→
  │                             │◄─ user + password
  │                             │ bcrypt.compare OK   │
  │                             │ Generate JWT        │
  │◄────{token, user}──────────│
  │                             │
  ├─ Store token in          │
  │   localStorage            │
  │                             │
  ├─ GET /my-bikes ──────────→ Middleware:          │
  │ Header: Bearer token        │ Verify token       │
  │                             │ Extract userId     │
  │                             │ req.user.userId    │
  │                             │                     │
  │                             │ getMyBikes(userId) │
  │                             ├──────SELECT─────────→
  │                             │◄─ bike list
  │◄────{bikes}────────────────│
```

---

## 2. PAYMENT FLOW

### Overview
Buyer purchases bike with full payment via VNPay

### Step-by-Step Breakdown

#### Step 1: Create Transaction (Buyer Initiates)
```
API: POST /api/buyer/v1/transactions
File: src/controllers/buyerController.ts → createTransaction()

Code Flow:
├─ Extract buyerId from JWT token
├─ Validate bike exists and is available
├─ Calculate system fee:
│  └─ systemFee = amount * 0.05
│  └─ sellerNetAmount = amount - systemFee
│  └─ originalBikePrice = bike.price
├─ Create transaction record:
│  └─ status: "pending"
│  └─ transactionType: "full_payment"
│  └─ amount: (full bike price)
│  └─ systemFee: (calculated fee)
│  └─ sellerNetAmount: (amount after fee)
└─ Return transactionId to buyer

Database Changes:
transactions table:
  ├─ id: uuid
  ├─ bikeId: bike-123
  ├─ buyerId: buyer-1
  ├─ sellerId: seller-1
  ├─ amount: 35000000
  ├─ systemFee: 1750000        ← 5% deducted here
  ├─ sellerNetAmount: 33250000 ← What seller gets
  ├─ originalBikePrice: 35000000
  ├─ transactionType: "full_payment"
  └─ status: "pending"
```

#### Step 2: Create Payment URL (Buyer Gets Payment Link)
```
API: POST /api/payment/v1/create/:transactionId
File: src/controllers/paymentController.ts → createPaymentUrl()

Code Flow:
├─ Get buyer ID from JWT
├─ Find transaction (must be pending, belong to buyer)
├─ Validate transaction status = "pending"
├─ Build VNPay payment parameters:
│  ├─ vnp_Amount: amount * 100 (in cents)
│  ├─ vnp_TxnRef: transactionId
│  ├─ vnp_OrderInfo: "ThanhToanXeDap-{txnId}"
│  ├─ vnp_ReturnUrl: VNP_RETURN_URL from .env
│  └─ vnp_SecureHash: HMAC-SHA512(params)
├─ Generate QR code from payment URL
└─ Return paymentUrl + QR code (expires in 10 min)

Validation:
├─ Transaction exists & belongs to buyer
├─ Transaction status == "pending"
└─ Amount > 0
```

#### Step 3: Buyer Pays on VNPay
```
Browser: Redirect to VNPay payment page
→ Buyer enters card details
→ Processes payment via bank
→ VNPay prepares callback
```

#### Step 4: VNPay Sends IPN (Server-to-Server Callback)
```
VNPay → Our Backend: GET /api/payment/v1/vnpay-ipn?vnp_TxnRef=...&vnp_ResponseCode=00&vnp_Amount=...
File: src/controllers/paymentController.ts → vnpayIPN()

Code Flow:
├─ Extract query params (no JWT needed - VNPay calls directly)
├─ Verify signature: HMAC-SHA512(params) == vnp_SecureHash
│  └─ If fails: Return RspCode=97 (Invalid checksum)
├─ Find transaction by vnp_TxnRef
│  └─ If not found: Return RspCode=01 (Order not found)
├─ Check expiration: created + 10 min > now
│  └─ If expired: Return RspCode=98 (Payment expired)
├─ Verify amount matches: vnp_Amount == expectedAmount
│  └─ If mismatch: Return RspCode=04 (Invalid amount)
├─ Idempotent check: if already completed, return RspCode=02
├─ Check response code:
│  └─ If responseCode != "00": Set txn.status = "cancelled"
├─ ✅ SUCCESS: Update transaction:
│  ├─ status: "completed"
│  ├─ paymentMethod: "vnpay"
│  └─ notes: "VNPay TxnNo: {...}, Bank: {...}"
├─ Update bike:
│  └─ status: "sold"
├─ Initialize fulfillment (mark preparing)
└─ Return RspCode=00 (Success)

Database Changes:
transactions table (UPDATE):
  ├─ status: "pending" → "completed"     ← Payment successful!
  ├─ paymentMethod: "vnpay"
  └─ notes: "VNPay TxnNo: 123456789..."

bikes table (UPDATE):
  └─ status: "available" → "sold"        ← Bike now sold!

fulfillments table (INSERT):
  ├─ transactionId: txn-123
  ├─ status: "preparing"
  └─ notes: "Seller preparing bike..."
```

#### Step 5: VNPay Redirects Buyer Back
```
VNPay Browser Redirect: GET VNP_RETURN_URL?vnp_ResponseCode=00&vnp_TxnRef=...
File: src/controllers/paymentController.ts → vnpayReturn()

Code Flow:
├─ Frontend receives query params
├─ Parse vnp_ResponseCode:
│  ├─ "00": Payment successful ✓
│  └─ Other: Payment failed ✗
├─ Call GET /api/payment/v1/status/:transactionId to verify
└─ Redirect to success/failure page

Note: DB update already happened via IPN callback above!
```

#### Step 6: Buyer Checks Status (Anytime)
```
API: GET /api/payment/v1/status/:transactionId
File: src/controllers/paymentController.ts → getPaymentStatus()

Code Flow:
├─ Get buyerId from JWT
├─ Find transaction (where buyerId matches & txnId matches)
├─ Return transaction with all details:
│  ├─ id, amount, status, paymentMethod
│  ├─ bike info, seller info
│  └─ timestamps
└─ Return status to buyer

Response Example:
{
  "success": true,
  "data": {
    "id": "txn-123",
    "amount": 35000000,
    "status": "completed",      ← Shows payment succeeded
    "paymentMethod": "vnpay",
    "bike": { "title": "Trek FX3", "brand": "Trek" },
    "seller": { "name": "Shop A", "phone": "012345" },
    "systemFee": 1750000,       ← Shows fee deducted
    "sellerNetAmount": 33250000 ← Shows seller gets this
  }
}
```

### Full Payment Flow Diagram
```
Buyer                 Backend              VNPay              Bank
  │                     │                    │                 │
  ├─ POST /transactions─→ Create txn         │                 │
  │                     │ (status=pending)   │                 │
  │◄──txnId─────────────│                    │                 │
  │                     │                    │                 │
  ├─ POST /create/:txnId──→ Build URL        │                 │
  │                     │                    │                 │
  │◄──paymentUrl────────│                    │                 │
  │                     │                    │                 │
  ├──Redirect to URL────────────────────→   │                 │
  │                     │                    │                 │
  │                     │                    ├─ Buyer enters   │
  │                     │                    │  card info      │
  │                     │                    │                 │
  │                     │                    ├─────────→ Verify card
  │                     │                    │◄────────  OK, charge
  │                     │◄──IPN (server)─────│ Payment success!
  │                     │ Update DB          │
  │                     │ txn=completed      │
  │                     │ bike=sold          │
  │◄──Redirect back─────────────────────────│
  │ (show success)      │                    │
  │                     │                    │
  ├─ GET /status/:txnId→ Query DB           │
  │                     │ status=completed  │
  │◄──{status:OK}───────│                    │
```

---

## 2. REFUND FLOW

### Overview
Buyer requests refund for completed transaction (gets money back)

### Configuration
```
.env:
REFUND_PROVIDER=mock        # Options: mock, mock-instant, vnpay
REFUND_MOCK_DELAY_MS=5000   # Wait 5 seconds before webhook confirm
```

### Step-by-Step Breakdown

#### Step 1: Buyer Requests Refund
```
API: POST /api/payment/v1/refund/:transactionId
File: src/controllers/paymentController.ts → requestRefund()

Code Flow:
├─ Extract buyerId from JWT
├─ Find transaction (where buyerId matches)
├─ Validate:
│  ├─ Transaction exists & belongs to buyer
│  ├─ Transaction status == "completed"
│  ├─ No existing refund for this transaction
│  └─ Reason provided (min 10 chars)
├─ Create refund record:
│  └─ status: "pending"
│  └─ amount: transaction.amount
│  └─ reason: user input
├─ Extract VNPay transaction number from notes
├─ Call sendRefundRequest():
│  └─ Select provider (mock/vnpay)
│  └─ Pass webhookUrl: /api/payment/v1/refund-callback
└─ Return response based on provider

Database Changes:
refunds table (INSERT):
  ├─ id: uuid
  ├─ transaction_id: txn-123
  ├─ buyer_id: buyer-1
  ├─ seller_id: seller-1
  ├─ amount: 35000000
  ├─ reason: "Bicycle condition not as described"
  ├─ status: "pending"        ← Waiting for approval
  └─ created_at: now
```

#### Step 2: Select Provider
```
File: src/services/refundProvider.ts → sendRefundRequest()

Code Flow (Decision Tree):
├─ Check REFUND_PROVIDER env var
├─ IF "vnpay":
│  ├─ Call sendToVNPayRefundAPI()
│  ├─ Sign request with HMAC-SHA512
│  ├─ POST to https://api.vnpayment.vn/merchant_webapi/api/transaction
│  ├─ Wait for webhook (3-5 business days)
│  └─ Return status="pending"
├─ ELSE IF "mock-instant":
│  ├─ Call mockInstantRefund()
│  ├─ Return status="completed" immediately
│  └─ Update DB now (no waiting)
└─ ELSE (default "mock"):
   ├─ Call mockRefundWithDelay()
   ├─ Schedule setTimeout(webhookCallback, 5000ms)
   └─ Return status="pending"
```

#### Step 3A: Mock with Delay (5 seconds)
```
File: src/services/refundProvider.ts → mockRefundWithDelay()

Code Flow:
├─ Log: "Refund will complete in 5 seconds"
├─ Return to buyer immediately with status="pending"
├─ Schedule setTimeout:
│  └─ After 5 seconds:
│     └─ Call sendRefundWebhookCallback(webhookUrl, data)

setTimeout fires at T=5s:
  └─ Make HTTP POST to /api/payment/v1/refund-callback
     └─ Body: { refundId, status: "completed", ... }
```

#### Step 4: Webhook Callback Received
```
API: POST /api/payment/v1/refund-callback
File: src/controllers/paymentController.ts → handleRefundCallback()

Code Flow:
├─ Extract refundId, status from request body
├─ Find refund record
├─ Idempotent check: if already processed, skip
├─ Update refund:
│  ├─ status: "pending" → "completed"
│  ├─ processedAt: now
│  └─ rejectedReason: null
├─ IF status == "completed":
│  ├─ Update transaction:
│  │  └─ status: "completed" → "refunded"
│  ├─ Update bike:
│  │  ├─ status: "sold" → "for_sale"
│  │  └─ Back on marketplace for resale!
│  └─ Log: "Refund completed and bike returned to market"
└─ Return 200 OK

Database Changes:
refunds table (UPDATE):
  └─ status: "pending" → "completed" ✓

transactions table (UPDATE):
  └─ status: "completed" → "refunded" ✓

bikes table (UPDATE):
  └─ status: "sold" → "for_sale" ✓ (Back on market!)
```

#### Step 5: Buyer Checks Refund Status
```
API: GET /api/payment/v1/refund/:refundId/status
File: src/controllers/paymentController.ts → getRefundStatus()

Code Flow:
├─ Get buyerId from JWT
├─ Find refund (where refundId matches & buyerId matches)
├─ Return refund details with linked transaction
└─ Return status

Response Example:
{
  "success": true,
  "refund": {
    "id": "refund-abc",
    "status": "completed",       ← Shows refund done
    "amount": 35000000,
    "reason": "Bicycle condition...",
    "processedAt": "2026-04-08T14:31:00Z",
    "transaction": {
      "id": "txn-123",
      "status": "refunded",       ← Shows txn is refunded
      "bike": { "title": "Trek", "status": "for_sale" }  ← Back on market
    }
  }
}
```

#### Step 6: List All Refunds
```
API: GET /api/payment/v1/refunds
File: src/controllers/paymentController.ts → listRefunds()

Code Flow:
├─ Get buyerId from JWT
├─ Find all refunds where buyerId matches
├─ Sort by createdAt DESC (newest first)
├─ Include transaction details
└─ Return array of refunds

Response Example:
{
  "success": true,
  "data": [
    { id: "refund-1", status: "completed", amount: 35000000 },
    { id: "refund-2", status: "pending", amount: 50000000 },
    ...
  ]
}
```

### Full Refund Flow Diagram (5 second delay)
```
T=0s    Buyer                 Backend              Mock Provider
        │                       │
        ├─ POST /refund/:txnId─→ Validate
        │                       │ Create refund
        │                       │ (status=pending)
        │◄─Response "pending"──│
        │                       │ setTimeout(5000ms)
        │                       │
        │ (Buyer goes away...)  │

T=5s    │                       │ Webhook fires
        │                       ├─ POST /refund-callback
        │                       │ handleRefundCallback()
        │                       ├─ Update refund→completed
        │                       ├─ Update txn→refunded
        │                       └─ Update bike→for_sale

T=5s+   Buyer                 Backend
        ├─ GET /refund/:refundId/status
        │                       │
        │◄─status="completed"──│
```

---

## 3. PAYOUT FLOW

### Overview
Seller withdraws money after buyer confirms delivery (receives full payment minus 5% fee)

### Step-by-Step Breakdown

#### Step 1: Transaction Completed & Delivered
```
Prerequisites:
├─ Transaction status: "completed"
├─ Delivery status: "delivered"
├─ Buyer confirmed receipt (receiptConfirmedAt set)
└─ Seller bank info verified
```

#### Step 2: Seller Requests Payout
```
API: POST /api/payment/v1/payout/:transactionId
File: src/controllers/paymentController.ts → createPayout()

Code Flow:
├─ Get sellerId from JWT
├─ Find transaction (where sellerId matches & txnId matches)
├─ Validate:
│  ├─ Transaction status == "completed"
│  ├─ Delivery status == "delivered"
│  ├─ Receipt confirmed
│  ├─ Seller has bank info (account, holder name, code)
│  └─ Check existing payout:
│     └─ If exists & NOT failed: Return error
│     └─ If failed: Allow retry (new payout record)
├─ Calculate payout amount:
│  └─ payoutAmount = sellerNetAmount
│     (Already has 5% fee deducted)
├─ Create payout record:
│  ├─ amount: payoutAmount
│  ├─ status: "pending"
│  └─ externalPayoutId: "PAYOUT_" + timestamp
├─ Send to payout provider:
│  └─ sendPayoutRequest(payoutId, amount, bankInfo, webhookUrl)
└─ Return payout details to seller

Database Changes:
payouts table (INSERT):
  ├─ id: uuid
  ├─ transaction_id: txn-123
  ├─ seller_id: seller-1
  ├─ amount: 33250000           ← After 5% fee deducted
  ├─ bankAccountNumber: "1234567890"
  ├─ bankCode: "VCB"
  ├─ status: "pending"          ← Waiting for provider
  ├─ externalPayoutId: "PAYOUT_1712000000_seller1"
  └─ payoutAt: now
```

#### Step 3: Send to Payout Provider
```
File: src/services/payoutProvider.ts (similar to refund provider)

Code Flow:
├─ Build payout request
├─ Sign with credentials
├─ POST to provider API:
│  └─ Bank details + amount + webhook URL
└─ Return response

Mock behavior (if configured):
├─ Schedule webhook callback after delay
└─ Return status="pending"
```

#### Step 4: Payout Webhook Callback
```
API: POST /api/payment/v1/payout-callback
File: src/controllers/paymentController.ts → handlePayoutCallback()

Code Flow:
├─ Verify signature
├─ Find payout
├─ Idempotent check
├─ Update payout:
│  ├─ status: "completed" or "failed"
│  ├─ completedAt: timestamp (if success)
│  ├─ failureReason: message (if failed)
│  └─ webhookReceivedAt: now
└─ Return 200 OK

Database Changes:
payouts table (UPDATE):
  ├─ status: "pending" → "completed" ✓
  ├─ completedAt: timestamp
  └─ webhookReceivedAt: timestamp
```

#### Step 5: Seller Checks Payout Status
```
API: GET /api/payment/v1/payout/:payoutId/status
File: src/controllers/paymentController.ts → getPayoutStatus()

Response:
{
  "payout": {
    "id": "payout-xyz",
    "status": "completed",      ← Money transferred!
    "amount": 33250000,
    "completedAt": "2026-04-08T15:00:00Z",
    "transaction": { "id": "txn-123", "amount": 35000000 }
  }
}
```

### Payout Retry (If Failed)
```
If previous payout status = "failed":

API: POST /api/payment/v1/payout/:transactionId (same endpoint)
File: src/controllers/paymentController.ts → createPayout()

Code Flow:
├─ Check existing payout: status == "failed" ✓
├─ Allow new request ✓
├─ Create NEW payout record:
│  └─ Different ID, different externalPayoutId
├─ Send to provider again
└─ Return new payout details

Seller can retry unlimited times until success ✓
```

---

## 4. DEPOSIT + REMAINING PAYMENT FLOW

### Overview
Buyer pays 10-30% deposit, gets bike reserved. Later pays remaining balance.

### Step 1: Create Deposit Transaction
```
API: POST /api/buyer/v1/transactions
Payload:
{
  "bikeId": "bike-123",
  "amount": 3500000,           ← 10% of 35M
  "transactionType": "deposit"
}

File: src/controllers/buyerController.ts → createTransaction()

Code Flow:
├─ Validate deposit is 10%-30% of bike price
├─ Calculate fees:
│  └─ systemFee: 0 (no fee on deposit!)
│  └─ sellerNetAmount: amount (seller gets full amount)
│  └─ originalBikePrice: 35000000 (store for later!)
├─ Create transaction:
│  ├─ transactionType: "deposit"
│  ├─ status: "pending"
│  └─ remainingBalance: 35000000 - 3500000 = 31500000
└─ Return transactionId

Database:
transactions table:
  ├─ transactionType: "deposit"    ← Type indicator
  ├─ amount: 3500000               ← Deposit amount
  ├─ systemFee: 0                  ← NO FEE ON DEPOSIT
  ├─ sellerNetAmount: 3500000      ← Full amount to seller
  ├─ originalBikePrice: 35000000   ← Store for remaining calc
  └─ remainingBalance: 31500000
```

### Step 2: Pay Deposit via VNPay
```
Same as regular payment flow, but VNPay IPN handler checks:

File: src/controllers/paymentController.ts → vnpayIPN()

Code Flow:
├─ Find transaction
├─ Check transactionType == "deposit"
├─ If success:
│  ├─ Update transaction.status = "completed"
│  ├─ Update bike.status = "reserved"  ← NOT sold yet!
│  └─ Update fulfillment: skip (no fulfillment on deposit)
└─ Return success

Database:
transactions table:
  └─ status: "completed"

bikes table:
  └─ status: "reserved"           ← Buyer has first right
```

### Step 3: Create Remaining Payment Transaction
```
API: POST /api/payment/v1/create-remaining/:depositTransactionId
File: src/controllers/paymentController.ts → createRemainingPaymentUrl()

Code Flow:
├─ Find deposit transaction
├─ Validate deposit transaction exists & is completed
├─ Create NEW transaction for remaining balance:
│  ├─ transactionType: "remaining_payment"
│  ├─ amount: remainingBalance (31500000)
│  ├─ systemFee: originalBikePrice * 0.05 = 1750000
│  │  └─ (Fee calculated on ORIGINAL price, not remaining!)
│  ├─ sellerNetAmount: 31500000 - 1750000 = 29750000
│  ├─ originalBikePrice: (from deposit txn) 35000000
│  └─ linkedTransactionId: (link to deposit)
├─ Create payment URL via VNPay
└─ Return paymentUrl

Database:
transactions table (INSERT new):
  ├─ transactionType: "remaining_payment"  ← New type
  ├─ amount: 31500000
  ├─ systemFee: 1750000                    ← 5% of ORIGINAL price
  ├─ sellerNetAmount: 29750000
  ├─ originalBikePrice: 35000000
  ├─ status: "pending"
  └─ linkedTransactionId: "deposit-txn-123"
```

### Step 4: Pay Remaining via VNPay
```
VNPay IPN handler checks transactionType == "remaining_payment":

File: src/controllers/paymentController.ts → vnpayIPN()

Code Flow:
├─ Find transaction (remaining_payment type)
├─ If success:
│  ├─ Update transaction.status = "completed"
│  ├─ Update bike.status = "sold"          ← NOW sold!
│  ├─ Extract linked deposit txn ID
│  ├─ Mark deposit as "fully_paid" in notes
│  ├─ Initialize fulfillment
│  └─ Create 2 payouts:
│     ├─ Deposit payout: 3500000
│     └─ Remaining payout: 29750000
//       └─ Total seller gets: 33250000 (same as full payment!)
└─ Return success

Database:
transactions table (remaining txn UPDATE):
  ├─ status: "completed"
  └─ notes: "... → FULLY PAID by remaining payment"

transactions table (deposit txn UPDATE):
  └─ notes: "... → FULLY PAID by remaining payment"

bikes table:
  └─ status: "sold"

fulfillments table:
  └─ status: "preparing"

payouts table (INSERT):
  ├─ Deposit payout: 3500000 (no fee)
  └─ Remaining payout: 29750000 (with fee)
```

### Complete Deposit Timeline
```
Day 1:
  Buyer: POST /transactions (10% deposit)
         ↓
         VNPay payment
         ↓
  DB: bike status = "reserved"
      transaction status = "completed"

Days 2-7:
  Buyer has bike reserved
  Other buyers can't buy it

Day 8:
  Buyer: POST /create-remaining/:depositTxnId
         ↓
         VNPay payment
         ↓
  DB: bike status = "sold"
      fulfillment starts
      payouts created for BOTH transactions

Results:
├─ Seller received:
│  ├─ Deposit: 3500000 (day 1)
│  ├─ Remaining: 29750000 (day 8)
│  └─ Total: 33250000 (same as if full payment!)
│
└─ System collected:
   └─ Fee: 1750000 (only on remaining_payment, not deposit)
```

---

## 5. SYSTEM FEE FLOW

### Overview
5% fee deducted from seller's payout (not charged to buyer)

### Where Fee is Applied

#### Full Payment (Immediately)
```
Buyer pays: 35,000,000
            ↓
Transaction created with:
├─ amount: 35,000,000
├─ systemFee: 1,750,000 (5%)
└─ sellerNetAmount: 33,250,000 (payout amount)

When payout:
└─ Seller receives: 33,250,000
```

#### Deposit (NO FEE)
```
Buyer pays: 3,500,000
            ↓
Transaction created with:
├─ amount: 3,500,000
├─ systemFee: 0 (no fee on deposit!)
└─ sellerNetAmount: 3,500,000

When payout:
└─ Seller receives: 3,500,000 (full amount)
```

#### Remaining Payment (Fee on ORIGINAL price)
```
Buyer pays: 31,500,000
            ↓
Transaction created with:
├─ amount: 31,500,000
├─ originalBikePrice: 35,000,000 (from deposit txn)
├─ systemFee: 35,000,000 * 0.05 = 1,750,000 (5% of ORIGINAL!)
└─ sellerNetAmount: 31,500,000 - 1,750,000 = 29,750,000

When payout:
└─ Seller receives: 29,750,000

Total seller gets:
├─ Deposit payout: 3,500,000
├─ Remaining payout: 29,750,000
└─ TOTAL: 33,250,000 (same as full payment - consistent!)
```

### Fee Calculation Code
```
File: src/controllers/buyerController.ts → createTransaction()

Code:
const systemFee = transaction.transactionType === 'deposit' 
  ? 0 
  : Math.round(transaction.amount * 0.05);

const sellerNetAmount = transaction.amount - systemFee;
const originalBikePrice = bike.price;

// For remaining payment, store original price for future fee calculation
if (transaction.transactionType === 'remaining_payment') {
  // Calculate fee based on original full bike price
  const originalFee = originalBikePrice * 0.05;
  // Use this when creating payout
}
```

### Fee Visualization
```
Scenario: Buyer wants to buy 35M bike

Option A: Full Payment
┌──────────────────────────┐
│ Buyer pays:    35,000,000│
├──────────────────────────┤
│ System fee   (-) 1,750,000│
├──────────────────────────┤
│ Seller gets: 33,250,000  │
└──────────────────────────┘

Option B: 10% Deposit + 90% Remaining
┌─────────────────┐  ┌──────────────────────────┐
│ Deposit: 3.5M   │  │ Remaining: 31.5M         │
│ Fee: 0 (none)   │  │ Fee: 1.75M (5% of orig)  │
│ Seller: 3.5M    │  │ Seller: 29.75M           │
└─────────────────┘  └──────────────────────────┘
                     
Total Seller: 3.5M + 29.75M = 33.25M ✓ (Same as full payment!)
System Fee collected: 1.75M (same as full payment)
```

---

## 7. SELLER PROFILE & BIKE LISTING FLOW

### Overview
Seller upgrades account, creates/edits bike listings, manages inventory

### Step 1: Upgrade to Seller Role
```
API: POST /api/profile/upgrade-to-seller
File: src/controllers/profileController.ts → upgradeToSeller()

Code Flow:
├─ Extract buyerId from JWT (must have buyer role first)
├─ Create new user record with SAME email but role="seller"
├─ Copy profile data from buyer account
├─ Validate:
│  ├─ Email + seller role doesn't exist yet
│  └─ User has complete profile (name, phone, avatar)
├─ Create seller user:
│  ├─ email: same as buyer
│  ├─ role: "seller"
│  └─ password: reuse buyer's hashed password
└─ Return new seller user ID & token

Database Changes:
users table (INSERT):
  ├─ id: uuid (different from buyer ID)
  ├─ email: "john@example.com" (same as buyer)
  ├─ password: (same hash as buyer)
  ├─ role: "seller"        ← New role!
  ├─ name, phone, avatar: (same as buyer)
  └─ createdAt: now

Note:
├─ One email = TWO user records (buyer + seller)
├─ Frontend gets new seller token
├─ Can switch roles via login (check-roles endpoint)
```

### Step 2: Seller Creates Bike Listing
```
API: POST /api/seller/v1/bikes
File: src/controllers/sellerController.ts → createBike()

Form Data (multipart):
├─ title, brand, model, year
├─ price (bike price)
├─ condition (excellent, good, fair, poor)
├─ description, color, size
├─ categoryId (UUID, slug, or name)
├─ images[] (upload files)
└─ video[] (optional)

Code Flow:
├─ Get sellerId from JWT (must be seller role)
├─ Validate bike inputs:
│  ├─ Year is valid (not NaN, not future)
│  ├─ Price > 0
│  ├─ Title not empty (min 5 chars)
│  ├─ Condition is valid
│  ├─ Category exists (resolve UUID/slug/name)
│  └─ At least 1 image uploaded
├─ Process images:
│  └─ Upload to storage (AWS S3 or local)
│  └─ Generate URLs for each image
├─ Process video:
│  └─ Upload first video if provided
│  └─ Generate URL
├─ Create bike record:
│  ├─ id: uuid
│  ├─ sellerId: seller-1
│  ├─ status: "pending"          ← Awaits inspector verification
│  ├─ isVerified: "pending"
│  ├─ images: [url1, url2, ...]
│  ├─ video: videoUrl (if provided)
│  └─ createdAt: now
├─ Auto-schedule inspection task
└─ Return bike data with status

Database Changes:
bikes table (INSERT):
  ├─ id: uuid
  ├─ seller_id: seller-1
  ├─ title: "Trek FX3"
  ├─ brand: "Trek"
  ├─ price: 35000000
  ├─ status: "pending"       ← Not for sale yet!
  ├─ is_verified: "pending"  ← Waiting for inspector
  ├─ images: ["url1", "url2"]
  ├─ video: "video_url"
  └─ created_at: now

Status Workflow:
pending → (inspector reviews) → verified OR rejected
verified → (admin approves) → approved (now for_sale)
```

### Step 3: Inspector Reviews Bike
```
See Section 10: INSPECTION FLOW for details
Brief: Inspector creates inspection record with photos/videos
       Inspector sets: status (approved/failed) + detailed report
       If approved: bike.isVerified = "verified"
       If failed: seller can resubmit after fixing issues
```

### Step 4: Admin Approves Bike
```
API: PUT /api/admin/v1/bike/:id/approve
File: src/controllers/adminController.ts → approveBike()

Code Flow:
├─ Get bike by ID
├─ Validate:
│  ├─ Bike exists
│  ├─ Bike.isVerified == "verified" (passed inspector)
│  └─ Bike.status == "pending"
├─ Update bike:
│  ├─ status: "pending" → "for_sale"  ← NOW LIVE!
│  ├─ approvedAt: now
│  └─ approvedBy: admin_id
└─ Bike now appears in search results

Database Changes:
bikes table (UPDATE):
  ├─ status: "for_sale"     ← Public listing!
  ├─ approved_at: timestamp
  └─ approved_by: admin_id
```

### Step 5: Seller Edits Bike Listing
```
API: PUT /api/seller/v1/bikes/:id
File: src/controllers/sellerController.ts → updateBike()

Code Flow:
├─ Get sellerId from JWT
├─ Find bike (must belong to seller)
├─ Validate new inputs (same as create)
├─ Process any new images:
│  └─ Add to existing images or replace
├─ Update bike record:
│  ├─ title, brand, price, description, etc.
│  └─ updatedAt: now
├─ If bike was for_sale:
│  └─ Stay for_sale (no re-approval needed for minor edits)
└─ Return updated bike

Notes:
├─ Can't edit bike status directly (use approve/reject endpoints)
├─ Major changes might trigger re-inspection (if config allows)
└─ History: old values not stored (logs in separate audit table optional)
```

### Step 6: Seller Toggles Bike Visibility
```
API: PATCH /api/seller/v1/bikes/:id/visibility
File: src/controllers/sellerController.ts → toggleBikeVisibility()

Code Flow:
├─ Get sellerId from JWT
├─ Find bike (must belong to seller)
├─ Toggle isVisible boolean:
│  ├─ isVisible: true → false (hide from search)
│  └─ isVisible: false → true (show in search)
├─ Update bike.updatedAt
└─ Return updated bike

Use Cases:
├─ Seller sold bike elsewhere, wants to hide it
├─ Temporarily hide while negotiating price
└─ Restore visibility if deal fell through

Status after hide:
├─ status stays "for_sale" (internal DB state)
├─ isVisible: false (hidden from public search)
├─ Buyers can't find it via search API
└─ Direct URL access blocked (403 if not verified owner)
```

### Step 7: Seller Resubmits Rejected Bike
```
API: POST /api/seller/v1/bikes/:id/resubmit
File: src/controllers/sellerController.ts → resubmitBike()

Code Flow:
├─ Get sellerId from JWT
├─ Find bike (must belong to seller & status="rejected")
├─ Validate new bike data (if provided)
├─ Update bike:
│  ├─ status: "rejected" → "pending"
│  ├─ images, title, price, etc. (updated data)
│  └─ rejectionReason: cleared
├─ Auto-schedule new inspection
└─ Return bike (back in review queue)

Database Changes:
bikes table (UPDATE):
  ├─ status: "rejected" → "pending"
  ├─ is_verified: "rejected" → "pending"
  ├─ updated fields from request
  └─ rejection_reason: NULL
```

---

## 8. SEARCH & BROWSE BIKES FLOW

### Overview
Buyers search for bikes with filters, browse categories, apply sorting

### Step 1: Get All Categories (No Login Required)
```
API: GET /api/buyer/v1/categories
File: src/controllers/buyerController.ts → getCategories()

Code Flow:
├─ Public endpoint (no JWT required)
├─ Query all categories from DB
├─ Sort by createdAt DESC
├─ Return category list

Response Example:
{
  "success": true,
  "data": [
    { "id": "cat-1", "name": "Mountain Bike", "slug": "mountain-bike", "icon": "url" },
    { "id": "cat-2", "name": "Road Bike", "slug": "road-bike", "icon": "url" },
    ...
  ]
}

Database Query:
SELECT * FROM categories ORDER BY created_at DESC
```

### Step 2: Search Bikes with Filters
```
API: GET /api/buyer/v1/bikes/search?brand=Trek&minPrice=1000000&maxPrice=50000000&condition=good&sortBy=price
File: src/controllers/buyerController.ts → searchBikes()

Query Parameters:
├─ brand: string (partial match, case-insensitive)
├─ model: string
├─ minPrice, maxPrice: number
├─ condition: string (excellent|good|fair|poor)
├─ color: string
├─ sortBy: string (createdAt|price|year|mileage)
├─ page, limit: pagination
└─ categoryId: string

Code Flow:
├─ Build WHERE clause dynamically:
│  ├─ WHERE status = "for_sale"              ← Only approved bikes!
│  ├─ WHERE isVisible = true                 ← Respect seller's hide toggle
│  ├─ IF brand: AND brand ILIKE "%Trek%"
│  ├─ IF price: AND price BETWEEN min AND max
│  ├─ IF condition: AND condition = ?
│  └─ IF categoryId: AND category_id = ?
├─ Apply sort:
│  ├─ sortBy="price": ORDER BY price ASC
│  ├─ sortBy="createdAt": ORDER BY created_at DESC
│  └─ Default: createdAt DESC
├─ Add JWT token check (optional):
│  └─ IF JWT exists: JOIN bikes_reserved
│     → Show "reserved_by_me" flag
├─ Paginate results:
│  └─ LIMIT :limit OFFSET :offset
└─ Return bike list

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "bike-1",
      "title": "Trek FX3",
      "brand": "Trek",
      "price": 35000000,
      "images": ["url1", "url2"],
      "status": "for_sale",
      "sellerName": "John's Shop",
      "condition": "excellent"
    },
    ...
  ],
  "pagination": { "page": 1, "limit": 20, "total": 156 }
}

Database Query:
SELECT * FROM bikes 
WHERE status='for_sale' AND is_visible=true
  AND brand ILIKE '%Trek%'
  AND price BETWEEN ? AND ?
  AND condition = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

### Step 3: Get Single Bike Detail
```
API: GET /api/buyer/v1/bikes/:id
File: src/controllers/buyerController.ts → getBikeDetail()

Code Flow:
├─ Get bikeId from URL params
├─ Find bike (must be for_sale & isVisible)
├─ Fetch related data:
│  ├─ Seller info (name, avatar, rating, reviews count)
│  ├─ Inspection report (if available)
│  ├─ All images + video
│  └─ Category info
├─ IF JWT exists & authenticated:
│  ├─ Check if buyer added to wishlist
│  └─ Add wishlistFlag to response
├─ Return complete bike data

Response Example:
{
  "success": true,
  "data": {
    "id": "bike-1",
    "title": "Trek FX3",
    "brand": "Trek",
    "model": "FX3",
    "price": 35000000,
    "condition": "excellent",
    "year": 2023,
    "mileage": 500,
    "description": "Excellent condition, recently serviced",
    "images": ["url1", "url2", "url3"],
    "video": "video_url",
    "seller": {
      "id": "seller-1",
      "name": "John's Bike Shop",
      "avatar": "url",
      "rating": 4.8,
      "reviewCount": 45
    },
    "inspection": {
      "overallCondition": "excellent",
      "frameCondition": "good",
      "brakes": "excellent",
      ...
    },
    "inWishlist": true  ← If buyer authenticated
  }
}
```

### Step 4: Get Recommended Bikes (AI/ML Based)
```
API: GET /api/buyer/v1/bikes/recommended
File: src/controllers/buyerController.ts → getRecommendedBikes()

Code Flow:
├─ IF JWT exists:
│  ├─ Get buyerId from token
│  ├─ Query buyer's transaction history
│  ├─ Extract brands, categories buyer purchased
│  ├─ Find similar bikes:
│     └─ WHERE brand IN (buyer_brands) OR categoryId IN (buyer_cats)
│     └─ AND status="for_sale"
│     └─ AND price BETWEEN (avg_price - 20%) AND (avg_price + 20%)
│  └─ Return recommended list
└─ IF no JWT:
   ├─ Return trending bikes (most views/favorites)
   ├─ Return new listings
   └─ Generic recommendations

Response Example:
{
  "success": true,
  "data": [
    { "id": "bike-1", "title": "...", "reason": "Similar brand" },
    { "id": "bike-2", "title": "...", "reason": "Similar price range" },
    ...
  ]
}
```

---

## 9. WISHLIST FLOW

### Overview
Buyers bookmark bikes they're interested in, compare later

### Step 1: Get Wishlist
```
API: GET /api/buyer/v1/wishlist
File: src/controllers/buyerController.ts → getWishlist()

Code Flow:
├─ Get buyerId from JWT
├─ Query wishlist items:
│  └─ SELECT * FROM wishlists WHERE buyer_id = ?
├─ Join with bikes table for current data:
│  └─ Get bike title, price, images, current status
├─ Sort by createdAt DESC (newest first)
└─ Return wishlist items

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "wish-1",
      "bike": {
        "id": "bike-1",
        "title": "Trek FX3",
        "price": 35000000,
        "images": ["url"],
        "status": "for_sale"      ← Still available?
      },
      "addedAt": "2026-04-08T10:00:00Z"
    },
    ...
  ]
}

Database Query:
SELECT w.*, b.* FROM wishlists w
JOIN bikes b ON w.bike_id = b.id
WHERE w.buyer_id = ?
ORDER BY w.created_at DESC
```

### Step 2: Add to Wishlist
```
API: POST /api/buyer/v1/wishlist/:bikeId
File: src/controllers/buyerController.ts → addToWishlist()

Code Flow:
├─ Get buyerId from JWT
├─ Find bike (must exist & be for_sale)
├─ Check if already in wishlist:
│  └─ If yes: Return 400 (already added)
├─ Create wishlist entry:
│  └─ wishlist_id: uuid
│  └─ buyer_id: buyer-1
│  └─ bike_id: bike-1
│  └─ created_at: now
├─ Return created wishlist item
└─ Update bike.wishlistCount++

Database Changes:
wishlists table (INSERT):
  ├─ id: uuid
  ├─ buyer_id: buyer-1
  ├─ bike_id: bike-1
  └─ created_at: now

bikes table (UPDATE):
  └─ wishlist_count: wishlist_count + 1
```

### Step 3: Remove from Wishlist
```
API: DELETE /api/buyer/v1/wishlist/:bikeId
File: src/controllers/buyerController.ts → removeFromWishlist()

Code Flow:
├─ Get buyerId from JWT
├─ Find wishlist entry:
│  └─ WHERE buyer_id = ? AND bike_id = ?
├─ Delete wishlist entry
├─ Update bike.wishlistCount--
└─ Return 200 success

Database Changes:
wishlists table (DELETE):
  └─ WHERE buyer_id = buyer-1 AND bike_id = bike-1

bikes table (UPDATE):
  └─ wishlist_count: wishlist_count - 1
```

---

## 10. INSPECTION FLOW

### Overview
Inspector audits bike listings, creates detailed inspection reports, approves/rejects bikes

### Step 1: Inspector Gets Dashboard
```
API: GET /api/inspector/v1/dashboard
File: src/controllers/inspectorController.ts → getDashboard()

Code Flow:
├─ Get inspectorId from JWT
├─ Query statistics:
│  ├─ Total inspections assigned
│  ├─ Completed inspections
│  ├─ Pending inspections
│  ├─ Failed/rejected inspections
│  └─ Average inspection time
├─ Return dashboard stats

Response Example:
{
  "success": true,
  "data": {
    "totalInspections": 156,
    "completed": 140,
    "pending": 10,
    "failed": 6,
    "avgTime": "2.5 hours"
  }
}
```

### Step 2: Get Pending Bikes to Inspect
```
API: GET /api/inspector/v1/bikes/pending
File: src/controllers/inspectorController.ts → getPendingBikes()

Code Flow:
├─ Query bikes where:
│  ├─ status = "pending"
│  ├─ isVerified = "pending"
│  └─ No inspection record yet (or latest status != "completed")
├─ Load seller info + bike details
├─ Return pending bikes list

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "bike-1",
      "title": "Trek FX3",
      "seller": { "name": "John's Shop", "email": "..." },
      "price": 35000000,
      "images": ["url1", "url2"],
      "createdAt": "2026-04-07T10:00:00Z"
    },
    ...
  ]
}
```

### Step 3: Inspector Starts Inspection
```
API: POST /api/inspector/v1/bikes/:id/start-inspection
File: src/controllers/inspectorController.ts → startInspection()

Code Flow:
├─ Get inspectorId from JWT
├─ Find bike (must be pending & not inspected)
├─ Create inspection record:
│  ├─ inspection_id: uuid
│  ├─ bike_id: bike-1
│  ├─ inspector_id: inspector-1
│  ├─ status: "in_progress"   ← Currently inspecting
│  ├─ startedAt: now
│  └─ notes: ""
├─ Lock bike from other inspectors:
│  └─ assigned_to: inspector-1
└─ Return inspection record

Database Changes:
inspections table (INSERT):
  ├─ id: uuid
  ├─ bike_id: bike-1
  ├─ inspector_id: inspector-1
  ├─ status: "in_progress"
  ├─ started_at: now
  └─ created_at: now

bikes table (UPDATE):
  └─ inspection_in_progress: true
```

### Step 4: Inspector Submits Inspection Report
```
API: POST /api/inspector/v1/bikes/:id/submit-inspection
File: src/controllers/inspectorController.ts → submitInspection()

Form Data (multipart):
├─ status: "approved" | "failed"
├─ overallCondition: excellent|good|fair|poor
├─ frameCondition: excellent|good|fair|poor
├─ brakeCondition: excellent|good|fair|poor
├─ drivetrainCondition: excellent|good|fair|poor
├─ wheelCondition: excellent|good|fair|poor
├─ inspectionNote: string (detailed notes)
├─ recommendation: string
├─ inspectionImages[]: array of files
├─ reportFile: PDF file
└─ reason: string (required if status="failed", min 20 chars)

Code Flow:
├─ Get inspectorId from JWT
├─ Find inspection (must be "in_progress")
├─ Validate inputs:
│  ├─ All condition fields must be valid
│  └─ If failed: reason must be >= 20 characters
├─ Process images & report:
│  └─ Upload inspection photos
│  └─ Upload report PDF
├─ Update inspection:
│  ├─ status: "in_progress" → "completed"
│  ├─ overallCondition, frameCondition, etc.
│  ├─ inspectionImages: [url1, url2, ...]
│  ├─ reportFile: url
│  ├─ recommendation: "Approve for sale"
│  ├─ completedAt: now
│  └─ durationMinutes: now - startedAt
├─ IF status == "approved":
│  ├─ Update bike.isVerified = "verified"   ← Ready for admin!
│  └─ Trigger admin notification
├─ IF status == "failed":
│  ├─ Update bike.isVerified = "rejected"
│  ├─ bike.rejectionReason = reason
│  └─ Notify seller to resubmit
└─ Return inspection result

Database Changes:
inspections table (UPDATE):
  ├─ status: "in_progress" → "completed"
  ├─ overall_condition: "excellent"
  ├─ frame_condition: "good"
  ├─ brake_condition: "excellent"
  ├─ ...
  ├─ inspection_images: ["url1", "url2"]
  ├─ report_file: "report_url"
  ├─ completed_at: now
  └─ duration_minutes: 45

bikes table (UPDATE if approved):
  └─ is_verified: "verified"  ← Green light!

bikes table (UPDATE if rejected):
  ├─ is_verified: "rejected"
  └─ rejection_reason: "Frame bent, needs repair"
```

### Step 5: Inspector Views Inspection History
```
API: GET /api/inspector/v1/inspections
File: src/controllers/inspectorController.ts → getMyInspections()

Code Flow:
├─ Get inspectorId from JWT
├─ Query inspections:
│  └─ WHERE inspector_id = inspectorId
├─ Join with bikes for bike details
├─ Sort by completedAt DESC
└─ Return inspection list

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "insp-1",
      "bike": { "id": "bike-1", "title": "Trek FX3", "price": 35000000 },
      "status": "completed",
      "overallCondition": "excellent",
      "completedAt": "2026-04-08T14:00:00Z",
      "durationMinutes": 45
    },
    ...
  ]
}
```

### Step 6: Inspector Views Single Inspection Detail
```
API: GET /api/inspector/v1/inspections/:id
File: src/controllers/inspectorController.ts → getInspectionDetail()

Code Flow:
├─ Find inspection by ID
├─ Join with bike, seller, images
├─ Return complete inspection + images

Response Example:
{
  "success": true,
  "data": {
    "id": "insp-1",
    "bike": { ... full bike data ... },
    "status": "completed",
    "overallCondition": "excellent",
    "frameCondition": "good",
    "brakeCondition": "excellent",
    "wheelCondition": "excellent",
    "drivetrainCondition": "good",
    "inspectionNote": "Bike in very good condition...",
    "inspectionImages": ["url1", "url2", "url3"],
    "reportFile": "report_url.pdf",
    "completedAt": "2026-04-08T14:00:00Z"
  }
}
```

---

## 11. FULFILLMENT & DELIVERY FLOW

### Overview
After payment, seller ships bike, buyer receives and confirms, transaction completes

### Step 1: Seller Marks Bike as Preparing
```
API: PATCH /api/fulfillment/v1/transactions/:id/delivery
File: src/controllers/fulfillmentController.ts → updateDeliveryStatus()

Body: { "status": "preparing", "deliveryNotes": "Preparing bike for shipment" }

Code Flow:
├─ Get sellerId from JWT
├─ Find transaction (where sellerId matches & txnId matches)
├─ Validate:
│  ├─ Transaction status == "completed"
│  ├─ Bike status == "sold"
│  └─ Delivery not started yet (status != "delivering", etc.)
├─ Create delivery if not exists:
│  └─ delivery_id: uuid
│  └─ status: "preparing"
├─ OR update existing delivery:
│  └─ status: "preparing" → "delivering"
├─ Update transaction:
│  └─ delivery_id: linked delivery ID
├─ Update fulfillment:
│  └─ status: "preparing"
└─ Return delivery details

Database Changes:
deliveries table (INSERT or UPDATE):
  ├─ id: uuid
  ├─ transaction_id: txn-1
  ├─ status: "preparing"    ← Seller packing bike
  ├─ delivery_notes: "..."
  ├─ started_at: now
  └─ created_at: now

transactions table (UPDATE):
  └─ delivery_id: delivery-1
```

### Step 2: Seller Ships Bike
```
API: PATCH /api/fulfillment/v1/transactions/:id/delivery
Body: { "status": "delivering", "trackingNumber": "VNPOST123456" }

Code Flow:
├─ Get sellerId from JWT
├─ Find transaction
├─ Validate delivery exists & status="preparing"
├─ Update delivery:
│  ├─ status: "preparing" → "delivering"
│  ├─ tracking_number: "VNPOST123456"
│  ├─ shipped_at: now
│  └─ estimate_delivery: now + 5 days
├─ Send notification:
│  └─ Notify buyer: "Bike shipped! Tracking: VNPOST123456"
└─ Return updated delivery

Database Changes:
deliveries table (UPDATE):
  ├─ status: "delivering"
  ├─ tracking_number: "VNPOST123456"
  └─ shipped_at: timestamp
```

### Step 3: Buyer Receives Bike & Confirms Receipt
```
API: PATCH /api/fulfillment/v1/transactions/:id/confirm-receipt
File: src/controllers/fulfillmentController.ts → confirmReceipt()

Body: { "condition": "as_described" } (optional)

Code Flow:
├─ Get buyerId from JWT
├─ Find transaction (where buyerId matches & txnId matches)
├─ Validate:
│  ├─ Transaction status == "completed"
│  ├─ Delivery status == "delivering"
│  └─ Delivery not already confirmed
├─ Update delivery:
│  ├─ status: "delivering" → "delivered"
│  ├─ receipt_confirmed_at: now
│  └─ buyer_condition_report: (if provided)
├─ Trigger payout eligibility:
│  └─ Seller can now request payout!
├─ Send notification:
│  └─ Notify seller: "Buyer confirmed receipt! Ready for payout"
└─ Return updated delivery

Database Changes:
deliveries table (UPDATE):
  ├─ status: "delivered"
  ├─ receipt_confirmed_at: now
  └─ completed_at: now
```

### Step 4: Get Fulfillment Details
```
API: GET /api/fulfillment/v1/transactions/:id
File: src/controllers/fulfillmentController.ts → getFulfillmentDetail()

Code Flow:
├─ Get userId from JWT (buyer or seller)
├─ Find transaction
├─ Fetch delivery + fulfillment status
├─ Return complete fulfillment timeline

Response Example:
{
  "success": true,
  "data": {
    "transaction": { "id": "txn-1", "status": "completed" },
    "delivery": {
      "id": "del-1",
      "status": "delivered",
      "trackingNumber": "VNPOST123456",
      "startedAt": "2026-04-08T10:00:00Z",
      "shippedAt": "2026-04-08T11:00:00Z",
      "estimateDelivery": "2026-04-13T23:59:00Z",
      "receiptConfirmedAt": "2026-04-12T15:30:00Z"
    },
    "fulfillment": {
      "status": "completed",
      "timeline": [
        { "status": "completed", "timestamp": "2026-04-08T10:00:00Z", "message": "Payment processed" },
        { "status": "preparing", "timestamp": "2026-04-08T10:30:00Z", "message": "Seller preparing" },
        { "status": "delivering", "timestamp": "2026-04-08T11:00:00Z", "message": "Shipped" },
        { "status": "delivered", "timestamp": "2026-04-12T15:30:00Z", "message": "Received" }
      ]
    }
  }
}
```

---

## 12. MESSAGE & CHAT FLOW

### Overview
Buyers and sellers communicate about bikes, negotiations happen in chat

### Step 1: Get All Conversations
```
API: GET /api/messages/conversations
File: src/controllers/messageController.ts → getAllConversations()

Code Flow:
├─ Get userId from JWT
├─ Query conversation threads:
│  └─ WHERE participant1_id = userId OR participant2_id = userId
├─ For each thread:
│  ├─ Fetch other participant details
│  ├─ Fetch bike info (if related to bike listing)
│  ├─ Fetch last message + timestamp
│  ├─ Count unread messages
│  └─ Calculate unread count
├─ Sort by updatedAt DESC (most recent first)
└─ Return conversation list

Response Example:
{
  "success": true,
  "data": [
    {
      "threadId": "thread-1",
      "bike": { "id": "bike-1", "title": "Trek FX3", "images": ["url1"] },
      "otherParticipant": {
        "id": "seller-1",
        "name": "John's Bike Shop",
        "avatar": "url"
      },
      "lastMessage": "Is this bike still available?",
      "lastMessageTime": "2026-04-08T14:30:00Z",
      "unreadCount": 2      ← User has 2 unread messages
    },
    ...
  ]
}

Database Query:
SELECT ct.*, COUNT(m.id) as unread_count FROM conversation_threads ct
LEFT JOIN messages m ON ct.id = m.thread_id AND m.read = false AND m.recipient_id = ?
WHERE ct.participant1_id = ? OR ct.participant2_id = ?
GROUP BY ct.id
ORDER BY ct.updated_at DESC
```

### Step 2: Get Conversation Details + Messages
```
API: GET /api/messages/conversations/:threadId?page=1&limit=20
File: src/controllers/messageController.ts → getConversationDetails()

Code Flow:
├─ Get userId from JWT
├─ Find thread (user must be participant)
├─ Validate user is participant1 or participant2
├─ Fetch messages:
│  ├─ Paginate (newest last, page = 1 gets oldest)
│  ├─ Load sender details for each message
│  ├─ Get file attachments if any
│  └─ Sort by createdAt ASC
├─ Mark messages as read:
│  └─ UPDATE messages SET read=true WHERE threadId=? AND recipient_id=? AND read=false
├─ Return thread + messages

Response Example:
{
  "success": true,
  "data": {
    "thread": {
      "id": "thread-1",
      "bike": { "id": "bike-1", "title": "Trek FX3", "price": 35000000 },
      "participant1": { "id": "buyer-1", "name": "Alice" },
      "participant2": { "id": "seller-1", "name": "John" },
      "status": "open"
    },
    "messages": [
      {
        "id": "msg-1",
        "sender": { "id": "buyer-1", "name": "Alice" },
        "text": "Is this bike still available?",
        "createdAt": "2026-04-08T10:00:00Z",
        "read": true,
        "file": null
      },
      {
        "id": "msg-2",
        "sender": { "id": "seller-1", "name": "John" },
        "text": "Yes! Great condition, comes with helmet",
        "createdAt": "2026-04-08T10:15:00Z",
        "read": true,
        "file": null
      },
      ...
    ],
    "pagination": { "page": 1, "limit": 20, "hasMore": false }
  }
}
```

### Step 3: Send Message
```
API: POST /api/messages/send
File: src/controllers/messageController.ts → sendMessage()

Body (Form-Data):
├─ threadId: "thread-1"
├─ text: "What's the best price you can go?"
└─ file?: (optional) image or document file

Code Flow:
├─ Get userId from JWT
├─ Find/create conversation thread:
│  ├─ IF threadId provided: Use existing thread
│  ├─ ELSE: Create new thread with participant1=userId, participant2=recipientId
├─ Validate user is thread participant
├─ Process message:
│  ├─ IF text: Create text message
│  ├─ IF file: Upload file + create message with attachment
│  └─ Validate message not empty
├─ Create message record:
│  ├─ message_id: uuid
│  ├─ thread_id: thread-1
│  ├─ sender_id: buyer-1
│  ├─ recipient_id: seller-1
│  ├─ text: message text
│  ├─ file_url: (if file)
│  ├─ read: false
│  └─ created_at: now
├─ Update thread:
│  └─ updated_at: now
├─ Emit WebSocket event:
│  └─ io.to(threadId).emit("new_message", {...})
│     (Real-time notification if recipientconnected)
└─ Send email/SMS notification:
   └─ Notify recipient of new message

Database Changes:
messages table (INSERT):
  ├─ id: uuid
  ├─ thread_id: thread-1
  ├─ sender_id: buyer-1
  ├─ recipient_id: seller-1
  ├─ text: "What's the best price?"
  ├─ file_url: null
  ├─ read: false
  └─ created_at: now

conversation_threads table (UPDATE):
  └─ updated_at: now
```

### Step 4: Close Conversation
```
API: POST /api/messages/conversations/:threadId/close
File: src/controllers/messageController.ts → closeConversation()

Code Flow:
├─ Get userId from JWT
├─ Find thread (user must be participant)
├─ Update thread:
│  ├─ status: "open" → "closed"
│  └─ closed_by: userId
│  └─ closed_at: now
├─ Archive conversation (hide from list but keep history)
└─ Return closed thread

Database Changes:
conversation_threads table (UPDATE):
  ├─ status: "closed"
  ├─ closed_by: buyer-1
  └─ closed_at: now
```

---

## 13. REPORT FLOW

### Overview
Buyers report problematic sellers, fraudulent bikes, or violations

### Step 1: Get Report Reasons
```
API: GET /api/buyer/v1/report-reasons
File: src/controllers/buyerController.ts → getReportReasons()

Code Flow:
├─ Public endpoint (no JWT required)
├─ Query all report reasons
├─ Return reasons list

Response Example:
{
  "success": true,
  "data": [
    { "id": "reason-1", "title": "Fraud", "description": "Seller may be fraudulent" },
    { "id": "reason-2", "title": "Fake photos", "description": "Photos don't match bike" },
    { "id": "reason-3", "title": "Banned seller", "description": "Seller is banned/suspended" },
    ...
  ]
}
```

### Step 2: Get Seller's Bikes (for reporting)
```
API: GET /api/buyer/v1/sellers/:sellerId/bikes
File: src/controllers/buyerController.ts → getSellerBikesForReport()

Code Flow:
├─ Get sellerId from URL
├─ Fetch all seller's for_sale bikes
├─ Return bikes list

Use Case:
├─ Buyer wants to report bike or seller
├─ Get list of bikes from affected seller
├─ Select which bike(s) triggered the issue
```

### Step 3: Submit Report
```
API: POST /api/buyer/v1/reports
File: src/controllers/buyerController.ts → submitReport()

Body:
├─ reportType: "seller" | "bike"
├─ targetId: sellerId || bikeId
├─ reasonId: reason-1
├─ description: string (detailed explanation, min 20 chars)
├─ evidence?: Array of URLs (image links, screenshots)
└─ attachments?: File uploads (images, documents)

Code Flow:
├─ Get buyerId from JWT
├─ Validate inputs:
│  ├─ reportType is valid
│  ├─ targetId exists (seller or bike)
│  ├─ reasonId exists
│  ├─ description >= 20 characters
│  └─ At least 1 attachment or evidence
├─ Process attachments:
│  └─ Upload files, get URLs
├─ Create report record:
│  ├─ report_id: uuid
│  ├─ reporter_id: buyer-1 (reporter)
│  ├─ target_id: seller-1 || bike-1
│  ├─ report_type: "seller"
│  ├─ reason_id: reason-1
│  ├─ description: "Seller sent counterfeit..."
│  ├─ evidence: [url1, url2]
│  ├─ attachments: [url1, url2]
│  ├─ status: "pending"        ← Awaiting admin review
│  └─ created_at: now
├─ Send notification:
│  └─ Alert admins: "New report submitted"
└─ Return report ID

Database Changes:
reports table (INSERT):
  ├─ id: uuid
  ├─ reporter_id: buyer-1
  ├─ target_id: seller-1
  ├─ report_type: "seller"
  ├─ reason_id: reason-1
  ├─ description: "Details..."
  ├─ evidence: [...]
  ├─ attachments: [...]
  ├─ status: "pending"   ← Needs review
  └─ created_at: now
```

### Step 4: Buyer Views Own Reports
```
API: GET /api/buyer/v1/reports
File: src/controllers/buyerController.ts → getMyReports()

Code Flow:
├─ Get buyerId from JWT
├─ Query reports where reporter_id = buyerId
├─ Include report details + reason name
├─ Sort by createdAt DESC
└─ Return report list

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "report-1",
      "targetId": "seller-1",
      "targetType": "seller",
      "reason": "Fraud",
      "status": "pending",      ← Still under review
      "createdAt": "2026-04-08T10:00:00Z"
    },
    {
      "id": "report-2",
      "targetId": "bike-1",
      "targetType": "bike",
      "reason": "Fake photos",
      "status": "resolved",     ← Admin took action
      "createdAt": "2026-04-07T15:00:00Z"
    }
  ]
}
```

### Step 5: Admin Resolves Report
```
API: PUT /api/admin/v1/reports/:id/resolve
File: src/controllers/adminController.ts → resolveReport()

Body:
├─ action: "dismiss" | "warn_seller" | "suspend_seller" | "delete_listing"
├─ adminNotes: string (why this action was taken)
└─ evidence: string (what evidence was reviewed)

Code Flow:
├─ Get adminId from JWT (must be admin role)
├─ Find report
├─ Validate action is valid
├─ Update report:
│  ├─ status: "pending" → "resolved"
│  ├─ admin_notes: "Verified fraud..."
│  ├─ action_taken: "suspend_seller"
│  ├─ resolved_by: admin-1
│  └─ resolved_at: now
├─ Take action based on ~action~:
│  ├─ IF "suspend_seller":
│  │  └─ Update seller account: blocked=true
│  ├─ IF "delete_listing":
│  │  └─ Delete bike from marketplace
│  ├─ IF "warn_seller":
│  │  └─ Send warning email to seller
│  └─ IF "dismiss":
│     └─ Close report
├─ Notify reporter:
│  └─ "Your report has been processed"
└─ Return updated report

Database Changes:
reports table (UPDATE):
  ├─ status: "resolved"
  ├─ admin_notes: "..."
  ├─ action_taken: "suspend_seller"
  ├─ resolved_by: admin-1
  └─ resolved_at: now

users table (UPDATE if suspend):
  └─ is_blocked: true
```

---

## 14. REVIEW FLOW

### Overview
After delivery, buyer can review seller and bike quality

### Step 1: Buyer Adds Review
```
API: POST /api/buyer/v1/reviews
File: src/controllers/buyerController.ts → addReview()

Body:
├─ transactionId: "txn-1"
├─ rating: number (1-5 stars)
├─ title: string (short review title)
├─ comment: string (detailed review, min 10 chars)
├─ photos?: Array of file URLs or uploads
└─ verifiedPurchase: boolean (auto-set by system)

Code Flow:
├─ Get buyerId from JWT
├─ Find transaction:
│  ├─ Must belong to buyer
│  ├─ Must be completed
│  ├─ Must be delivered (receiptConfirmedAt set)
│  └─ No duplicate review yet
├─ Validate review:
│  ├─ Rating between 1-5
│  ├─ Title not empty
│  ├─ Comment >= 10 chars
│  └─ At least min 1 character comment
├─ Process review photos:
│  └─ Upload files if provided
├─ Create review record:
│  ├─ review_id: uuid
│  ├─ transaction_id: txn-1
│  ├─ buyer_id: buyer-1
│  ├─ seller_id: seller-1
│  ├─ bike_id: bike-1
│  ├─ rating: 5 (out of 5)
│  ├─ title: "Excellent bike!"
│  ├─ comment: "Great condition, fast shipping..."
│  ├─ photos: [url1, url2]
│  ├─ verified_purchase: true  ← Buyer actually purchased
│  └─ created_at: now
├─ Update seller metrics:
│  └─ seller.avgRating = recalculate from all reviews
│  └─ seller.reviewCount++
├─ Send notification:
│  └─ Notify seller of new review
└─ Return created review

Database Changes:
reviews table (INSERT):
  ├─ id: uuid
  ├─ transaction_id: txn-1
  ├─ buyer_id: buyer-1
  ├─ seller_id: seller-1
  ├─ bike_id: bike-1
  ├─ rating: 5
  ├─ title: "Excellent bike!"
  ├─ comment: "Great condition..."
  ├─ photos: [url1, url2]
  ├─ verified_purchase: true
  └─ created_at: now

users table (UPDATE):
  ├─ avg_rating: (recalculated average)
  └─ review_count: review_count + 1
```

### Step 2: Seller Views Reviews
```
API: GET /api/seller/v1/reviews
File: src/controllers/sellerController.ts → getMyReviews()

Code Flow:
├─ Get sellerId from JWT
├─ Query reviews where seller_id = sellerId
├─ Sort by createdAt DESC (newest first)
├─ Include buyer info + transaction details
├─ Calculate statistics:
│  ├─ Avg rating
│  ├─ Rating distribution (1-5 stars count)
│  ├─ Total reviews
│  └─ Verified purchases count
└─ Return reviews + stats

Response Example:
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-1",
        "buyer": { "name": "Alice", "avatar": "url" },
        "rating": 5,
        "title": "Excellent!",
        "comment": "Great bike, fast shipping",
        "photos": ["url1", "url2"],
        "verifiedPurchase": true,
        "createdAt": "2026-04-08T10:00:00Z"
      },
      ...
    ],
    "statistics": {
      "avgRating": 4.8,
      "totalReviews": 45,
      "distribution": { "5": 35, "4": 8, "3": 2, "2": 0, "1": 0 },
      "verifiedPurchases": 43
    }
  }
}
```

---

## 15. ADMIN DASHBOARD FLOW

### Overview
Admins manage platform: approve bikes, manage users, handle reports, manage content

### Step 1: Admin Gets All Bikes
```
API: GET /api/admin/v1/bikes
File: src/controllers/adminController.ts → getAllBikes()

Code Flow:
├─ Get adminId from JWT (verify admin role)
├─ Query all bikes:
│  ├─ Include seller details
│  ├─ Include category
│  ├─ Sort by createdAt DESC
│  └─ No status filtering (show all, including pending/rejected)
├─ Return bikes list with status

Response includes status like:
├─ pending (awaiting inspector)
├─ rejected (inspector rejected)
├─ verified (passed inspection, awaiting admin approval)
├─ for_sale (approved & live)
├─ sold (transaction completed)
└─ reserved (buyer placed deposit)
```

### Step 2: Admin Gets Pending Approval Bikes
```
API: GET /api/admin/v1/bikes/pending-approval
File: src/controllers/adminController.ts → getPendingApprovalBikes()

Code Flow:
├─ Query bikes where:
│  ├─ status = "pending" OR "verified"
│  ├─ isVerified = "verified" (passed inspector check)
│  └─ NOT yet approved by admin
├─ Load inspection report details
├─ Include seller + category info
└─ Return pending bikes list

Response Example:
{
  "success": true,
  "data": [
    {
      "id": "bike-1",
      "title": "Trek FX3",
      "seller": { "name": "John's Shop", "email": "..." },
      "inspection": {
        "overallCondition": "excellent",
        "approvedStatus": "approved"
      },
      "status": "pending",  ← Waiting for admin approval
      "inspectionCompletedAt": "2026-04-07T10:00:00Z"
    },
    ...
  ]
}
```

### Step 3: Admin Approves Bike
```
API: PUT /api/admin/v1/bike/:id/approve
File: src/controllers/adminController.ts → approveBike()

Code Flow:
├─ Get adminId from JWT
├─ Find bike
├─ Validate:
│  ├─ Bike exists
│  ├─ Bike.isVerified == "verified" (passed inspector)
│  └─ Bike.status not already approved
├─ Update bike:
│  ├─ status: "pending" → "for_sale"   ← NOW LIVE!
│  ├─ approved_at: now
│  ├─ approved_by: admin-1
│  └─ approved_notes: (optional)
├─ Trigger bike visibility:
│  └─ Bike now appears in search results
├─ Send notification:
│  └─ Notify seller: "Bike approved! Now live"
└─ Return approved bike

Database Changes:
bikes table (UPDATE):
  ├─ status: "for_sale"
  ├─ approved_at: timestamp
  ├─ approved_by: admin-1
  └─ is_visible: true
```

### Step 4: Admin Rejects Bike
```
API: PUT /api/admin/v1/bike/:id/reject
File: src/controllers/adminController.ts → rejectBike()

Body:
├─ reason: string (why bike is rejected)
└─ adminNotes: string (additional notes)

Code Flow:
├─ Get adminId from JWT
├─ Find bike
├─ Validate bike not already approved
├─ Update bike:
│  ├─ status: "pending" → "rejected"
│  ├─ rejection_reason: reason
│  ├─ rejected_at: now
│  ├─ rejected_by: admin-1
│  └─ admin_notes: notes
├─ Send notification:
│  └─ Notify seller: "Bike rejected. Reason: {{reason}}"
│  └─ Seller can resubmit after fixing issues
└─ Return rejected bike

Database Changes:
bikes table (UPDATE):
  ├─ status: "rejected"
  ├─ rejection_reason: "..."
  ├─ rejected_at: timestamp
  └─ rejected_by: admin-1
```

### Step 5: Admin Manages Users
```
API: GET /api/admin/v1/users
File: src/controllers/adminController.ts → getAllUser()

Code Flow:
├─ Query all users
├─ Include role, status, createdAt
├─ Can apply filters:
│  ├─ role: buyer|seller
│  ├─ status: active|blocked
│  └─ email search

API: PUT /api/admin/v1/users/:id
File: src/controllers/adminController.ts → updateUser()

Updates allowed:
├─ is_verified: boolean (email verified)
├─ is_blocked: boolean (account suspended)
├─ profile data: name, phone, avatar
└─ notes: admin notes about user

API: DELETE /api/admin/v1/users/:id
File: src/controllers/adminController.ts → deleteUser()

Code Flow:
├─ Delete user account
├─ Cascade delete related data (optional):
│  ├─ Seller bikes → set seller_id to NULL
│  ├─ Transactions → mark as abandoned
│  └─ Messages → archive
└─ Return 200 deleted
```

### Step 6: Admin Manages Reports
```
API: GET /api/admin/v1/reports
File: src/controllers/adminController.ts → getAllReports()

Code Flow:
├─ Query all reports
├─ Filter by:
│  ├─ status: pending|resolved
│  ├─ report_type: seller|bike
│  └─ createdAt range
├─ Sort by createdAt DESC (newest first)
└─ Return reports list

(See Section 13 for resolveReport)
```

### Step 7: Admin Manages Categories
```
API: GET /api/admin/v1/categories
File: src/controllers/adminController.ts → getAllCategory()

API: POST /api/admin/v1/categories
File: src/controllers/adminController.ts → createCategory()

Body:
├─ name: string (e.g., "Mountain Bike")
├─ slug: string (e.g., "mountain-bike")
├─ description: string
└─ icon: file (image upload)

API: PUT /api/admin/v1/categories/:id
File: src/controllers/adminController.ts → updateCategory()

API: DELETE /api/admin/v1/categories/:id
File: src/controllers/adminController.ts → deleteCategory()

Notes:
├─ Slug must be unique, lowercase, hyphen-separated
├─ Used for bike categorization
└─ Can't delete if bikes still in category
```

### Step 8: Admin Manages Report Reasons
```
API: GET /api/admin/v1/report-reasons
File: src/controllers/adminController.ts → getAllReportReasons()

API: POST /api/admin/v1/report-reasons
File: src/controllers/adminController.ts → createReportReason()

Body:
├─ title: string
├─ description: string
└─ severity: low|medium|high

API: PUT /api/admin/v1/report-reasons/:id
File: src/controllers/adminController.ts → updateReportReason()

API: DELETE /api/admin/v1/report-reasons/:id
File: src/controllers/adminController.ts → deleteReportReason()

Use Case:
├─ "Fraud", "Fake photos", "Banned seller"
├─ Buyers select reasons when filing reports
└─ Helps categorize issues
```

---

## 16. KEY DATABASE TABLES

### transactions
```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  bike_id uuid FOREIGN KEY,
  buyer_id uuid FOREIGN KEY,
  seller_id uuid FOREIGN KEY,
  amount DECIMAL(10,2),              -- Amount paid by buyer
  system_fee DECIMAL(10,2),          -- 5% fee (0 for deposits)
  seller_net_amount DECIMAL(10,2),   -- What seller actually gets
  original_bike_price DECIMAL(10,2), -- For remaining payment calc
  
  transaction_type VARCHAR(50),      -- 'full_payment', 'deposit', 'remaining_payment'
  status VARCHAR(50),                -- 'pending', 'completed', 'cancelled', 'refunded'
  payment_method VARCHAR(50),        -- 'vnpay', 'card', etc.
  
  remaining_balance DECIMAL(10,2),   -- For deposit txns (balance due)
  linked_transaction_id uuid,        -- For remaining_payment (links to deposit)
  
  delivery_id uuid FOREIGN KEY,      -- Links to delivery
  buyer_phone VARCHAR(20),
  buyer_email VARCHAR(255),
  notes TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### refunds
```sql
CREATE TABLE refunds (
  id uuid PRIMARY KEY,
  transaction_id uuid FOREIGN KEY,
  buyer_id uuid FOREIGN KEY,
  seller_id uuid FOREIGN KEY,
  
  amount DECIMAL(10,2),              -- Refund amount (full)
  reason VARCHAR(500),               -- Why user requested refund
  status VARCHAR(50),                -- 'pending', 'completed', 'rejected'
  
  rejected_reason TEXT,              -- If rejected
  processed_at TIMESTAMP,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### payouts
```sql
CREATE TABLE payouts (
  id uuid PRIMARY KEY,
  transaction_id uuid FOREIGN KEY,
  seller_id uuid FOREIGN KEY,
  
  amount DECIMAL(10,2),              -- Payout amount (net after fees)
  bank_account_number VARCHAR(50),
  bank_account_holder VARCHAR(255),
  bank_code VARCHAR(10),
  bank_branch VARCHAR(100),
  
  status VARCHAR(50),                -- 'pending', 'completed', 'failed'
  payout_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  external_payout_id VARCHAR(100),   -- Provider reference
  provider_transaction_id VARCHAR(100),
  failure_reason TEXT,
  
  webhook_received_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### bikes
```sql
CREATE TABLE bikes (
  id uuid PRIMARY KEY,
  title VARCHAR(255),
  brand VARCHAR(100),
  model VARCHAR(100),
  price DECIMAL(10,2),
  
  seller_id uuid FOREIGN KEY,
  status VARCHAR(50),                -- 'for_sale', 'reserved', 'sold'
  is_verified BOOLEAN,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 17. API ENDPOINTS REFERENCE

### Payment APIs
```
POST   /api/payment/v1/create/:transactionId
       → Create payment URL for transaction

GET    /api/payment/v1/status/:transactionId
       → Get payment status

GET    /api/payment/v1/vnpay-return?vnp_ResponseCode=...
       → VNPay return URL (buyer redirected after payment)

GET    /api/payment/v1/vnpay-ipn?vnp_TxnRef=...&...
       → VNPay webhook (server-to-server callback)
```

### Remaining Payment APIs
```
POST   /api/payment/v1/create-remaining/:depositTransactionId
       → Create payment URL for remaining balance after deposit
```

### Refund APIs
```
POST   /api/payment/v1/refund/:transactionId
       → Request refund for transaction
       Body: { "reason": "..." }

GET    /api/payment/v1/refund/:refundId/status
       → Check refund status

GET    /api/payment/v1/refunds
       → List all refunds for buyer

POST   /api/payment/v1/refund-callback
       → Webhook callback from refund provider
```

### Payout APIs
```
POST   /api/payment/v1/payout/:transactionId
       → Request payout (seller)

GET    /api/payment/v1/payout/:payoutId/status
       → Check payout status

POST   /api/payment/v1/payout-callback
       → Webhook callback from payout provider
```

### Transaction APIs
```
POST   /api/buyer/v1/transactions
       → Create transaction (buyer initiates purchase)
       Body: { "bikeId": "...", "amount": ..., "transactionType": "full_payment"|"deposit" }

GET    /api/transactions
       → List transactions

GET    /api/transactions/:transactionId
       → Get transaction details
```

### Authentication APIs
```
POST   /api/auth/check-roles
       → Check available roles for email
       Body: { "email": "...", "password": "..." }

POST   /api/auth/register
       → Register new account
       Body: { "email": "...", "password": "...", "name": "...", "phone": "...", "role": "buyer"|"seller" }

POST   /api/auth/login
       → Login and get JWT token
       Body: { "email": "...", "password": "...", "role": "buyer"|"seller" }

POST   /api/auth/logout
       → Logout (frontend: delete token from localStorage)
```

### Seller APIs
```
POST   /api/profile/upgrade-to-seller
       → Upgrade buyer account to seller

POST   /api/seller/v1/bikes
       → Create new bike listing (multipart form-data)

GET    /api/seller/v1/bikes
       → Get seller's bikes

PUT    /api/seller/v1/bikes/:id
       → Update bike listing

DELETE /api/seller/v1/bikes/:id
       → Delete bike listing

PATCH  /api/seller/v1/bikes/:id/visibility
       → Toggle bike visibility (hide/show)

POST   /api/seller/v1/bikes/:id/resubmit
       → Resubmit rejected bike

GET    /api/seller/v1/transactions
       → Get seller's sales transactions

GET    /api/seller/v1/reviews
       → Get seller's reviews & ratings

GET    /api/seller/v1/dashboard
       → Get seller dashboard (stats, pending items)
```

### Buyer APIs
```
POST   /api/profile/downgrade-from-seller
       → Downgrade seller role back to buyer only

GET    /api/buyer/v1/categories
       → Get all bike categories

GET    /api/buyer/v1/bikes/search
       → Search bikes with filters

GET    /api/buyer/v1/bikes/:id
       → Get bike detail

GET    /api/buyer/v1/bikes/recommended
       → Get AI-recommended bikes

GET    /api/buyer/v1/transactions
       → Get buyer's purchases

POST   /api/buyer/v1/transactions
       → Create new transaction (purchase or deposit)

DELETE /api/buyer/v1/transactions/:id
       → Cancel pending transaction

GET    /api/buyer/v1/wishlist
       → Get buyer's wishlist

POST   /api/buyer/v1/wishlist/:bikeId
       → Add bike to wishlist

DELETE /api/buyer/v1/wishlist/:bikeId
       → Remove bike from wishlist

POST   /api/buyer/v1/reviews
       → Add review for completed purchase

GET    /api/buyer/v1/report-reasons
       → Get available report reasons

POST   /api/buyer/v1/reports
       → Submit report (seller or bike)

GET    /api/buyer/v1/reports
       → Get buyer's submitted reports
```

### Inspector APIs
```
GET    /api/inspector/v1/dashboard
       → Get inspector dashboard

GET    /api/inspector/v1/bikes/pending
       → Get bikes pending inspection

GET    /api/inspector/v1/bikes/:id
       → Get bike detail for inspection

POST   /api/inspector/v1/bikes/:id/start-inspection
       → Start inspection of bike

POST   /api/inspector/v1/bikes/:id/submit-inspection
       → Submit inspection report (multipart form-data)

GET    /api/inspector/v1/inspections
       → Get inspector's inspection history

GET    /api/inspector/v1/inspections/:id
       → Get single inspection detail

PUT    /api/inspector/v1/inspections/:id
       → Update inspection (change status, add notes)
```

### Fulfillment APIs
```
PATCH  /api/fulfillment/v1/transactions/:id/delivery
       → Update delivery status (preparing → delivering)
       Body: { "status": "preparing|delivering", "deliveryNotes": "...", "trackingNumber": "..." }

PATCH  /api/fulfillment/v1/transactions/:id/confirm-receipt
       → Buyer confirms receipt (changes status to delivered)

GET    /api/fulfillment/v1/transactions/:id
       → Get fulfillment details & timeline
```

### Message APIs
```
GET    /api/messages/conversations
       → Get all conversations for user

GET    /api/messages/conversations/:threadId
       → Get messages in conversation (with pagination)

POST   /api/messages/send
       → Send new message (multipart form-data for file attach)
       Body: { "threadId": "...", "text": "...", "file": (optional) }

POST   /api/messages/conversations/:threadId/close
       → Close conversation thread

GET    /api/messages/system-messages
       → Get system-wide messages/announcements
```

### Admin APIs
```
GET    /api/admin/v1/bikes
       → Get all bikes (all statuses)

GET    /api/admin/v1/bikes/pending-approval
       → Get bikes pending admin approval

PUT    /api/admin/v1/bike/:id/approve
       → Approve bike for public listing

PUT    /api/admin/v1/bike/:id/reject
       → Reject bike with reason

DELETE /api/admin/v1/bikes/:id
       → Delete bike from system

GET    /api/admin/v1/users
       → Get all users

PUT    /api/admin/v1/users/:id
       → Update user (verify, block, etc.)

DELETE /api/admin/v1/users/:id
       → Delete user account

GET    /api/admin/v1/transactions
       → Get all transactions

PUT    /api/admin/v1/transactions/:id
       → Update transaction (refund, resolve issues)

GET    /api/admin/v1/reports
       → Get all reports

PUT    /api/admin/v1/reports/:id/resolve
       → Resolve report (take action)

GET    /api/admin/v1/categories
       → Get all categories

POST   /api/admin/v1/categories
       → Create category

PUT    /api/admin/v1/categories/:id
       → Update category

DELETE /api/admin/v1/categories/:id
       → Delete category

GET    /api/admin/v1/report-reasons
       → Get all report reasons

POST   /api/admin/v1/report-reasons
       → Create report reason

PUT    /api/admin/v1/report-reasons/:id
       → Update report reason

DELETE /api/admin/v1/report-reasons/:id
       → Delete report reason
```

---

## Summary Flowchart

```
Buyer journeys:
├─ Full Payment:
│  ├─ Create transaction (full_payment)
│  ├─ VNPay payment
│  ├─ IPN updates DB
│  └─ Can request refund within timeframe
│
├─ Deposit Purchase:
│  ├─ Create transaction (deposit, 10-30%)
│  ├─ VNPay payment
│  ├─ IPN: bike reserved
│  ├─ Create remaining transaction
│  ├─ VNPay payment
│  ├─ IPN: bike sold, payouts created
│  └─ Can request refund
│
└─ Refund:
   ├─ Request refund → status=pending
   ├─ Wait for webhook (5s mock / 3-5 days real)
   ├─ Webhook updates status=completed
   ├─ Bike back to for_sale
   └─ Seller loses commission

Seller journeys:
├─ Receive payment:
│  ├─ Transaction completed
│  ├─ Delivery confirmed
│  └─ Ready to request payout
│
└─ Request payout:
   ├─ Payout created (status=pending)
   ├─ Wait for webhook
   ├─ Webhook confirms (status=completed)
   └─ Money transferred to bank account
```

---

## 18. CODE INTEGRATION & FUNCTION INTERACTION

### Overview
How functions, services, middleware, routes, and database interact together in the system

---

### PATTERN 1: Full Payment Flow (Code Integration)

**Route Registration** (`src/routes/paymentRoutes.ts`)
```typescript
// Step 1: Route is registered with middleware chain
router.post('/create/:transactionId', extractJWT, createPaymentUrl);
router.get('/vnpay-ipn', vnpayIPN);  // No extractJWT (VNPay calls directly)
router.post('/status/:transactionId', extractJWT, getPaymentStatus);
```

**Request Comes In** → Browser makes `POST /api/payment/v1/create/txn-123`

**Middleware Chain Executes** (`src/middleware/extractJWT.ts`)
```typescript
// extractJWT middleware runs FIRST
export const extractJWT = (req: Request, res: Response, next: NextFunction) => {
  // 1. Get Authorization header
  const authHeader = req.headers.authorization;
  
  // 2. Extract token from "Bearer <token>"
  const token = authHeader?.split(' ')[1];
  
  // 3. Verify token signature & extract payload
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  
  // 4. Attach to req.user (accessible to controller)
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role
  };
  
  // 5. Move to next middleware/controller
  next();
};

// Result: req.user now contains { userId, email, role }
```

**Controller Executes** (`src/controllers/paymentController.ts` → `createPaymentUrl()`)
```typescript
export const createPaymentUrl = async (req: Request, res: Response) => {
  try {
    // Step 1: Extract data from request
    const buyerId = req.user!.userId;  // ← From JWT middleware!
    const transactionId = req.params.id;
    const ipAddress = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress || ''
    ).trim();
    
    // Step 2: Query database
    const [txn] = await db.select().from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);
    
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    // Step 3: Validate authorization (buyer owns transaction)
    if (txn.buyerId !== buyerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Step 4: Build VNPay request parameters
    const vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: VNP_TMN_CODE,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: transactionId,
      vnp_OrderInfo: `ThanhToanXeDap-${transactionId}`,
      vnp_OrderType: 'other',
      vnp_Amount: txn.amount * 100,  // Convert to cents
      vnp_ReturnUrl: VNP_RETURN_URL,
      vnp_IpAddr: ipAddress,
      vnp_CreateDate: new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, '')
        .slice(0, 14),
    };
    
    // Step 5: Generate HMAC-SHA512 signature
    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(vnp_Params[key])}`)
      .join('&');
    
    const hmac = crypto
      .createHmac('sha512', VNP_HASH_SECRET)
      .update(sortedParams)
      .digest('hex');
    
    // Step 6: Build payment URL
    const paymentUrl = `${VNP_URL}?${sortedParams}&vnp_SecureHash=${hmac}`;
    
    // Step 7: Generate QR code (optional)
    const qrCode = await QRCode.toDataURL(paymentUrl);
    
    // Step 8: Return to frontend
    return res.status(200).json({
      success: true,
      data: {
        paymentUrl,
        qrCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min validity
      },
      message: 'Payment URL created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating payment URL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Data Flow:
// request → middleware extracts JWT → controller receives req.user
// → database query → VNPay param build → signature generate → response
```

**Payment Happens** → Buyer enters card on VNPay → VNPay charges card

**VNPay Sends IPN Callback** (Server-to-Server, `GET /api/payment/v1/vnpay-ipn?...`)
```typescript
// Step 1: VNPay calls backend directly (NO authentication)
export const vnpayIPN = async (req: Request, res: Response) => {
  try {
    // Step 2: Extract VNPay query params
    const vnp_Params: Record<string, string> = {} as Record<string, string>;
    Object.keys(req.query).forEach(key => {
      vnp_Params[key] = String(req.query[key]);
    });
    
    // Step 3: Extract & verify signature
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];
    
    // Reconstruct hash to verify
    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(vnp_Params[key])}`)
      .join('&');
    
    const computedHash = crypto
      .createHmac('sha512', VNP_HASH_SECRET)
      .update(sortedParams)
      .digest('hex');
    
    if (secureHash !== computedHash) {
      return res.status(200).json({ RspCode: '97', Message: 'Invalid checksum' });
    }
    
    // Step 4: Extract transaction details
    const txnRef = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount']) / 100;
    
    // Step 5: Query transaction from DB
    const [txn] = await db.select().from(transactions)
      .where(eq(transactions.id, txnRef))
      .limit(1);
    
    if (!txn) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }
    
    // Step 6: Idempotent check (don't process twice)
    if (txn.status === 'completed') {
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }
    
    // Step 7: Validate amount matches
    if (Math.abs(txn.amount - amount) > 1000) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }
    
    // Step 8: Check response code
    if (responseCode !== '00') {
      // Payment failed
      await db.update(transactions)
        .set({ status: 'cancelled' })
        .where(eq(transactions.id, txnRef));
      
      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }
    
    // Step 9: SUCCESS - Update transaction
    await db.update(transactions)
      .set({
        status: 'completed',
        paymentMethod: 'vnpay',
        notes: `VNPay TxnNo: ${vnp_Params['vnp_TransactionNo']}, Bank: ${vnp_Params['vnp_BankCode']}`,
      })
      .where(eq(transactions.id, txnRef));
    
    // Step 10: Update bike status
    const bike = await db.query.bikes.findFirst({
      where: eq(bikes.id, txn.bikeId),
    });
    
    await db.update(bikes)
      .set({ status: 'sold' })
      .where(eq(bikes.id, txn.bikeId));
    
    // Step 11: Create fulfillment record
    await db.insert(fulfillments).values({
      id: generateUUID(),
      transactionId: txnRef,
      status: 'preparing',
      notes: 'Seller preparing bike for shipment',
      createdAt: new Date(),
    });
    
    // Step 12: Send success response
    return res.status(200).json({ RspCode: '00', Message: 'Success' });
  } catch (error) {
    console.error('VNPay IPN error:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Server error' });
  }
};

// Data Flow:
// VNPay → IPN endpoint → verify signature → query DB → validate amount
// → update transaction/bike/fulfillment → return success
```

**Buyer Returns to Frontend** (Redirect to `GET VNP_RETURN_URL?...`)
```typescript
// src/controllers/paymentController.ts → vnpayReturn()
export const vnpayReturn = async (req: Request, res: Response) => {
  try {
    const vnp_Params = req.query;
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const transactionId = vnp_Params['vnp_TxnRef'];
    
    // Frontend logic (on browser):
    // 1. Parse query params
    // 2. If responseCode === '00': Show success page
    // 3. Else: Show error page
    // 4. Call GET /api/payment/v1/status/:transactionId to verify
    
    return res.redirect(
      responseCode === '00'
        ? `${FRONTEND_URL}/payment/success?id=${transactionId}`
        : `${FRONTEND_URL}/payment/failed?id=${transactionId}`
    );
  } catch (error) {
    res.redirect(`${FRONTEND_URL}/payment/error`);
  }
};
```

**Frontend Verifies Payment** (Buyer optional check)
```typescript
// Frontend: GET /api/payment/v1/status/txn-123
// src/controllers/paymentController.ts → getPaymentStatus()
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const txnId = req.params.transactionId;
    
    const txn = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, txnId),
        eq(transactions.buyerId, buyerId)
      ),
      with: {
        bike: {
          columns: { title: true, brand: true, price: true },
        },
        seller: {
          columns: { name: true, phone: true },
        },
      },
    });
    
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    return res.status(200).json({
      success: true,
      data: txn,
      message: 'Payment status retrieved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching status' });
  }
};

// Response shows:
// { status: 'completed', paymentMethod: 'vnpay', amount: 35000000, ... }
```

---

### PATTERN 2: Refund with Webhook (Service Integration)

**Buyer Requests Refund** → `POST /api/payment/v1/refund/:transactionId`

**Controller Calls Service** (`src/controllers/paymentController.ts` → `requestRefund()`)
```typescript
export const requestRefund = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const transactionId = req.params.transactionId;
    const { reason } = req.body;
    
    // Step 1: Validate transaction
    const txn = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.id, transactionId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.status, 'completed')  // Can only refund completed
      ),
    });
    
    if (!txn) {
      return res.status(400).json({ success: false, message: 'Invalid transaction' });
    }
    
    // Step 2: Create refund record
    const refundId = generateUUID();
    await db.insert(refunds).values({
      id: refundId,
      transactionId,
      buyerId,
      sellerId: txn.sellerId,
      amount: txn.amount,
      reason,
      status: 'pending',
      createdAt: new Date(),
    });
    
    // Step 3: Call refund service (different provider implementations)
    const refundResult = await sendRefundRequest({
      refundId,
      amount: txn.amount,
      reason,
      webhookUrl: `${BASE_URL}/api/payment/v1/refund-callback`,
    });
    
    // Step 4: Return result to buyer
    return res.status(200).json({
      success: true,
      data: { refundId, status: refundResult.status },
      message: 'Refund requested',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error requesting refund' });
  }
};

// Data Flow:
// Request → Validate txn → Create refund record → Call service → Return response
```

**Service Routes to Provider** (`src/services/refundProvider.ts`)
```typescript
export async function sendRefundRequest(request: RefundRequest): Promise<RefundResponse> {
  // Step 1: Check environment variable to pick provider
  const provider = process.env.REFUND_PROVIDER || 'mock';
  
  console.log(`[RefundProvider] Using provider: ${provider}`);
  
  if (provider === 'vnpay') {
    // Real VNPay API
    return await sendToVNPayRefundAPI(request);
  } else if (provider === 'mock-instant') {
    // Instant mock (for demo)
    return await mockInstantRefund(request);
  } else {
    // Default: mock with delay (for testing)
    return await mockRefundWithDelay(request);
  }
}

// ════════════════════════════════════════════════════════════════
// MOCK PROVIDER (Current: REFUND_PROVIDER=mock, REFUND_MOCK_DELAY_MS=5000)
// ════════════════════════════════════════════════════════════════

async function mockRefundWithDelay(request: RefundRequest): Promise<RefundResponse> {
  const delayMs = parseInt(process.env.REFUND_MOCK_DELAY_MS || '5000');
  
  console.log(`[MockRefund] Scheduling refund ${request.refundId} for ${delayMs}ms`);
  
  // Step 1: Return immediately to buyer
  const response: RefundResponse = {
    success: true,
    refundId: request.refundId,
    status: 'pending',
    amount: request.amount,
    externalRefundId: `MOCK_REF_${Date.now()}`,
  };
  
  // Step 2: Schedule webhook callback after delay
  setTimeout(async () => {
    try {
      console.log(`[MockRefund] Webhook firing for ${request.refundId}`);
      
      // Call our own webhook endpoint
      await sendRefundWebhookCallback(
        request.webhookUrl,
        {
          refundId: request.refundId,
          status: 'completed',
          processedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(`[MockRefund] Webhook error:`, error);
    }
  }, delayMs);
  
  return response;
}

// Helper: Send webhook callback
async function sendRefundWebhookCallback(
  webhookUrl: string,
  payload: any
): Promise<void> {
  // Step 1: Make HTTP POST to our backend webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }
  
  console.log(`[RefundProvider] Webhook sent successfully`);
}
```

**Webhook Callback Fires** (5 seconds later) → `POST /api/payment/v1/refund-callback`

**Callback Handler Updates Database** (`src/controllers/paymentController.ts` → `handleRefundCallback()`)
```typescript
export const handleRefundCallback = async (req: Request, res: Response) => {
  try {
    const { refundId, status, processedAt } = req.body;
    
    console.log(`[RefundCallback] Received callback for refund ${refundId}, status: ${status}`);
    
    // Step 1: Find refund record
    const refund = await db.query.refunds.findFirst({
      where: eq(refunds.id, refundId),
    });
    
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }
    
    // Step 2: Idempotent check (don't process twice)
    if (refund.status !== 'pending') {
      console.log(`[RefundCallback] Already processed: ${refund.status}`);
      return res.status(200).json({ success: true, message: 'Already processed' });
    }
    
    // Step 3: Update refund status
    await db.update(refunds)
      .set({
        status: 'completed',
        processedAt: new Date(processedAt),
      })
      .where(eq(refunds.id, refundId));
    
    console.log(`[RefundCallback] Refund ${refundId} marked as completed`);
    
    // Step 4: Update transaction status
    await db.update(transactions)
      .set({
        status: 'refunded',
      })
      .where(eq(transactions.id, refund.transactionId));
    
    console.log(`[RefundCallback] Transaction ${refund.transactionId} marked as refunded`);
    
    // Step 5: Restore bike to marketplace
    await db.update(bikes)
      .set({
        status: 'for_sale',
      })
      .where(eq(bikes.id, refund.bikeId));
    
    console.log(`[RefundCallback] Bike ${refund.bikeId} restored to for_sale`);
    
    // Step 6: Send confirmation email/SMS
    // await notificationService.sendRefundConfirmation(refund.buyerId, refundId);
    
    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
    });
  } catch (error) {
    console.error(`[RefundCallback] Error:`, error);
    return res.status(500).json({ success: false, message: 'Error processing refund' });
  }
};

// Data Flow Timeline:
// T=0s:  Buyer requests refund → DB insert refund (pending)
// T=0s+: Service returns to buyer with status=pending
// T=5s:  setTimeout fires → webhook HTTP POST to callback
// T=5s+: Callback handler receives → updates refund/transaction/bike
```

---

### PATTERN 3: Seller Creates Bike (Multipart Form + Service)

**Seller Submits Bike Form** → `POST /api/seller/v1/bikes` (multipart form-data)

**Middleware Processes Upload** (`src/middleware/bikeUploadMiddleware.ts`)
```typescript
export const bikeUploadMiddleware = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
]);

// Multer middleware:
// 1. Receives multipart request
// 2. Validates file types (jpeg, png, mp4)
// 3. Stores files in /uploads directory
// 4. Attaches files array to req.files
// 5. Parses form text fields into req.body
```

**Controller Processes Request** (`src/controllers/sellerController.ts` → `createBike()`)
```typescript
export const createBike = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;  // ← From JWT
    const files = req.files as BikeListingFiles;
    
    // Step 1: Validate bike data
    const { title, brand, price, year, condition, categoryId } = req.body;
    
    const yearResult = parseBikeYear(year);
    if (!yearResult.ok) {
      return res.status(400).json({ success: false, message: yearResult.message });
    }
    
    // Step 2: Resolve category (UUID, slug, or name)
    const catResult = await resolveCategoryInput(categoryId);
    if (!catResult.ok) {
      return res.status(400).json({ success: false, message: catResult.message });
    }
    
    // Step 3: Collect image URLs (already uploaded by multer)
    const imageUrls = collectImageUrlsFromRequest(files);
    if (!imageUrls.length) {
      return res.status(400).json({ success: false, message: 'At least 1 image required' });
    }
    
    // Step 4: Collect video URL if provided
    const videoUrl = collectVideoUrlFromRequest(files);
    
    // Step 5: Create bike record in DB
    const bikeId = generateUUID();
    await db.insert(bikes).values({
      id: bikeId,
      sellerId,
      title,
      brand,
      price,
      year: yearResult.value,
      condition,
      categoryId: catResult.id,
      images: imageUrls,  // Array of URLs
      video: videoUrl,
      status: 'pending',  // ← Awaits inspector
      isVerified: 'pending',
      createdAt: new Date(),
    });
    
    // Step 6: Trigger inspection task (could be queue job)
    // await inspectionQueue.add({ bikeId, sellerId });
    
    return res.status(201).json({
      success: true,
      data: { bikeId, status: 'pending' },
      message: 'Bike listing created',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating bike' });
  }
};

// Data Flow:
// Multipart request → Middleware uploads files → Controller receives URLs
// → Validates data → Insert DB → Return bikeId
```

---

### PATTERN 4: Inspector Reviews Bike (With Images)

**Inspector Gets Pending Bikes** → `GET /api/inspector/v1/bikes/pending`

```typescript
// src/controllers/inspectorController.ts → getPendingBikes()
export const getPendingBikes = async (req: Request, res: Response) => {
  try {
    // Step 1: Query bikes awaiting inspection
    const bikes = await db.query.bikes.findMany({
      where: and(
        eq(bikes.status, 'pending'),
        eq(bikes.isVerified, 'pending')
      ),
      with: {
        seller: {
          columns: { name: true, email: true },
        },
      },
      orderBy: [asc(bikes.createdAt)],
    });
    
    return res.status(200).json({
      success: true,
      data: bikes,
      message: 'Pending bikes fetched',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bikes' });
  }
};
```

**Inspector Starts Inspection** → `POST /api/inspector/v1/bikes/:id/start-inspection`

```typescript
export const startInspection = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user!.userId;
    const bikeId = req.params.id;
    
    // Step 1: Create inspection record
    const inspectionId = generateUUID();
    await db.insert(inspections).values({
      id: inspectionId,
      bikeId,
      inspectorId,
      status: 'in_progress',
      startedAt: new Date(),
      createdAt: new Date(),
    });
    
    // Step 2: Lock bike from other inspectors
    await db.update(bikes)
      .set({ inspectionInProgress: true })
      .where(eq(bikes.id, bikeId));
    
    return res.status(200).json({
      success: true,
      data: { inspectionId },
      message: 'Inspection started',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error starting inspection' });
  }
};
```

**Inspector Submits Report + Images** → `POST /api/inspector/v1/bikes/:id/submit-inspection` (multipart)

```typescript
export const submitInspection = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user!.userId;
    const bikeId = req.params.id;
    const files = req.files as InspectionProofFiles;
    
    // Step 1: Collect inspection images
    const inspectionImages = collectImageUrlsFromRequest(files);
    const reportFile = collectReportFileUrl(files);
    
    // Step 2: Find inspection
    const inspection = await db.query.inspections.findFirst({
      where: and(
        eq(inspections.bikeId, bikeId),
        eq(inspections.inspectorId, inspectorId),
        eq(inspections.status, 'in_progress')
      ),
    });
    
    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }
    
    // Step 3: Parse form data
    const formData = inspectionFormFromMultipart(req.body, bikeId);
    
    // Step 4: Validate (especially if failed)
    if (formData.status === 'failed') {
      const reasonResult = validateFailedInspectionReason(formData.reason);
      if (!reasonResult.ok) {
        return res.status(400).json({ success: false, message: reasonResult.message });
      }
    }
    
    // Step 5: Update inspection record
    await db.update(inspections)
      .set({
        status: 'completed',
        overallCondition: formData.overallCondition,
        frameCondition: formData.frameCondition,
        brakeCondition: formData.brakeCondition,
        drivetrainCondition: formData.drivetrainCondition,
        wheelCondition: formData.wheelCondition,
        inspectionNote: formData.inspectionNote,
        recommendation: formData.recommendation,
        inspectionImages: inspectionImages,
        reportFile: reportFile,
        completedAt: new Date(),
        durationMinutes: Math.round(
          (Date.now() - inspection.startedAt!.getTime()) / 60000
        ),
      })
      .where(eq(inspections.id, inspection.id));
    
    // Step 6: Update bike based on inspection result
    if (formData.status === 'approved') {
      // ✅ Approved
      await db.update(bikes)
        .set({
          isVerified: 'verified',  // ← Ready for admin approval
          inspectionInProgress: false,
        })
        .where(eq(bikes.id, bikeId));
      
      // Alert admin: "New inspection approved, ready for approval"
      // await notificationService.alertAdmin('inspection_approved', { bikeId });
    } else {
      // ❌ Rejected
      await db.update(bikes)
        .set({
          isVerified: 'rejected',
          rejectionReason: formData.reason,
          inspectionInProgress: false,
        })
        .where(eq(bikes.id, bikeId));
      
      // Alert seller: "Inspection failed, resubmit after fixes"
      // await notificationService.sendToSeller('inspection_failed', { bikeId, reason: formData.reason });
    }
    
    return res.status(200).json({
      success: true,
      data: { inspectionId: inspection.id, status: formData.status },
      message: 'Inspection submitted',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting inspection' });
  }
};

// Data Flow:
// Inspector POSTs → Middleware uploads images → Controller receives URLs
// → Parse form data → Validate → Update inspection → Update bike
// → If approved: bike.isVerified = 'verified' (ready for admin)
// → If rejected: bike.isVerified = 'rejected' (seller can resubmit)
```

---

### PATTERN 5: Admin Approves Bike (Multi-Table Update)

**Admin Gets Bikes Pending Approval** → `GET /api/admin/v1/bikes/pending-approval`

```typescript
export const getPendingApprovalBikes = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.userId;
    
    // Query bikes where:
    // 1. status = 'pending' (not yet approved)
    // 2. isVerified = 'verified' (passed inspector)
    const bikes = await db.query.bikes.findMany({
      where: and(
        eq(bikes.status, 'pending'),
        eq(bikes.isVerified, 'verified')  // Only approved by inspector
      ),
      with: {
        seller: { columns: { name: true, email: true } },
        category: { columns: { name: true } },
        inspections: {
          where: eq(inspections.status, 'completed'),
          limit: 1,
          orderBy: [desc(inspections.completedAt)],
        },
      },
      orderBy: [asc(bikes.createdAt)],
    });
    
    return res.status(200).json({
      success: true,
      data: bikes,
      message: 'Pending approval bikes fetched',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bikes' });
  }
};
```

**Admin Approves Bike** → `PUT /api/admin/v1/bike/:id/approve`

```typescript
export const approveBike = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.userId;
    const bikeId = req.params.id;
    
    // Step 1: Find bike
    const [bike] = await db.select().from(bikes)
      .where(eq(bikes.id, bikeId))
      .limit(1);
    
    if (!bike) {
      return res.status(404).json({ success: false, message: 'Bike not found' });
    }
    
    // Step 2: Verify it passed inspection
    if (bike.isVerified !== 'verified') {
      return res.status(400).json({
        success: false,
        message: `Bike not approved by inspector. Current status: ${bike.isVerified}`,
      });
    }
    
    // Step 3: Verify not already approved
    if (bike.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Bike already processed. Current status: ${bike.status}`,
      });
    }
    
    // Step 4: Update bike to FOR SALE
    await db.update(bikes)
      .set({
        status: 'for_sale',    // ← NOW VISIBLE IN SEARCH!
        approvedAt: new Date(),
        approvedBy: adminId,
        isVisible: true,       // Make it searchable
      })
      .where(eq(bikes.id, bikeId));
    
    // Step 5: Send notification to seller
    const seller = await db.query.users.findFirst({
      where: eq(users.id, bike.sellerId),
    });
    
    if (seller) {
      // await emailService.send({
      //   to: seller.email,
      //   subject: 'Bike Listing Approved!',
      //   body: `Your bike "${bike.title}" is now live on the marketplace.`
      // });
    }
    
    return res.status(200).json({
      success: true,
      data: { bikeId, status: 'for_sale' },
      message: 'Bike approved and now live',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error approving bike' });
  }
};

// Multi-Table Update Chain:
// Step 1: Find bike (verify conditions)
// Step 2: Check isVerified === 'verified' (inspector approval)
// Step 3: Update bikes table: status → for_sale, approvedAt, approvedBy
// Step 4: Query seller user
// Step 5: Send email notification
```

---

### PATTERN 6: Search Integration with QueryBuilder

**Buyer Searches for Bikes** → `GET /api/buyer/v1/bikes/search?brand=Trek&minPrice=1000000&maxPrice=50000000&sortBy=price`

```typescript
// src/controllers/buyerController.ts → searchBikes()
export const searchBikes = async (req: Request, res: Response) => {
  try {
    const {
      brand,
      model,
      minPrice,
      maxPrice,
      condition,
      color,
      sortBy = 'createdAt',
      page = '1',
      limit = '20',
    } = req.query;
    
    // Step 1: Build WHERE conditions dynamically
    const conditions: SQL[] = [];
    
    // Always filter: only approved bikes, visible, for sale
    conditions.push(eq(bikes.status, 'for_sale'));
    conditions.push(eq(bikes.isVisible, true));
    
    // Apply filters if provided
    if (brand) {
      conditions.push(ilike(bikes.brand, `%${brand}%`));
    }
    if (model) {
      conditions.push(ilike(bikes.model, `%${model}%`));
    }
    if (condition) {
      conditions.push(eq(bikes.condition, condition as any));
    }
    if (color) {
      conditions.push(ilike(bikes.color, `%${color}%`));
    }
    if (minPrice) {
      conditions.push(gte(bikes.price, parseFloat(String(minPrice))));
    }
    if (maxPrice) {
      conditions.push(lte(bikes.price, parseFloat(String(maxPrice))));
    }
    
    // Step 2: Combine all conditions with AND
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    // Step 3: Determine sort order
    let orderByClause;
    switch (sortBy) {
      case 'price':
        orderByClause = asc(bikes.price);
        break;
      case 'year':
        orderByClause = desc(bikes.year);
        break;
      case 'mileage':
        orderByClause = asc(bikes.mileage);
        break;
      default:
        orderByClause = desc(bikes.createdAt);
    }
    
    // Step 4: Calculate pagination
    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const offset = (pageNum - 1) * limitNum;
    
    // Step 5: Execute query with all conditions
    const bikes_list = await db.query.bikes.findMany({
      where: whereClause,
      with: {
        seller: {
          columns: { name: true, avatar: true, rating: true },
        },
        category: {
          columns: { name: true },
        },
      },
      orderBy: [orderByClause],
      limit: limitNum,
      offset: offset,
    });
    
    // Step 6: Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(bikes)
      .where(whereClause);
    
    // Step 7: Return paginated results
    return res.status(200).json({
      success: true,
      data: bikes_list,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(count),
        totalPages: Math.ceil(count / limitNum),
      },
      message: 'Bikes found',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error searching bikes' });
  }
};

// Query Builder Flow:
// 1. Parse query params
// 2. Build SQL WHERE clauses (brand ILIKE, price BETWEEN, status =, etc.)
// 3. Apply sorting (ORDER BY price ASC, created_at DESC, etc.)
// 4. Apply pagination (LIMIT, OFFSET)
// 5. Execute query with all conditions
// 6. Get total count (separate query)
// 7. Return results + pagination info
```

---

### PATTERN 7: Error Handling & Response Format

**Consistent API Response Format**

```typescript
// Success Response
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Operation completed",
  "pagination": { /* if applicable */ }
}

// Error Response
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (optional)",
  "errors": { /* validation errors if applicable */ }
}

// Example: Validation errors
export const validateBikeInput = (data: any) => {
  const errors: Record<string, string> = {};
  
  if (!data.title || data.title.length < 5) {
    errors.title = 'Title must be at least 5 characters';
  }
  
  if (!data.price || data.price <= 0) {
    errors.price = 'Price must be greater than 0';
  }
  
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  
  return { success: true };
};

// Used in controller:
const validation = validateBikeInput(req.body);
if (!validation.success) {
  return res.status(400).json(validation);
}
```

---

### PATTERN 8: Transaction Flow (Complete Journey)

**Step-by-Step: From Purchase to Delivery**

```
BUYER                     BACKEND                      DATABASE
  │                         │                            │
  ├─ Browse bikes ─────────→ searchBikes()              │
  │                         ├─ Query bikes              │
  │                         │  where status='for_sale'  │
  │◄────────{bikes}─────────│                            │
  │                         │                            │
  ├─ Click "Buy Now" ──────→ createTransaction()        │
  │ (full_payment)          ├─ Validate bike avail      │
  │                         ├─ Calculate fee 5%         │
  │                         ├─ INSERT transaction       │
  │◄──────{txnId}──────────│ (status=pending)           │
  │                         │                            │
  ├─ Pay via link ────────→ createPaymentUrl()          │
  │                         ├─ Build VNPay params       │
  │                         ├─ Sign with HMAC-SHA512    │
  │                         └─ Return paymentUrl        │
  │◄─────{paymentUrl}──────│                            │
  │                         │                            │
  ├─ Redirect to VNPay     │                            │
  │ ↓ (payment gateway)     │                            │
  │ (card charge)           │                            │
  │                         │                            │
  │◄─ Redirect back ────────| VNPay pays us              │
  │                         │ IPN callback →             │
  │                         ├─ Verify signature         │
  │                         ├─ Validate amount          │
  │                         ├─ UPDATE transaction       │
  │                         │  (status=completed)       │
  │                         ├─ UPDATE bike              │
  │                         │  (status=sold)            │
  │                         └─ INSERT fulfillment       │
  │                         │  (status=preparing)       │
  │                         │                            │
  ├─ GET /status/txn ─────→ getPaymentStatus()          │
  │                         ├─ Query transaction        │
  │                         │  where txn.status=        │
  │                         │  'completed'              │
  │◄──{status:completed}───│                            │
  │                         │                            │
SELLER receives payment    │                            │
  │                         │                            │
  ├─ Ship bike ───────────→ updateDeliveryStatus()      │
  │                         ├─ Validate txn belongs     │
  │                         ├─ UPDATE delivery          │
  │                         │  (status=delivering)      │
  │                         ├─ Add tracking number      │
  │                         └─ Send notification        │
  │◄─{deliveryUpdated}────│                            │
  │                         │                            │
BUYER receives bike        │                            │
  │                         │                            │
  ├─ Confirm receipt ─────→ confirmReceipt()            │
  │                         ├─ Validate delivery        │
  │                         ├─ UPDATE delivery          │
  │                         │  (status=delivered)       │
  │                         │  receipt_confirmed_at=now │
  │                         └─ Signal payout ready      │
  │◄─{receiptConfirmed}───│                            │
  │                         │                            │
SELLER requests payout     │                            │
  │                         │                            │
  ├─ GET /payout ────────→ createPayout()              │
  │  (seller endpoint)      ├─ Verify delivery shipped  │
  │                         ├─ Verify receipt confirmed │
  │                         ├─ INSERT payout           │
  │                         │  (amount=sellerNetAmount) │
  │                         │  (status=pending)         │
  │                         ├─ Call payout provider     │
  │                         └─ Return payout ID        │
  │                         │                            │
  │ Wait for webhook       │                            │
  │ (should complete within│                            │
  │  1-3 business days)    │                            │
  │                         │                            │
  │                         ← Provider webhook ──────┐  │
  │                         handlePayoutCallback()   │  │
  │                         ├─ Verify signature      │  │
  │                         ├─ UPDATE payout         │  │
  │                         │  (status=completed)    │  │
  │                         └─ Seller money in bank  │  │
  │                                                  │  │
```

---

**End of Code Integration Section**

This section documents:
- How middleware integrates with controllers
- How services are called from controllers
- How database queries return data
- How responses are formatted
- Error handling patterns
- Complete transaction flows with multiple database updates
- Query builder patterns for dynamic filtering

