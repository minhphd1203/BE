# Quick Reference: Deposit System

## Status Vocabulary

```
🟢 approved     → Available for purchase
🟡 reserved     → Buyer deposited, awaiting remaining payment
🔴 sold         → Fully paid (deposit + remaining OR full payment)
⚫ pending/hidden/rejected → Not available for purchase
```

## Payment Scenarios at a Glance

### Scenario A: Full Payment (Immediate)
```
Buyer pays 100% immediately
Amount: Full bike price
Endpoint: POST /api/payment/v1/create/:transactionId
Result: Bike → sold (status)
```

### Scenario B: Deposit Then Complete (NEW)
```
Step 1: Buyer deposits 10-30%
   Amount: 2M on 20M bike
   Endpoint: POST /api/payment/v1/create/:depositTransactionId
   Result: Bike → reserved

Step 2: Later, buyer pays remaining
   Amount: 18M (20M - 2M)
   Endpoint: POST /api/payment/v1/create-remaining/:depositTransactionId (NEW)
   Result: Bike → sold
```

## Transaction Type Decision Tree

```
Does buyer want to pay now?
├─ YES → transactionType: 'full_payment'
│        Amount: bike.price (100%)
│        Bike status: approved → sold
│
└─ NO, deposit now, pay later → transactionType: 'deposit'
                                 Amount: bike.price * 0.1 to 0.3 (10-30%)
                                 Bike status: approved → reserved
                                 Future: → sold (after remaining payment)
```

## API Call Order

### Full Purchase Flow
```
1️⃣  POST /api/buyer/v1/transactions
    Body: { bikeId, amount: fullPrice, transactionType: 'full_payment' }
    Response: { id: txnId, status: 'pending' }

2️⃣  POST /api/payment/v1/create/:txnId
    Response: { paymentUrl: 'https://sandbox.vnpayment.vn/...' }

3️⃣  Redirect to paymentUrl
    (User pays on VNPay)

4️⃣  VNPay IPN Callback
    GET /api/payment/v1/vnpay-ipn?vnp_TxnRef=txnId&vnp_ResponseCode=00
    → Updates DB: transaction.status = 'completed', bike.status = 'sold'
```

### Deposit + Remaining Purchase Flow (NEW)
```
1️⃣  POST /api/buyer/v1/transactions
    Body: { bikeId, amount: price*0.1, transactionType: 'deposit' }
    Response: { id: depositTxnId, remainingBalance: price*0.9 }

2️⃣  POST /api/payment/v1/create/:depositTxnId
    Response: { paymentUrl: 'https://...' } ← For 2M

3️⃣  Redirect to paymentUrl
    (User pays 2M on VNPay)

4️⃣  VNPay IPN Callback
    → Updates: transaction.status = 'completed', bike.status = 'reserved'

5️⃣  [LATER] POST /api/payment/v1/create-remaining/:depositTxnId (NEW)
    Response: {
      paymentUrl: 'https://...',
      remainingTransactionId: newTxnId,
      remainingBalance: price*0.9
    }

6️⃣  Redirect to paymentUrl
    (User pays 18M on VNPay)

7️⃣  VNPay IPN Callback
    → Updates: remaining_txn.status = 'completed', bike.status = 'sold'
```

## Validation Rules Quick Guide

| Rule | Requirement | Error |
|------|-------------|-------|
| Deposit Range | 10% ≤ amount ≤ 30% | Shows min/max amounts |
| Bike Status | Must be `approved` | Not found error |
| Self-Purchase | buyer ≠ seller | Can't buy own bike |
| Active Transaction | Max 1 pending per buyer+bike | Already have pending |
| Remaining Payment | Original must be `completed` | Status not eligible |

## Environment Variables

```bash
# Required in .env for payments to work
VNP_TMNCODE=EFMLEPSI                              # VNPay Terminal Code
VNP_SECRET=H7B07AD4I9DRU5D50O3N6N0U5NVLILVS   # Signing key
VNP_RETURN_URL=https://ngrok-url/api/payment/v1/vnpay-return
VNP_IPN_URL=https://ngrok-url/api/payment/v1/vnpay-ipn
```

## Response Status Codes

| HTTP | Scenario | Example |
|------|----------|---------|
| 201 | Transaction created | `POST /transactions` |
| 200 | Payment URL generated | `POST /create/:txnId` |
| 200 | IPN processed | `/vnpay-ipn` |
| 400 | Invalid deposit amount | < 10% or > 30% |
| 400 | Wrong transaction type | remaining on full_payment |
| 404 | Transaction not found | Invalid txnId |
| 401 | Not authenticated | Missing token |

