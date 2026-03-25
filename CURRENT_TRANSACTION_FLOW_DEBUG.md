# Transaction Flow & "Wrong Sign" Error Analysis

## 🔴 Current Issue: "Wrong Sign" Error

**Error Code:** Usually `RspCode: 97` or VNPay code `70` on the Merchant Portal

### Root Causes & Solutions

#### 1. **Secret Key Issues** (Most Common)
```javascript
// Current implementation checks:
const secret = process.env.VNP_SECRET!;
```

**Checklist:**
- [ ] `.env` file has `VNP_SECRET` defined
- [ ] Secret key is **exactly** matching VNPay Merchant Portal (copy-paste, no spaces)
- [ ] Secret is for **Sandbox** (when testing)
- [ ] Server restarted after `.env` changes
- [ ] No trailing/leading spaces in `.env`

**Fix if secret is wrong:**
```bash
# 1. Go to https://sandbox.vnpayment.vn/merchantv2/
# 2. Merchant Admin > Website/App > Select your website > Edit
# 3. Copy the exact Secret Key
# 4. Update .env:
VNP_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# 5. Restart server
npm run dev
```

---

#### 2. **Signature Encoding Issue** (Already Fixed in Code)

The current implementation **correctly** handles encoding:

```javascript
// ✓ CORRECT APPROACH (Current Code)
function buildVNPayUrl(params: Record<string, string>): string {
  const secret = process.env.VNP_SECRET!;
  const sortedKeys = Object.keys(params).sort(); // Sort alphabetically
  
  // ✓ Step 1: Build hash string WITHOUT URL encoding (raw data)
  const hashData = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  
  // ✓ Step 2: Create HMAC-SHA512 with raw data
  const hmac = crypto.createHmac('sha512', secret);
  const secureHash = hmac.update(Buffer.from(hashData, 'utf-8')).digest('hex');
  
  // ✓ Step 3: URL encode individual values for query string
  const queryString = sortedKeys
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  
  return `${VNPAY_URL}?${queryString}&vnp_SecureHash=${secureHash}`;
}
```

**Why this works:**
- VNPay compares the signature on RAW parameter values (not URL-encoded)
- Only the query string itself needs URL encoding when sending to browser

---

#### 3. **Signature Verification Flow**

```
┌─────────────────────────────────────────────────────┐
│         SENDING (buildVNPayUrl)                      │
├─────────────────────────────────────────────────────┤
│ 1. Sort params alphabetically                        │
│ 2. Build: "key1=val1&key2=val2&key3=val3" (RAW)    │
│ 3. HMAC-SHA512(raw_string, secret) → hash1          │
│ 4. URL-encode values for query string                │
│ 5. Send: ?key1=<encoded_val1>&vnp_SecureHash=hash1 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         VNPAY VERIFICATION                           │
├─────────────────────────────────────────────────────┤
│ 1. Receive params with vnp_SecureHash               │
│ 2. Sort params alphabetically                        │
│ 3. Build: "key1=val1&key2=val2&key3=val3" (RAW)    │
│ 4. HMAC-SHA512(raw_string, secret) → calculated     │
│ 5. Compare: calculated == vnp_SecureHash            │
│    ✓ Match = Payment approved                       │
│    ✗ Mismatch = Code 70 Error                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         IPN CALLBACK (verifyVNPaySignature)         │
├─────────────────────────────────────────────────────┤
│ 1. Receive: tx_id + amount + signature              │
│ 2. Reconstruct raw string with same logic           │
│ 3. Verify signature matches                         │
│ 4. If mismatch → Reject callback                    │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Complete Transaction Flow

### **Flow 1: Full Payment (100% Immediate)**

```
START: Buyer creates transaction
  ↓
┌─────────────────────────────────────────────┐
│ POST /api/buyer/v1/transactions              │
│ - Create transaction (status: pending)       │
│ - Bike status: approved                      │
│ - Amount: 100% of bike price                 │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Seller reviews & approves                    │
│ - Transaction status → approved              │
│ - Awaiting buyer payment                     │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ POST /api/payment/v1/create/:transactionId   │
│ - Check transaction.status == 'approved'     │
│ - Build VNPay URL with signature             │
│ - Return paymentUrl + QR code                │
│ - QR expires in 10 minutes                   │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Buyer redirected to VNPay                    │
│ - Payment page shown                         │
│ - Buyer enters card details                  │
└─────────────────────────────────────────────┘
  ↓ (2 parallel callbacks from VNPay)
┌──────────────────┐    ┌────────────────────┐
│  Browser Redirect │    │  IPN Callback      │
│                  │    │  (server-to-server)│
│ vnpay-return     │    │                    │
└──────────────────┘    │ vnpay-ipn          │
      ↓                 │                    │
  Show result to     │ ✓ Verify signature  │
  user (UX only)     │ ✓ Update status      │
                        │ ✓ Update bike      │
                        │ ✓ Send RspCode:00  │
                        └────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Database State:                              │
