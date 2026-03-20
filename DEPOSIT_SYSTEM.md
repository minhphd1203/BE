# Deposit & Reservation System

## Overview

The deposit system allows buyers to pay a partial amount (10-30% of bike price) to reserve a bike, then pay the remaining balance later. This provides a two-phase payment flow for customers while protecting seller interests.

## System Architecture

### Bike Status Flow

```
pending → approved → [active listing]
                        ↓
                    (buyer deposits)
                        ↓
                     reserved ← (deposit paid, buyer has priority)
                        ↓
                    (buyer pays remaining)
                        ↓
                      sold ← (final payment received)
                        
OR (full payment)
                    approved → sold
```

### Transaction Types

| Type | Amount | Status Flow | Bike Status | Use Case |
|------|--------|-------------|------------|----------|
| `full_payment` | 100% of price | pending → completed | approved → sold | Immediate purchase |
| `deposit` | 10-30% of price | pending → completed | approved → reserved | Secure with deposit |
| `remaining_payment` | Remaining balance | pending → completed | reserved → sold | After deposit payment |

### Transaction States

```typescript
// Created by buyer
{
  id: uuid,
  bikeId: uuid,
  buyerId: uuid,
  sellerId: uuid,
  amount: 2000000 (10% of 20M bike),
  transactionType: 'deposit',
  remainingBalance: 18000000,
  status: 'pending',
  notes: "Đặt cọc 10.0% (2000000) để giữ xe. Còn lại 18000000 cần thanh toán khi nhận xe.",
  createdAt: timestamp
}

// After VNPay deposit payment succeeds (IPN)
{
  ...
  status: 'completed',
  paymentMethod: 'vnpay',
  updatedAt: timestamp
}

// Bike status after deposit payment
{
  status: 'reserved', // Not 'sold' - still available to seller, reserved for buyer
}

// When buyer pays remaining (creates new transaction)
{
  id: uuid (different from deposit),
  bikeId: uuid,
  buyerId: uuid,
  sellerId: uuid,
  amount: 18000000 (remaining balance),
  transactionType: 'remaining_payment',
  remainingBalance: null,
  status: 'pending',
  notes: "Thanh toán phần còn lại của đơn đặt cọc: [depositTransactionId]",
  createdAt: timestamp
}

// After VNPay remaining payment succeeds (IPN)
{
  ...
  status: 'completed',
  paymentMethod: 'vnpay',
  updatedAt: timestamp
}

// Bike status after remaining payment completes
{
  status: 'sold', // Now fully paid and sold
}
```

## API Endpoints

### 1. Create Deposit Transaction

**Endpoint:** `POST /api/buyer/v1/transactions`

**Request:**
```json
{
  "bikeId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 2000000,
  "transactionType": "deposit",
  "paymentMethod": "vnpay",
  "notes": "Optional notes"
}
```

**Validation:**
- `amount` must be between 10-30% of bike price
- Bike must be in `approved` status
- Buyer cannot be the seller
- No existing pending transaction for this bike by this buyer

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transaction-id",
    "bikeId": "bike-id",
    "buyerId": "buyer-id",
    "sellerId": "seller-id",
    "amount": 2000000,
    "transactionType": "deposit",
    "remainingBalance": 18000000,
    "status": "pending",
    "notes": "Đặt cọc 10.0% (2000000) để giữ xe. Còn lại 18000000 cần thanh toán khi nhận xe."
  },
  "message": "Đặt cọc thành công. Bạn có ưu tiên mua xe này."
}
```

### 2. Create Payment URL for Deposit

**Endpoint:** `POST /api/payment/v1/create/:transactionId`

**Purpose:** Generate VNPay payment URL for the deposit amount

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/...",
    "transactionId": "transaction-id",
    "amount": 2000000,
    "orderInfo": "ThanhToanXeDap-a1b2c3d4"
  }
}
```

### 3. Create Payment URL for Remaining Balance (NEW)

**Endpoint:** `POST /api/payment/v1/create-remaining/:transactionId`

**Purpose:** After deposit is paid, generate payment URL for the remaining balance

**Parameters:**
- `transactionId`: The ID of the DEPOSIT transaction (not remaining)

