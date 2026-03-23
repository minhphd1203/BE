# Transaction Flow Analysis & Verification

## Current Implementation Summary

Your system implements a **two-phase payment model** with two distinct payment paths:

---

## Flow 1: FULL PAYMENT (100% Immediate Payment)

### Sequence Diagram
```
Buyer                          Backend                    VNPay              Bike
  │                              │                         │                  │
  ├─ Create Transaction ────────►│                         │                  │
  │ (transactionType: 'full_payment',                      │                  │
  │  amount: bike.price)         │                         │                  │
  │                              ├─ Save transaction ─────►│                  │
  │                              │ (status: 'pending')     │                  │
  │                              │ (bike status: 'approved')                  │
  │                              │                         │                  │
  ├─ Seller Approves ───────────►│                         │                  │
  │                              ├─ Update status ────────►│                  │
  │                              │ (status: 'approved')    │                  │
  │                              │                         │                  │
  ├─ Request Payment URL ───────►│                         │                  │
  │ (POST /payment/v1/create)    │                         │                  │
  │                              ├─ Check status ─────────►│                  │
  │                              │ (must be 'approved')    │                  │
  │◄─ Get paymentUrl ────────────┤                         │                  │
  │ (VNPay redirect URL)         │                         │                  │
  │                              │                         │                  │
  ├─ Redirect to VNPay URL ──────────────────────────────►│                  │
  │ (browserRedirect)            │                         │                  │
  │                              │                         ├─ Process Payment │
  │                              │                         │                  │
  │◄────────────────────────────────────── VNPay Success ─┤                  │
  │ (Redirect to returnUrl)      │                         │                  │
  │                              │◄── IPN Callback ────────┤                  │
  │                              │ (Server-to-server)      │                  │
  │                              │ Verify signature        │                  │
  │                              │ Update transaction to   │                  │
  │                              │ 'completed'             │                  │
  │                              ├─ Update bike status ───────────────────────┤
  │                              │ (status: 'sold')        │                  │
  │◄─ Poll status ────────────────────────────────────────────────────────────┤
  │                              │                         │                  │
  └──────────────────────────────┴────────────────────────┴──────────────────┘

Result: 1 TRANSACTION created, 1 PAYMENT made, bike = SOLD
```

### Database State Flow
```
t=0 (Buyer creates transaction)
transactions table:
├─ id: txn-001
├─ bikeId: bike-123
├─ buyerId: buyer-001
├─ amount: 20,000,000 (100% price)
├─ transactionType: 'full_payment'
├─ remainingBalance: 0
├─ status: 'pending'

bikes table:
├─ id: bike-123
└─ status: 'approved'

═════════════════════════════════════════════════════

t=1 (Seller approves)
transactions table:
├─ status: 'approved'  ← Seller response

═════════════════════════════════════════════════════

t=2 (Buyer pays via VNPay)
transactions table:
├─ status: 'completed'  ← VNPay IPN
├─ paymentMethod: 'vnpay'

bikes table:
├─ status: 'sold'  ← VNPay IPN
```

---

## Flow 2: DEPOSIT + REMAINING PAYMENT (Two-Phase)