## Transaction Status Flow

```
pending
  ↓
  └─ VNPay Success → completed ← (Bike status updates here)
  └─ VNPay Failure → cancelled
```

## Bike Status Flow (Detailed)

```
pending (new)
  ↓ [Admin approves]
approved
  ├─ [Buyer: full_payment]
  │  └─ [VNPay: success] → sold ✓
  │
  └─ [Buyer: deposit (10-30%)]
     └─ [VNPay: success] → reserved
        └─ [Buyer: remaining_payment]
           └─ [VNPay: success] → sold ✓
```

## Database Columns Reference

### Transactions Table
```typescript
id              // UUID, unique transaction ID
transactionType // 'full_payment' | 'deposit' | 'remaining_payment'
amount          // Amount paid in THIS transaction
remainingBalance// For deposits only: amount still owed
status          // 'pending' | 'completed' | 'cancelled'
notes           // Auto-generated ("Đặt cọc 10%...") or custom
```

### Bikes Table
```typescript
status // 'pending' | 'approved' | 'rejected' | 'hidden' | 'reserved' | 'sold'
price  // Full bike price (used for deposit calculation)
```

## Common Calculations

```javascript
// Deposit validation
minDeposit = bike.price * 0.10    // 10%
maxDeposit = bike.price * 0.30    // 30%

// Remaining amount after deposit
remainingBalance = bike.price - depositAmount

// Percentage shown in notes
depositPercentage = (depositAmount / bike.price) * 100

// Auto-generated notes
`Đặt cọc ${depositPercentage.toFixed(1)}% (${amount}) để giữ xe. Còn lại ${remainingBalance} cần thanh toán khi nhận xe.`
```

## Debugging Tips

### Issue: Bike still shows as 'approved' after deposit payment
```
Solution: Check VNPay IPN is being called
→ Verify VNP_IPN_URL in merchant portal
→ Check console logs in VNPay callback
→ Ensure timeout is > 5 seconds
```

### Issue: Can't see remaining payment endpoint
```
Solution: Import failure or route not registered
→ Check paymentRoutes.ts imports createRemainingPaymentUrl
→ Check server.ts registers paymentRoutes
→ Run: npm run dev (check for build errors)
```

### Issue: Deposit amount rejected
```
Solution: Amount outside 10-30% range or bike not approved
→ Verify bike.status = 'approved' first
→ Calculate: minDeposit = price * 0.1, maxDeposit = price * 0.3
→ Check error message for exact limits
```

## Testing Commands

```bash
# Check if server running
curl http://localhost:3000/health

# Create deposit
curl -X POST http://localhost:3000/api/buyer/v1/transactions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bikeId": "bike-id",
    "amount": 2000000,
    "transactionType": "deposit"
  }'

# Get payment URL for deposit
curl -X POST http://localhost:3000/api/payment/v1/create/txn-id \
  -H "Authorization: Bearer TOKEN"

# Check remaining payment endpoint exists
curl -X POST http://localhost:3000/api/payment/v1/create-remaining/txn-id \
  -H "Authorization: Bearer TOKEN"
```

## File Reference

| Document | Purpose |
|----------|---------|
| `DEPOSIT_SYSTEM.md` | Comprehensive architecture & API docs |
| `DEPOSIT_IMPLEMENTATION.md` | Implementation details & test cases |
| `src/controllers/paymentController.ts` | Implementation code |
| `src/routes/paymentRoutes.ts` | API route definitions |
| `src/constants/transactionTypes.ts` | Transaction type constants |
| `QUICK_REFERENCE.md` | This file |

## One-Minute Summary

✅ **What Changed:**
- Bikes now can be `reserved` (not just `sold`)
- New endpoint: `POST /api/payment/v1/create-remaining/:txnId`
- Deposit payment → bike = `reserved`
- Remaining payment → bike = `sold`

✅ **For Buyers:**
- Can deposit 10-30% to reserve a bike
- Will see remaining amount due automatically calculated
- Can pay remaining balance later using new endpoint

✅ **For Backend:**
- IPN callback detects payment type automatically
- Sets bike status accordingly
- Maintains audit trail via transaction notes

✅ **No Breaking Changes:**
- Existing full_payment flow untouched
- Search already excludes reserved/sold
- All existing endpoints still work