**Validation:**
- Transaction must exist and belong to buyer
- Transaction must be `deposit` type
- Transaction must have status `completed` (deposit already paid)
- `remainingBalance` must be > 0

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/...",
    "remainingTransactionId": "new-transaction-id",
    "depositTransactionId": "original-deposit-id",
    "remainingBalance": 18000000,
    "depositAmount": 2000000,
    "totalPrice": 20000000,
    "orderInfo": "ThanhToanConLai-a1b2c3d4"
  }
}
```

### 4. VNPay IPN Callback (Server-to-Server)

**Endpoint:** `GET /api/payment/v1/vnpay-ipn`

**Process:**
1. Verify VNPay signature
2. Find transaction in database
3. Validate amount matches
4. Update transaction status to `completed`
5. **NEW:** Determine bike status based on transaction type:
   - If `deposit`: Set bike to `reserved` (awaiting remaining payment)
   - If `full_payment`: Set bike to `sold` (fully paid)
   - If `remaining_payment`: Set bike to `sold` (deposit + remaining = complete)
6. If `remaining_payment`: Update original deposit transaction notes (for audit)

### 5. Check Payment Status

**Endpoint:** `GET /api/payment/v1/status/:transactionId`

**Returns:** Current transaction details including status and remaining balance

## Search & Browse (Updated)

### Buyer Search

**Endpoint:** `GET /api/buyer/v1/bikes/search`

**Filters Applied:**
- Only shows bikes with status = `approved`
- Does NOT show `reserved` bikes (reserved for other buyers)
- Does NOT show `sold` bikes

**Why?** When a buyer deposits, the bike is reserved specifically for them. Other browsers shouldn't see it until that buyer completes payment or abandons their deposit.

## Payment Flow Diagrams

### Scenario 1: Full Payment (Unchanged)

```
Buyer
  ↓
POST /api/buyer/v1/transactions (full_payment, amount=20M)
  ↓ Transaction created (status: pending)
POST /api/payment/v1/create/:transactionId
  ↓ Get payment URL
(Redirect to VNPay)
  ↓ Pay 20M
VNPay IPN Callback
  ↓ Verify signature & amount
Update transaction (status: completed)
Update bike (status: sold)
  ↓
Bike removed from searches (status != approved)
```

### Scenario 2: Deposit + Remaining (NEW)

```
Buyer
  ↓
POST /api/buyer/v1/transactions (deposit, amount=2M)
  ↓ Transaction created with remainingBalance=18M
POST /api/payment/v1/create/:transactionId
  ↓ Get payment URL for 2M
(Redirect to VNPay)
  ↓ Pay 2M
VNPay IPN Callback
  ↓ Verify signature & amount
Update transaction (status: completed)
Update bike (status: reserved) ← CHANGE: was 'sold', now 'reserved'
  ↓
Bike hidden from other buyers (not in 'approved' results)
  ↓ [Later when buyer ready to pay remaining]
POST /api/payment/v1/create-remaining/:depositTransactionId
  ↓ Creates NEW remaining_payment transaction
  ↓ Get payment URL for 18M
(Redirect to VNPay)
  ↓ Pay 18M
VNPay IPN Callback
  ↓ Verify signature & amount
Update remaining_payment transaction (status: completed)
Update original deposit transaction notes (audit trail)
Update bike (status: sold) ← CHANGE: now fully paid
  ↓