### Sequence Diagram
```
Buyer                          Backend                    VNPay              Bike
  │                              │                         │                  │
  ├─ Create Transaction ────────►│                         │                  │
  │ (transactionType: 'deposit',                           │                  │
  │  amount: 2,000,000 = 10%)    │                         │                  │
  │                              ├─ Calculate remaining ──►│                  │
  │                              │ remainingBalance =      │                  │
  │                              │ 20M - 2M = 18M          │                  │
  │                              ├─ Save transaction ─────►│                  │
  │                              │ (status: 'pending')     │                  │
  │                              │ (bike: 'approved')      │                  │
  │                              │                         │                  │
  ├─ Seller Approves ───────────►│                         │                  │
  │                              ├─ Update status ────────►│                  │
  │                              │ (status: 'approved')    │                  │
  │                              │                         │                  │
  ├─ Request Deposit URL ───────►│                         │                  │
  │ (POST /payment/v1/create)    │                         │                  │
  │                              ├─ Verify status ───────►│                  │
  │                              │ (must be 'approved')    │                  │
  │◄─ Get paymentUrl ────────────┤                         │                  │
  │ (VNPay for deposit)          │                         │                  │
  │                              │                         │                  │
  ├─ Redirect to VNPay URL ──────────────────────────────►│                  │
  │                              │                         ├─ Process Deposit│
  │                              │                         │ (2,000,000)      │
  │                              │                         │                  │
  │◄────────────────────────────────── VNPay Success ─────┤                  │
  │                              │                         │                  │
  │                              │◄── IPN Callback ────────┤                  │
  │                              │ Verify signature        │                  │
  │                              │ Update deposit txn to   │                  │
  │                              │ 'completed'             │                  │
  │                              ├─ Update bike status ───────────────────────┤
  │                              │ (status: 'reserved')    │                  │
  │                              │ ← NOT sold yet!         │                  │
  │                              │                         │                  │
  │                              │                         │                  │
  │ ~~~ BUYER COMES BACK LATER ~~│                         │                  │
  │                              │                         │                  │
  ├─ Request Remaining URL ─────►│                         │                  │
  │ (POST /payment/v1/            │                         │                  │
  │  create-remaining/txn-001)    │                         │                  │
  │                              ├─ Check deposit txn ───► │                  │
  │                              │ (must be: 'completed',  │                  │
  │                              │  type: 'deposit',       │                  │
  │                              │  remainingBalance > 0)  │                  │
  │                              │                         │                  │
  │                              ├─ Delete old pending ───►│                  │
  │                              │ remaining payments      │                  │
  │                              │                         │                  │
  │                              ├─ CREATE NEW TXN ──────►│                  │
  │                              │ (NEW ID: txn-002)       │                  │
  │                              │ (type: 'remaining_      │                  │
  │                              │  payment')              │                  │
  │                              │ (amount: 18,000,000)    │                  │
  │                              │ (status: 'pending')     │                  │
  │                              │ (notes reference txn-001)                  │
  │◄─ Get remaining paymentUrl ──┤                         │                  │
  │ (VNPay for 18M)              │                         │                  │
  │                              │                         │                  │
  ├─ Redirect to VNPay URL ──────────────────────────────►│                  │
  │                              │                         ├─ Process Second │
  │                              │                         │ Payment (18M)    │
  │                              │                         │                  │
  │◄────────────────────────────────── VNPay Success ─────┤                  │
  │                              │                         │                  │
  │                              │◄── IPN Callback ────────┤                  │
  │                              │ Verify signature        │                  │
  │                              │ Update remaining txn    │                  │
  │                              │ to 'completed'          │                  │
  │                              │                         │                  │
  │                              ├─ Update original ─────►│                  │
  │                              │ deposit txn notes       │                  │
  │                              │ to mark "fully_paid"    │                  │
  │                              │                         │                  │
  │                              ├─ Update bike status ───────────────────────┤
  │                              │ (status: 'sold')        │                  │
  │                              │ ← NOW fully sold!       │                  │

Result: 2 TRANSACTIONS created, 2 PAYMENTS made, bike = SOLD
```

### Database State Flow
```
t=0 (Buyer creates deposit transaction)
transactions table:
├─ id: txn-001
├─ bikeId: bike-123
├─ buyerId: buyer-001
├─ amount: 2,000,000 (10% = deposit)
├─ transactionType: 'deposit'
├─ remainingBalance: 18,000,000  ◄─── KEY: remaining amount stored
├─ status: 'pending'
├─ notes: "Đặt cọc 10.0% (2,000,000)..."

bikes table:
├─ id: bike-123
└─ status: 'approved'

═════════════════════════════════════════════════════

t=1 (Seller approves deposit)
transactions table:
├─ status: 'approved'

═════════════════════════════════════════════════════

t=2 (Buyer pays deposit via VNPay IPN)
transactions table (txn-001):
├─ status: 'completed'
├─ paymentMethod: 'vnpay'

bikes table:
├─ status: 'reserved'  ◄─── RESERVED, not SOLD yet!

═════════════════════════════════════════════════════

t=3 (Buyer comes back to pay remaining balance)
transactions table:
├─ id: txn-002  ◄─── NEW TRANSACTION CREATED
├─ bikeId: bike-123
├─ buyerId: buyer-001
├─ amount: 18,000,000  ◄─── Remaining balance from txn-001
├─ transactionType: 'remaining_payment'  ◄─── Type signals 2nd phase
├─ remainingBalance: 0  ◄─── No further balance
├─ status: 'pending'
├─ notes: "Thanh toán phần còn lại của đơn đặt cọc: txn-001"

═════════════════════════════════════════════════════

t=4 (Buyer pays remaining balance via VNPay IPN)
transactions table:
├─ txn-001 (deposit):
│  └─ notes: "... → FULLY PAID by remaining payment"  (appended)
│
├─ txn-002 (remaining_payment):
│  └─ status: 'completed'
│     └─ paymentMethod: 'vnpay'

bikes table:
├─ status: 'sold'  ◄─── FULLY SOLD now
```

