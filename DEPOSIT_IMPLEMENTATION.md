# Implementation Summary: Deposit & Reservation System

**Date:** March 18, 2026  
**Status:** ✅ Complete - Ready for Testing

## What Was Implemented

A complete two-phase payment system where buyers can deposit 10-30% of a bike's price to reserve it, then pay the remaining balance later. The bike transitions from `reserved` to `sold` status only after full payment is received.

---

## Files Modified

### 1. **Payment Controller** 
📄 `src/controllers/paymentController.ts`

**Changes:**
- ✨ **NEW:** `createRemainingPaymentUrl()` - Endpoint to create payment URL for remaining balance after deposit
- 🔄 **UPDATED:** `vnpayIPN()` - Enhanced to handle three transaction types:
  - `full_payment` → bike status = `sold`
  - `deposit` → bike status = `reserved` (awaiting remaining payment)
  - `remaining_payment` → bike status = `sold` (final payment complete)
- 📝 Added comprehensive logging for deposit vs remaining payment flows

**Key Logic:**
```typescript
if (transaction.transactionType === 'deposit') {
  bikeStatus = 'reserved'; // Not sold yet
} else if (transaction.transactionType === 'remaining_payment') {
  bikeStatus = 'sold'; // Finally complete
  // Extract deposit transaction ID and update audit trail
}
```

### 2. **Payment Routes**
📄 `src/routes/paymentRoutes.ts`

**Changes:**
- ✅ Imported `createRemainingPaymentUrl` function
- ✨ **NEW:** Route `POST /api/payment/v1/create-remaining/:transactionId`
- 📚 Added full Swagger documentation for the remaining payment endpoint

### 3. **Transaction Types Constants**
📄 `src/constants/transactionTypes.ts`

**Changes:**
- ✨ Added `REMAINING_PAYMENT: 'remaining_payment'` type
- 📝 Added description for remaining payment type
- 💡 Added note that remaining_payment is created internally only

### 4. **Database Schema**
📄 `src/db/schema.ts`

**Changes:**
- 📝 Updated `bikes.status` comment to include `reserved` status
- Documentation: Status values are now `'pending', 'approved', 'rejected', 'hidden', 'reserved', 'sold'`

### 5. **Buyer Controller** (No changes needed)
📄 `src/controllers/buyerController.ts`

**Status:** ✅ Already supports deposit transactions with 10-30% range validation

### 6. **Migrations**
📄 `drizzle/0005_add_reserved_status.sql` (NEW)

**Status:** Documentation file - no database changes needed (VARCHAR already supports any string)

### 7. **Documentation** (NEW)
📄 `DEPOSIT_SYSTEM.md`

Comprehensive guide covering:
- System architecture and bike status flows
- Transaction types and states
- Complete API endpoint documentation
- Payment flow diagrams
- Database schema details
- Frontend integration examples
- Testing checklist
- Future enhancement ideas

---

## Key Features Implemented

### ✅ Deposit Transaction Creation
- Buyers can reserve bikes with 10-30% deposit
- Automatic notes generation showing percentage and remaining amount
- Flexible deposit amounts within the 10-30% range

### ✅ Reservation Status
- Bikes become `reserved` when deposit is paid
- Reserved bikes are hidden from other buyers' searches
- Only the depositing buyer can proceed to pay remaining balance

### ✅ Remaining Payment Flow
- NEW endpoint: `POST /api/payment/v1/create-remaining/:depositTransactionId`
- Creates a separate transaction record for the remaining balance
- Tracks relationship between deposit and remaining payment in transaction notes

### ✅ Intelligent IPN Handling
- Detects payment type (deposit vs remaining vs full)
- Sets appropriate bike status at each stage:
  - Deposit payment → `reserved`
  - Remaining payment → `sold`
  - Full payment → `sold`
- Updates audit trail when remaining payment is processed

### ✅ Search Filtering (Already Implemented)
- Buyers only see `approved` bikes
- Reserved bikes are already excluded from search results
- No changes needed to search logic

### ✅ Two-Phase Payment Tracking
- Deposit transaction links to remaining transaction via notes
- Maintains full audit trail of payment history
- VNPay transaction numbers and bank info recorded

---

## Testing Guide

### Test Case 1: Deposit Then Complete
```bash
1. Create deposit transaction (10%)
   POST /api/buyer/v1/transactions
   { bikeId, amount: price*0.1, transactionType: 'deposit' }

2. Create payment URL for deposit
   POST /api/payment/v1/create/:transactionId
   → Get paymentUrl

3. Simulate VNPay callback
   GET /api/payment/v1/vnpay-ipn?vnp_TxnRef=...
   → Bike status should be 'reserved'

4. Create remaining payment URL
   POST /api/payment/v1/create-remaining/:depositTransactionId
   → Get paymentUrl for remaining balance

5. Simulate VNPay callback for remaining
   GET /api/payment/v1/vnpay-ipn?vnp_TxnRef=...
   → Bike status should be 'sold'
```

### Test Case 2: Verify Search Exclusion
```bash
1. Create deposit and pay (bike→reserved)
2. Search for bikes as different buyer
   GET /api/buyer/v1/bikes/search
   → Reserved bike should NOT appear

3. Check with original buyer
   GET /api/payment/v1/status/:transactionId
   → Should show transaction with remainingBalance
```

### Test Case 3: Error Cases
```bash
1. Deposit < 10%
   → Error with minimum amount shown

2. Deposit > 30%
   → Error with maximum amount shown

3. Try remaining payment on non-deposit
   → Error: "Giao dịch này không phải đặt cọc"

4. Try remaining payment on pending deposit
   → Error: "Giao dịch phải ở trạng thái completed"
```