Transaction complete
```

## Database Schema

### Bikes Table (Updated Comment)

```typescript
bikes.status: varchar(50)
// Values: 'pending', 'approved', 'rejected', 'hidden', 'reserved', 'sold'
// - pending: New listing, awaiting admin approval
// - approved: Admin approved, available for purchase
// - rejected: Admin rejected
// - hidden: Seller downgraded from seller role
// - reserved: Buyer paid deposit, awaiting remaining payment
// - sold: Transaction complete (full payment OR deposit+remaining paid)
```

### Transactions Table (Updated)

**New Column `remaining_balance`:**
```typescript
remainingBalance: double precision | null
// For deposits: remaining amount after deposit paid
// For full_payment: null
// For remaining_payment: null
```

**New Transaction Type:**
```typescript
transactionType: 'full_payment' | 'deposit' | 'remaining_payment'
```

## Improvements & Features

### 1. Two-Phase Payments
- Buyers can secure interest with partial payment
- Sellers get commitment from buyers
- Flexible timeline for final payment

### 2. Automatic Notes Generation
- Deposit: Shows percentage, amount, and remaining due
- Generated format: "Đặt cọc 10.0% (2000000) để giữ xe. Còn lại 18000000 cần thanh toán khi nhận xe."

### 3. Audit Trail
- Remaining payments linked to original deposit transactions
- Notes track the payment history
- VNPay transaction numbers recorded

### 4. Idempotent Payments
- IPN handler checks for duplicate transactions
- Safe to retry VNPay callbacks

### 5. Auto Calculation
- 10-30% range enforced server-side
- Invalid deposits rejected with minimum/maximum amounts shown
- Remaining balance calculated automatically

## Error Handling

### Deposit Validation Errors

```json
{
  "success": false,
  "message": "Deposit too low. Minimum deposit is 10% of bike price: 2000000",
  "minimumDeposit": 2000000,
  "minimumPercentage": "10%"
}
```

```json
{
  "success": false,
  "message": "Deposit too high. Maximum deposit is 30% of bike price: 6000000",
  "maximumDeposit": 6000000,
  "maximumPercentage": "30%"
}
```

### Remaining Payment Validation Errors

```json
{
  "success": false,
  "message": "Giao dịch này không phải đặt cọc"
}
```

```json
{
  "success": false,
  "message": "Giao dịch phải ở trạng thái completed (hiện tại: pending)"
}
```

## Frontend Integration

### React Example

```tsx
// Step 1: Create deposit
const depositRes = await fetch('/api/buyer/v1/transactions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bikeId,
    amount: bike.price * 0.1, // 10% deposit
    transactionType: 'deposit'
  })
});
const { data: depositTxn } = await depositRes.json();

// Step 2: Get deposit payment URL
const paymentRes = await fetch(`/api/payment/v1/create/${depositTxn.id}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: { paymentUrl } } = await paymentRes.json();

// Step 3: Redirect to VNPay
window.location.href = paymentUrl;

// Step 4: After payment, VNPay redirects back with params
// Frontend catches redirect and shows success page

// Step 5: When buyer ready for remaining payment
const remainingRes = await fetch(`/api/payment/v1/create-remaining/${depositTxn.id}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: remainingPayment } = await remainingRes.json();

// Step 6: Redirect to VNPay for remaining payment
window.location.href = remainingPayment.paymentUrl;
```

## Testing Checklist

- [ ] Create deposit transaction with 10% amount
- [ ] Create deposit transaction with 30% amount
- [ ] Reject deposit with < 10% amount
- [ ] Reject deposit with > 30% amount
- [ ] VNPay IPN for deposit sets bike to 'reserved'
- [ ] Create remaining payment URL requires completed deposit
- [ ] VNPay IPN for remaining payment sets bike to 'sold'
- [ ] Reserved bike doesn't appear in buyer search results
- [ ] Buyer can view their deposit transaction status
- [ ] Buyer can view their remaining payment transaction
- [ ] Check that notes auto-generate correctly
- [ ] Verify transaction linking works for deposits

## Future Enhancements

1. **Deposit Expiration**: Auto-cancel deposits if not completed within X days
2. **Deposit Refunds**: Seller can reject deposit, buyer gets refund
3. **Partial Remaining Payments**: Allow paying more than minimum remaining
4. **Multiple Buyer Priority Queue**: Handle multiple deposits for same bike
5. **Payment Reminders**: Email reminders for outstanding remaining balance
6. **Analytics**: Track conversion rate from deposit to full payment

## Migration Notes

**Applied Migrations:**
- `0004_add_transaction_types.sql`: Adds `transaction_type` and `remaining_balance` columns
- `0005_add_reserved_status.sql`: Documentation for 'reserved' status support

**Note:** 'reserved' status is already supported by existing `bikes.status` VARCHAR(50) column. No database changes required.

Run migrations with:
```bash
npm run db:push
```