---

## Key Differences

| Aspect | Full Payment | Deposit + Remaining |
|--------|--------------|-------------------|
| **Transactions Created** | 1 | 2 |
| **Phase 1 Type** | `full_payment` (100%) | `deposit` (10-30%) |
| **Phase 2 Type** | None | `remaining_payment` (balance) |
| **Bike Status After Phase 1** | `sold` | `reserved` |
| **Bike Status After Phase 2** | N/A | `sold` |
| **When Phase 2 Triggers** | N/A | Buyer-initiated later |
| **Payment Links Tracked** | Single txn ID | Via notes field (reference) |

---

## Answer to Your Questions

### ❓ **Question 1: Does the remaining payment create a new order/transaction?**

**✅ YES, absolutely.**

The code explicitly creates a **new transaction record** in `createRemainingPaymentUrl()`:

```typescript
const [remainingTransaction] = await db
  .insert(transactions)  // ← NEW INSERT = NEW transaction
  .values({
    bikeId: depositTransaction.bikeId,
    buyerId,
    sellerId: depositTransaction.sellerId,
    amount: depositTransaction.remainingBalance,  // ← Use remaining from deposit
    transactionType: 'remaining_payment',  // ← Different type
    remainingBalance: 0,
    notes: `Thanh toán phần còn lại của đơn đặt cọc: ${transactionId}`,
    status: 'pending',
  })
  .returning();
```

**Why a new transaction?**
- Tracks each payment separately in the database
- Different `transactionType` allows system to distinguish phase 1 vs phase 2
- Separate `status` tracking for audit trail
- Notes field links back to original deposit transaction
- Each payment can be refunded independently if needed

---

### ❓ **Question 2: What happens to bike status at each step?**

**Full Payment Flow:**
```
Bike Status: approved → (payment) → sold
```

**Deposit + Remaining Flow:**
```
Bike Status: approved → (deposit paid) → reserved → (remaining paid) → sold
```

The `reserved` status is crucial—it signals:
- Deposit has been paid ✓
- Buyer has priority (cannot sell to another buyer) ✓
- But final payment is still pending ⏳
- Buyer can still cancel if needed

---

### ❓ **Question 3: Is the flow currently correct?**

**✅ YES, the current implementation is well-designed:**

1. ✅ Order (transaction) created BEFORE payment
2. ✅ Buyer chooses payment type (full vs deposit)
3. ✅ Seller approval required before payment
4. ✅ Full payment: direct to sold
5. ✅ Deposit: reserves bike, then remaining payment completes sale
6. ✅ Remaining payment creates separate transaction with proper linkage
7. ✅ IPN handler correctly updates both transaction AND bike status
8. ✅ Idempotent checks prevent double-payments

---

## Potential Enhancements (Optional)

1. **Add explicit reference field** in schema instead of parsing notes:
   ```typescript
   linkedTransactionId?: uuid('linked_transaction_id')  // Reference to deposit txn
   ```

2. **Add phase tracking** to make logic clearer:
   ```typescript
   paymentPhase: 'phase_1' | 'phase_2' | null
   ```

3. **IPN return to frontend** pattern:
   - Current: VNPay redirects to frontend manually
   - Could: IPN returns payment state to frontend via WebSocket

4. **Cancel/Refund flow** for deposits:
   - Document when deposits can be refunded
   - Transition bikes from `reserved` back to `approved`

---

## Testing Checklist

When testing the deposit flow, verify:

- [ ] Deposit transaction created with correct `remainingBalance`
- [ ] Bike status changes to `reserved` after deposit IPN
- [ ] Can create remaining payment transaction
- [ ] Remaining transaction has correct amount (= original `remainingBalance`)
- [ ] Bike status changes to `sold` after remaining payment IPN
- [ ] Original deposit transaction notes are updated with "FULLY PAID"
- [ ] Both transactions visible in buyer's transaction history
- [ ] Cannot create second remaining payment for same deposit
- [ ] Cannot create remaining payment if deposit not completed