│ - transaction.status = completed             │
│ - bike.status = sold                         │
│ - Seller receives payment                    │
└─────────────────────────────────────────────┘
END
```

---

### **Flow 2: Deposit + Remaining Payment (Two-Phase)**

```
START: Buyer creates transaction with deposit
  ↓
┌─────────────────────────────────────────────┐
│ POST /api/buyer/v1/transactions              │
│ - transactionType: 'deposit'                 │
│ - amount: 10% of bike price (e.g., 2M/20M)  │
│ - remainingBalance: 90% (e.g., 18M)         │
│ - status: pending                           │
│ - bike.status: awaiting_deposit             │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Seller approves & payment succeeds           │
│ via IPN callback                            │
│ - transaction.status = completed             │
│ - bike.status = reserved                     │
│ - Countdown begins: 7 days to pay remaining  │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Buyer pays remaining balance:                │
│ POST /api/payment/v1/create-remaining/:txId  │
│ - Creates NEW transaction:                   │
│   - transactionType: 'remaining_payment'     │
│   - amount: remainingBalance (18M)           │
│   - status: pending                          │
│ - Return paymentUrl for the new transaction  │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Buyer pays remaining via VNPay               │
│ (same flow as full payment)                 │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ IPN marks remaining_payment completed        │
│ - remaining transaction.status = completed   │
│ - bike.status = sold                         │
│ - Full payment received by seller            │
└─────────────────────────────────────────────┘
END
```

---

## 🐛 Common Issues & Diagnostics

### Issue 1: "Invalid checksum" on vnpay-return
```javascript
// This endpoint verifies the signature
export const vnpayReturn = async (req: Request, res: Response) => {
  const params = req.query as Record<string, string>;
  const isValid = verifyVNPaySignature(params); // ← This is failing!
  
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Xác thực chữ ký thất bại',
      code: 'INVALID_CHECKSUM',
    });
  }
  // ...
}
```

**Debug steps:**
1. Check `.env` has correct `VNP_SECRET`
2. Enable detailed logging:
   ```javascript
   // Add before verifyVNPaySignature call:
   console.log('[Debug] Received params:', params);
   console.log('[Debug] VNP_SECRET:', process.env.VNP_SECRET ? 'SET' : 'MISSING');
   ```
3. Compare signature calculation manually

---

### Issue 2: IPN never arrives (transaction stuck in "pending")
```
Symptoms:
- Payment successful on VNPay
- User redirected back (vnpay-return called)
- But transaction status still "pending" after 10 minutes
- Bike still in "approved" state

Causes:
1. IPN URL not configured in Merchant Portal
2. Wrong ngrok URL in .env
3. Firewall blocking VNPay callbacks
4. Server crashed (check logs)

Fix:
1. Go to https://sandbox.vnpayment.vn/merchantv2/
2. Website/App → Select your website → Edit
3. Set IPN URL: https://{ngrok-url}.ngrok-free.app/api/payment/v1/vnpay-ipn
4. Restart server: npm run dev
```

---

### Issue 3: Transaction amount mismatch
```
VNPay IPN fails with: "Amount mismatch"

Check:
1. How was amount calculated in createPaymentUrl?
   const amount = Math.round(transaction.amount * 100); // ← in cents

2. Is same calculation in IPN?
   const expectedAmount = Math.round(transaction.amount * 100);
   const vnpAmount = parseInt(params['vnp_Amount']);
   
3. Database precision?
   Check if transaction.amount stored correctly (precision/decimal issues)
```

---

## 🔍 Verification Checklist

- [ ] `.env` has `VNP_SECRET` (exact copy from Merchant Portal)
- [ ] `.env` has `VNP_TMNCODE` (Terminal ID)
- [ ] `.env` has correct `VNP_RETURN_URL` (with ngrok URL)
- [ ] ngrok is running: `ngrok http 3000`
- [ ] IPN URL configured in Merchant Portal: `https://ngrok-url/api/payment/v1/vnpay-ipn`
- [ ] Server running after any `.env` changes: `npm run dev`
- [ ] Check server logs for `[VNPay IPN]` messages
- [ ] Database updated after successful payment (check transaction.status)
- [ ] No frontend CORS issues when redirecting

---

## 📋 Test Sandbox Card

| Field | Value |
|-------|-------|
| **Card Number** | `9704198526191432198` |
| **Cardholder** | `NGUYEN VAN A` |
| **Expiry** | `07/15` |
| **OTP** | `123456` |

---

## 🚀 Quick Test Flow

```bash
# 1. Start with correct .env values
# 2. Run ngrok: ngrok http 3000
# 3. Update IPN URL in portal
# 4. Restart: npm run dev
# 5. Create transaction: POST /api/buyer/v1/transactions
# 6. Get payment URL: POST /api/payment/v1/create/{txnId}
# 7. Pay with test card
# 8. Watch server logs for [VNPay IPN]
# 9. Check: GET /api/payment/v1/status/{txnId}
```