---

## Code Improvements Made

### 1. **Comprehensive Logging**
Added detailed console logs at each IPN stage:
```typescript
[VNPay IPN] Received IPN callback
[VNPay IPN] ✓ Signature verified
[VNPay IPN] txnRef: ...
[VNPay IPN] Found linked deposit transaction: ...
[VNPay IPN] Set bike to RESERVED/SOLD
```

### 2. **Audit Trail**
Remaining payments store relationship:
```typescript
notes: "Thanh toán phần còn lại của đơn đặt cọc: [depositTransactionId]"
```

### 3. **Type Safety**
New transaction type added to constants and validated at all checkpoints

### 4. **Clear Error Messages**
All validation errors include user-friendly Vietnamese messages with actionable information

### 5. **Idempotent Payments**
IPN handler safely handles duplicate callbacks

---

## Database Considerations

**No migration required!** The 'reserved' status is already supported by the existing:
```typescript
status: varchar('status', { length: 50 })
```

**Existing migrations handle:**
- `0004_add_transaction_types.sql`: Adds `transaction_type` and `remaining_balance` columns
- Already applied with previous implementation

---

## API Endpoint Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/buyer/v1/transactions` | POST | Create transaction (deposit/full) | ✅ Existing |
| `/api/payment/v1/create/:transactionId` | POST | Get payment URL (deposit/full) | ✅ Existing |
| **`/api/payment/v1/create-remaining/:transactionId`** | **POST** | **Get payment URL (remaining)** | **✨ NEW** |
| `/api/payment/v1/vnpay-return` | GET | VNPay return (browser redirect) | ✅ Updated |
| `/api/payment/v1/vnpay-ipn` | GET | VNPay IPN callback (server) | ✅ Updated |
| `/api/payment/v1/status/:transactionId` | GET | Check transaction status | ✅ Existing |

---

## Validation Rules Implemented

### Deposit Creation
- ✅ Amount between 10-30% of bike price
- ✅ Bike must be in `approved` status
- ✅ Buyer cannot be seller
- ✅ No duplicate pending transactions for same buyer+bike
- ✅ Automatic remainingBalance calculation

### Remaining Payment
- ✅ Original transaction must exist
- ✅ Must be `deposit` type
- ✅ Must be `completed` status (deposit was paid)
- ✅ Must have remainingBalance > 0

### IPN Verification
- ✅ VNPay signature validation
- ✅ Amount verification
- ✅ Duplicate transaction check
- ✅ Transaction status check

---

## Security Considerations

1. **JWT Authentication** - Remaining payment endpoint protected with `isAuthenticated` middleware
2. **Signature Verification** - VNPay IPN validations checksum using SHA512
3. **User Ownership** - Transactions can only be accessed by buyer
4. **Amount Validation** - Deposit amounts strictly enforced server-side
5. **Idempotency** - Duplicate IPN callbacks safely handled

---

## Performance Impact

**Minimal:** 
- One additional database query when processing remaining payment (to extract deposit transaction ID)
- Bike status updates remain the same (single UPDATE per payment)
- No new database indexes needed

---

## Next Steps for Your Team

1. **Run migrations:** `npm run db:push`
2. **Test all scenarios** using the test cases above
3. **Update frontend** with remaining payment UI
4. **Configure VNPay** IPN URL in merchant portal (if not already done)
5. **Deploy** to staging for QA testing

---

## Files NOT Modified (Still Work as Before)

- ✅ `src/controllers/buyerController.ts` - Deposit logic unchanged
- ✅ `src/controllers/sellerController.ts` - No changes needed
- ✅ `src/controllers/authController.ts` - No changes
- ✅ `src/controllers/inspectorController.ts` - No changes  
- ✅ `src/controllers/adminController.ts` - No changes
- ✅ `src/models/` - Models unchanged
- ✅ `src/middleware/` - Middleware unchanged

---

## Improvements Over Original Design

| Aspect | Before | After | Benefit |
|--------|--------|-------|---------|
| Deposit payment | → Immediately 'sold' | → 'reserved' | Other buyers know bike is reserved, not sold |
| Remaining payment | Not possible | ✨ NEW endpoint | Buyers can delay final payment |
| Status clarity | Ambiguous | Clear flow | Better UX and audit trail |
| Audit trail | VNPay data only | Transaction linking | Trace full payment history |
| Error messages | Limited | Detailed Vietnamese | User-friendly feedback |
| Logging | Basic | Comprehensive | Easier debugging |

---

## Known Limitations & Future Work

1. **Deposit Expiration** (Not implemented)
   - Deposits currently never expire
   - Could add logic to auto-cancel after X days

2. **Partial Remaining Payments** (Not implemented)
   - Currently only supports full remaining amount
   - Could allow overpayment/partial amounts

3. **Multiple Deposit Queue** (Not implemented)
   - Currently only one buyer can deposit per bike
   - Could implement queue system

4. **Deposit Cancellation** (Not implemented)
   - No way to cancel completed deposit and get refund
   - Could add buyer/seller initiated cancellation

5. **Email Notifications** (Not implemented)
   - No notifications for remaining balance due
   - Could add reminders

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Mar 18, 2026 | 🎉 Initial implementation of deposit + remaining payment system |

---

## Support & Questions

For issues or questions:
1. Check `DEPOSIT_SYSTEM.md` for detailed documentation
2. Review test cases above
3. Check console logs from IPN callbacks
4. Verify VNPay merchant settings match `.env` configuration
