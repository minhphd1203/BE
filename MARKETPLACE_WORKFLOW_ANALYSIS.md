# Bike Marketplace Complete Workflow Analysis

## Overview
This document describes the complete lifecycle of a bike from listing to sale, including all status transitions, validations, and dependencies between workflows.

---

## 1. BIKE LISTING WORKFLOW

### Entry Point
- **API Endpoint:** `POST /api/seller/v1/bikes`
- **Controller:** `sellerController.createBike()`
- **Authentication:** Seller role required

### State Transitions

#### Step 1: Seller Creates Listing
**Status:** `pending` → awaiting admin approval
**Fields Required:**
- `title`, `description`, `brand`, `model`, `year`, `price`, `condition`
- Optional: `mileage`, `color`, `images`, `video`, `categoryId`

**Initial DB State:**
```
bikes {
  status: 'pending',           // Awaiting admin review
  isVerified: 'not_verified',  // Awaiting inspector verification
  inspectionStatus: 'pending'  // No inspection yet
}
```

**Constraints:**
- `condition` must be one of: `excellent`, `good`, `fair`, `poor`
- `categoryId` must reference valid category if provided
- Seller cannot list their own bike multiple times with same details

---

### Step 2: Inspection Workflow Begins
**CRITICAL:** Inspector inspects bikes BEFORE admin approval (with `status: 'pending'`)

Bikes remain in `pending` status while inspector conducts quality assurance.

**See "INSPECTION WORKFLOW" section below for full details**

---

### Step 3: Admin Final Approval
**Endpoint:** `PUT /api/admin/v1/bikes/:id` (Admin Controller)
**Trigger:** AFTER inspector passes the bike
**Possible States:**
1. Approved by admin → `status: 'approved'` (now visible to buyers)
2. Rejected by admin → `status: 'rejected'`

**Key Point:** Bike becomes visible to buyers ONLY after BOTH inspection passes AND admin approves

**Inspector's Perspective (See "INSPECTION WORKFLOW" section below)**

---

### Step 4: Seller Resubmission (Optional)
**Endpoint:** `POST /api/seller/v1/bikes/:id/resubmit`
**Trigger:** When inspection FAILS and seller fixes issues
**Process:**
- Seller corrects bike listing information
- Sets `status: 'pending'` (back to admin review)
- Inspector can compare new vs. previous findings

---

### Seller Bike Status Lifecycle

```
pending (Seller creates listing)
  ↓
pending (Inspector inspects - BEFORE admin approval) ← CRITICAL WORKFLOW ORDER
  ↓
If inspection PASSED:
  isVerified: verified
  ↓ (Admin approves)
  approved (now visible to buyers)
  ↓ (Buyer purchases)
  reserved (deposit paid) or sold (full payment)

If inspection FAILED:
  isVerified: failed
  status: rejected (auto-rejected, seller can resubmit)
  ↓ (Seller fixes and resubmits)
  pending (back to inspection queue - inspector inspects again)
```

---

## 2. BUYER WORKFLOW

### Entry Point 1: Search & Browse
- **Endpoint:** `GET /api/buyer/v1/bikes/search`
- **Controller:** `buyerController.searchBikes()`

**Query Parameters:**
- `brand`, `model`: partial string match (case-insensitive)
- `minPrice`, `maxPrice`: price range filtering
- `condition`: exact match (excellent/good/fair/poor)
- `color`: partial match
- `sortBy`: price | year | mileage | createdAt
- `sortOrder`: asc | desc
- `page`, `limit`: pagination

**Visibility Rules:**
- **Everyone sees:** All `approved` bikes
- **Seller sees:** Their own `reserved` bikes
- **Buyer sees:** Bikes they deposited on (`reserved` status)
- **Hidden status:** `pending`, `rejected`, `sold` are NOT visible

**Response includes:**
```
{
  id, title, brand, model, price, condition, year,
  images, status, isVerified, createdAt,
  seller: { id, name, avatar },
  meta: { total, page, limit, totalPages }
}
```

---

### Entry Point 2: Get Bike Details
- **Endpoint:** `GET /api/buyer/v1/bikes/:bikeId`
- **Controller:** `buyerController.getBikeDetail()`

**Restriction:** Only for `approved` bikes

**Response includes:**
- Full bike details
- Seller information & contact
- Inspection history (if completed)
- Category information

---

### Entry Point 3: Create Transaction (Purchase/Deposit)
- **Endpoint:** `POST /api/buyer/v1/transactions`
- **Controller:** `buyerController.createTransaction()`

#### Transaction Types

**Full Payment:**
```
{
  transactionType: 'full_payment',
  amount: bike.price,  // Must equal bike price
  remainingBalance: 0
}
```

**Deposit (10-30% of bike price):**
```
{
  transactionType: 'deposit',
  amount: 1,500,000,        // 10-30% of price
  remainingBalance: 10,500,000
}
```

**Validation Rules:**
- Bike must be `status: 'approved'`
- Buyer cannot purchase own bike
- Buyer can only have ONE pending transaction per bike
- Deposit: must be 10-30% of bike price (auto-calculated remaining balance)

**New Transaction State:**
```
transactions {
  status: 'pending',        // Awaiting seller response
  transactionType: 'full_payment' | 'deposit' | 'remaining_payment',
  amount: calculated,
  remainingBalance: calculated,
  paymentMethod: null       // Set after VNPay
}
```

---

### Entry Point 4: Payment Flow
**See "TRANSACTION/PAYMENT WORKFLOW" section below**

---

### Entry Point 5: Rating System
- **Endpoint:** `POST /api/buyer/v1/reviews`
- **Controller:** `buyerController.addReview()`

**Constraint:** Buyer MUST provide a completed transaction ID

**Validation:**
- Transaction must exist with status = 'completed'
- Transaction must match buyer and seller
- Rating must be 1-5
- Cannot review same transaction twice

**Response:**
```
{
  reviewerId, sellerId, transactionId,
  rating: 1-5, comment, createdAt
}
```

---

### Entry Point 6: Wishlist Management
- **Add:** `POST /api/buyer/v1/wishlist/:bikeId`
- **View:** `GET /api/buyer/v1/wishlist`
- **Remove:** `DELETE /api/buyer/v1/wishlist/:bikeId`

---

### Entry Point 7: Messaging
- **Send:** `POST /api/buyer/v1/message` (to seller)
- **Get:** `GET /api/buyer/v1/message/:userId` (conversation history)

---

## 3. INSPECTION WORKFLOW

### Entry Point: Inspector Dashboard
- **Endpoint:** `GET /api/inspector/v1/dashboard`
- **Shows:** Pending bikes (awaiting inspection), in-progress bikes, completed inspections

---

### Step 1: View Pending Bikes
- **Endpoint:** `GET /api/inspector/v1/bikes/pending`

**Filtering:**
- `status: 'pending'` (bikes NOT YET admin-approved, awaiting inspection)
- `inspectionStatus` ∈ ['pending', 'in_progress']

**CRITICAL:** Inspector inspects bikes BEFORE they go to admin approval

**Optional filters:**
- `search`: by title, brand, model, seller name
- `sort`: newest | oldest | price_asc | price_desc

**Response includes:**
- Bike details
- Seller name & contact
- Category
- inspection history

---

### Step 2: View Bike Detail for Inspection
- **Endpoint:** `GET /api/inspector/v1/bikes/:bikeId`
- **Controller:** `inspectorController.getBikeDetail()`

**Response includes:**
```
{
  bike: { full details },
  inspectionHistory: [ array of past inspections ],
  latestInspection: {  // If resubmitted
    previousStatus: 'passed' | 'failed',
    frameCondition, brakeCondition, drivetrainCondition, wheelCondition,
    overallCondition, inspectionNote, recommendation, inspectedAt
  }
}
```

**Auto-Fill Logic on Resubmit:**
- If bike was resubmitted, `latestInspection` shows PREVIOUS findings
- Inspector can compare: "What did I see before? What's different now?"
- Helps verify seller actually fixed issues

---

### Step 3: Start Inspection
- **Endpoint:** `POST /api/inspector/v1/bikes/:bikeId/start`
- **Sets:** `inspectionStatus: 'in_progress'`

**Validation:**
- Bike cannot already be in `inspectionStatus: 'completed'`

---

### Step 4: Submit Inspection Results
- **Endpoint:** `POST /api/inspector/v1/bikes/:bikeId/submit`
- **Controller:** `inspectorController.submitInspection()`

#### Inspection Form Data
```
{
  status: 'passed' | 'failed',
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor',
  frameCondition: (same options),
  brakeCondition: (same options),
  drivetrainCondition: (same options),
  wheelCondition: (same options),
  inspectionNote: string,
  recommendation: string,
  inspectionImages: [URLs],
  reportFile: URL
}
```

#### Resubmission Constraint: Condition Fields Are LOCKED
**Why:** Inspector's findings represent ACTUAL bike condition, which doesn't change just because seller corrected their listing.

```typescript
// On resubmit, these validations prevent changing condition fields:
if (previousInspection && inspectionData.frameCondition !== previousInspection.frameCondition) {
  return ERROR: "frameCondition is locked. Cannot change from X to Y. Only status can change."
}
// Same for: brakeCondition, drivetrainCondition, wheelCondition, overallCondition
```

**What CAN change on resubmit:**
- `status`: 'passed' → 'failed' or vice versa
- `inspectionNote`: Can add new findings
- `recommendation`: Update for seller

**What CANNOT change:**
- All condition fields (they represent unchanging reality)

#### Auto-Fill on Resubmit
If previous inspection exists:
```typescript
finalInspectionData = {
  frameCondition: inspectionData.frameCondition ?? previousInspection.frameCondition,
  // ...same for all condition fields
  inspectionNote: inspectionData.inspectionNote ?? previousInspection.inspectionNote,
  // ...
}
```

Inspector only needs to update `status` field on resubmit!

---

#### Verification Status Updates

**If Inspection PASSED:**
```
bikes {
  isVerified: 'verified',
  inspectionStatus: 'completed',
  status: 'pending'  // Keep pending, NOW AWAITING FINAL ADMIN APPROVAL
}
Note: Inspector's job done. Admin now reviews and approves → status: 'approved'
```

**If Inspection FAILED:**
```
bikes {
  isVerified: 'failed',
  inspectionStatus: 'completed',
  status: 'rejected'  // Auto-reject (no admin needed)
}
Note: Seller receives rejection and can fix & resubmit for re-inspection
```

---

### Step 5: Inspection History
- **Endpoint:** `GET /api/inspector/v1/inspections`
- Shows all inspections by this inspector
- Filterable by status (passed/failed) or search terms

---

## 4. TRANSACTION/PAYMENT WORKFLOW

### Transaction Status Lifecycle

```
pending
  ↓ (Seller approves offer)
approved
  ↓ (Buyer pays via VNPay)
completed
  ↓ (If deposit: remaining payment needed)
completed (full_payment) or reserved (deposit)
```

Or cancellation:
```
pending/approved → cancelled
```

---

### Transaction Type System

#### 1. Full Payment
- Amount = 100% of bike price
- Single payment completes transaction
- Bike status: `sold` immediately after payment confirmed

#### 2. Deposit (10-30%)
- Amount = 10-30% of bike price
- `remainingBalance` auto-calculated
- Bike status: `reserved` after payment confirmed
- Buyer must later pay remaining balance

#### 3. Remaining Payment (After Deposit)
- Amount = remaining balance from deposit
- Links to original deposit transaction in notes
- Bike status: `sold` after payment confirmed

---

### Payment Flow: Full Payment

```
1. Buyer creates transaction (status: pending)
   payment controller.createTransaction()

2. Buyer requests payment URL
   payment controller.createPaymentUrl()
   
3. Seller approves transaction (status: approved)
   seller controller.updateTransactionStatus()

4. Buyer redirected to VNPay

5. VNPay redirects back to returnUrl (frontend)
   - Shows success/failure UI

6. VNPay calls IPN handler (server-to-server)
   payment.vnpayIPN()
   
7. IPN Handler Updates DB:
   - transaction.status = 'completed'
   - transaction.paymentMethod = 'vnpay'
   - bike.status = 'sold'
   
8. Buyer can now rate seller (transaction is completed)
```

---

### Payment Flow: Deposit + Remaining

```
1. Buyer creates deposit transaction (status: pending)
   - amount: 10-30% of price
   - remainingBalance: calculated

2. Seller approves (status: approved)

3. Buyer pays deposit via VNPay

4. VNPay IPN confirms:
   - transaction.status = 'completed'
   - bike.status = 'reserved'  ← Bike held for this buyer

5. Later: Buyer requests remaining payment URL
   payment.createRemainingPaymentUrl()
   - Creates NEW transaction record (transactionType: 'remaining_payment')
   - new transaction notes: "Paying remaining balance for deposit: [depositId]"
   - new transaction status: 'pending'

6. Buyer pays remaining via VNPay

7. VNPay IPN confirms:
   - remaining transaction.status = 'completed'
   - bike.status = 'sold'  ← Sale finalized
   - original deposit transaction notes updated: "FULLY PAID by remaining payment"

8. Buyer can now rate seller (transaction is completed)
```

---

### Seller Transaction Approval
- **Endpoint:** `PUT /api/seller/v1/transactions/:id`
- **Controller:** `sellerController.updateTransactionStatus()`

**Seller can set:**
- `approved`: Accept buyer's offer, ready for payment
- `cancelled`: Reject buyer's offer

---

### Payment Integration: VNPay

#### Create Payment URL
- **Endpoint:** `POST /api/payment/v1/create/:transactionId`
- **Requirement:** Transaction must be `approved` status
- **Return:** `paymentUrl` to redirect buyer

#### VNPay Return URL
- **Endpoint:** `GET /api/payment/v1/vnpay-return`
- **Purpose:** UX only, shows success/failure message
- **Note:** Frontend reads query params and displays result

#### VNPay IPN (Server-to-Server)
- **Endpoint:** `GET /api/payment/v1/vnpay-ipn`
- **Purpose:** Official payment confirmation
- **No JWT:** VNPay calls directly without token
- **Signature verification:** All requests must pass HMAC-SHA512 check
- **Idempotency:** If already processed, returns "already confirmed"

**IPN Validations:**
1. Signature verification (HMAC-SHA512)
2. Find transaction by txnRef
3. Verify amount matches
4. Check idempotency (prevent duplicate processing)
5. Update transaction and bike status

---

## 5. RATING SYSTEM

### Overview
Buyers rate sellers after completing a transaction.

### Entry Point
- **Endpoint:** `POST /api/buyer/v1/reviews`
- **Controller:** `buyerController.addReview()`

### Constraint (KEY FEATURE)
**Buyer MUST provide a specific completed transaction ID**

```typescript
// VALIDATION: Transaction must exist AND be completed AND match buyer+seller
const tx = await db.query.transactions.findFirst({
  where: and(
    eq(transactions.id, transactionId),
    eq(transactions.buyerId, reviewerId),
    eq(transactions.sellerId, sellerId),
    eq(transactions.status, 'completed')  ← CRITICAL
  ),
});

if (!tx) {
  return ERROR: "Transaction not found, not completed, or doesn't match this buyer+seller"
}
```

### Rating Requirements
- **Scale:** 1-5 stars
- **Comment:** Optional text review
- **One per transaction:** Cannot review same transaction twice

### Review Data Structure
```
reviews {
  id: UUID,
  reviewerId: UUID,        // Buyer
  sellerId: UUID,          // Seller being reviewed
  transactionId: UUID,     // Specific transaction (NOT just any transaction with seller)
  rating: 1-5,
  comment: text,
  createdAt: timestamp
}
```

### Seller Rating Statistics
Calculated from Dashboard:
```typescript
// Average rating calculation in sellerController.getDashboard()
const allReviews = await db
  .select({ rating: reviews.rating })
  .from(reviews)
  .where(eq(reviews.sellerId, sellerId));

const averageRating = 
  allReviews.length > 0
    ? Math.round((sum / count) * 10) / 10
    : 0;
```

### Dependencies
- Rating system depends on Transaction workflow
- Buyer cannot rate until transaction is `completed`
- Provides seller reputation metrics

---

## 6. DEPENDENCY DIAGRAM

```
Registration (User)
  ↓ (becomes Buyer by default)
  
┌─────────────────────────────────────────┐
│ SELLER LISTING WORKFLOW                 │
│ 1. Seller creates bike (status: pending)│
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ INSPECTION WORKFLOW (BEFORE ADMIN)      │
│ 1. Inspector inspects pending bikes     │
│ 2. Inspector submits results            │
│ 3. If passed: isVerified=verified       │
│ 4. If failed: status=rejected           │
└─────────────────────────────────────────┘
           ↓ (if passed)
┌─────────────────────────────────────────┐
│ ADMIN FINAL APPROVAL                    │
│ 1. Admin approves (status: approved)    │
│ 2. Bike now visible to buyers          │
└─────────────────────────────────────────┘
           ↓ (if passed)
┌─────────────────────────────────────────┐
│ BUYER WORKFLOW                          │
│ 1. Search & browse approved bikes      │
│ 2. View bike details                   │
│ 3. Create transaction (full/deposit)   │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ PAYMENT WORKFLOW                        │
│ 1. Get VNPay payment URL               │
│ 2. Buyer redirects to VNPay            │
│ 3. VNPay processes payment             │
│ 4. IPN confirms & updates DB           │
│ 5. Bike status: sold or reserved       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ RATING SYSTEM                           │
│ 1. Transaction must be completed       │
│ 2. Buyer submits review with rating    │
│ 3. Seller reputation updated           │
└─────────────────────────────────────────┘
```

---

## 7. KEY VALIDATION RULES SUMMARY

### Bike Listing
- Condition must be valid enum
- Category must exist (if provided)
- Cannot list same bike twice
- Prices must be positive numbers

### Inspection
- **CRITICAL:** Only PENDING bikes can be inspected (status='pending', BEFORE admin approval)
- Cannot submit if inspectionStatus already 'completed'
- Resubmit condition fields are LOCKED (cannot change)
- Failed inspections auto-reject bike (status='rejected')
- Passed inspections keep bike as pending (status='pending') awaiting final admin approval

### Transaction
- Bike must be approved
- Buyer cannot buy own bike
- Only one pending transaction per buyer per bike
- Deposit must be 10-30% of bike price
- Full payment must equal bike price

### Payment
- Transaction must be approved before payment URL creation
- Payment amount must match transaction amount
- VNPay signature must be valid (HMAC-SHA512)
- Transactionstatus must be updated atomically with bike status

### Rating
- Transaction must exist and be completed
- Must match buyer + seller
- Rating must be 1-5
- Only one review per transaction

---

## 8. AUTO-FILL & SYNCHRONIZATION LOGIC

### Inspection Resubmission Auto-Fill
**File:** `inspectorController.submitInspection()`

When inspector submits on a resubmitted bike:
```typescript
// Auto-fill all fields from previous inspection
const finalInspectionData = {
  frameCondition: inspectionData.frameCondition ?? previousInspection.frameCondition,
  brakeCondition: inspectionData.brakeCondition ?? previousInspection.brakeCondition,
  drivetrainCondition: inspectionData.drivetrainCondition ?? previousInspection.drivetrainCondition,
  wheelCondition: inspectionData.wheelCondition ?? previousInspection.wheelCondition,
  overallCondition: inspectionData.overallCondition ?? previousInspection.overallCondition,
  inspectionNote: inspectionData.inspectionNote ?? previousInspection.inspectionNote,
  recommendation: inspectionData.recommendation ?? previousInspection.recommendation,
};
```

**Result:** Inspector only needs to change `status` field on resubmit!

### Transaction Linked Records
When remaining payment created:
```typescript
// Store reference to original deposit in notes
remainingTransaction.notes = `Thanh toán phần còn lại của đơn đặt cọc: ${depositTransactionId}`;

// On payment completion, update original deposit notes
originalDeposit.notes += ` → FULLY PAID by remaining payment`;
```

### Bike Status Synchronization
**File:** `paymentController.vnpayIPN()`

When payment completed:
```typescript
// Atomic update: transaction + bike status together
if (transaction.transactionType === 'full_payment') {
  bike.status = 'sold';
} else if (transaction.transactionType === 'deposit') {
  bike.status = 'reserved';
} else if (transaction.transactionType === 'remaining_payment') {
  bike.status = 'sold';  // Finalize sale
}
```

---

## 9. STATUS FIELD REFERENCE

### Bike Status Values
```
'pending'     → Awaiting admin approval (after seller lists or resubmits)
'approved'    → Admin approved, ready for inspection or purchase
'reserved'    → Deposit paid, awaiting remaining payment
'sold'        → Fully paid, transaction complete
'rejected'    → Failed inspection or admin rejected
'hidden'      → Seller manually hid listing
```

### Bike isVerified Values
```
'not_verified'  → No inspection attempted yet
'verified'      → Inspector confirmed bike matches listing
'failed'        → Inspector found issues, bike rejected
```

### Bike inspectionStatus Values
```
'pending'       → Awaiting inspection
'in_progress'   → Inspector started but not completed
'completed'     → Inspector submitted results
```

### Transaction Status Values
```
'pending'       → Awaiting seller approval
'approved'      → Seller approved, ready for buyer to pay
'completed'     → Payment processed successfully
'cancelled'     → Buyer or seller cancelled
```

### Transaction Type Values
```
'full_payment'      → Single payment for full bike price
'deposit'           → Partial payment (10-30%), bike reserved
'remaining_payment' → Final payment after deposit
```

### Review/Rating Status
Reviews have no status field - they represent completed ratings only.

---

## 10. ERROR HANDLING & EDGE CASES

### Inspection Resubmission Prevention
**Case:** Inspector tries to change condition field on resubmit
**Error:** 400 - "frameCondition is locked on resubmit..."
**Solution:** Only `status` and notes can change on resubmit

### Duplicate Payment Processing
**Case:** VNPay IPN arrives twice
**Idempotency Check:**
```typescript
if (transaction.status === 'completed') {
  return RspCode: '02', Message: 'Order already confirmed'
}
```

### Inconsistent Deposit Remaining Payment
**Case:** Buyer tries to pay remaining balance before deposit completed
**Validation:**
```typescript
if (depositTransaction.status !== 'completed') {
  return ERROR: "Transaction must be completed first"
}
```

### Rating Without Valid Transaction
**Case:** Buyer tries to rate without completed transaction
**Validation:**
```typescript
if (!tx || tx.status !== 'completed') {
  return ERROR: "Transaction must exist and be completed"
}
```

---

## 11. AUDIT TRAIL

### Transaction Notes Field
Used to track history:

**Deposit Example:**
```
Original:  "Đặt cọc 20% (500000) để giữ xe. Còn lại 2000000 cần thanh toán"
After IPN: "...| VNPay TxnNo: 123456, Bank: BIDV"
```

**Remaining Payment Example:**
```
"Thanh toán phần còn lại của đơn đặt cọc: [depositId] | VNPay TxnNo: 789012, Bank: TPBANK"
```

**Original Deposit Updated After Remaining Paid:**
```
"...| → FULLY PAID by remaining payment"
```

---

## 12. ROLE & PERMISSION MATRIX

| Operation | Buyer | Seller | Inspector | Admin |
|-----------|-------|--------|-----------|-------|
| Create bike listing | ✗ | ✓ | ✗ | ✓ |
| Approve/reject bike | ✗ | ✗ | ✗ | ✓ |
| Inspect bike | ✗ | ✗ | ✓ | ✗ |
| Search bikes | ✓ | ✓ | ✓ | ✓ |
| Create transaction | ✓ | ✗ | ✗ | ✗ |
| Approve transaction | ✗ | ✓ | ✗ | ✗ |
| Create payment | ✓ | ✗ | ✗ | ✗ |
| Add review | ✓ | ✗ | ✗ | ✗ |
| Send message | ✓ | ✓ | ✗ | ✗ |

---

## 13. WORKFLOW ILLUSTRATIONS

### Complete Purchase Flow (Simplified)

```
SELLER                      INSPECTOR                    ADMIN                        BUYER
  │                              │                          │                          │
  ├─ Create Listing              │                          │                          │
  │  (status: pending)           │                          │                          │
  │                              │                          │                          │
  │                              ├─ Inspect                │                          │
  │                              │  (status: in_progress)  │                          │
  │                              ├─ Submit Results         │                          │
  │                              │  (isVerified: verified) │                          │
  │                              │                          │                          │
  │                              │                          ├─ Review & Approve       │
  │                              │                          │  (status: approved)      │
  │                              │                          │                          │
  │                              │                          │                          ├─ Search & Browse
  │                              │                          │                          │  (See approved bikes)
  │                              │                          │                          ├─ Create Transaction
  │                              │                          │                          │  (status: pending)
  │                              │                          │                          │
  ├─ Approve Transaction         │                          │                          │
  │  (status: approved)           │                          │                          │
  │                              │                          │                          │
  │                              │                          │                          ├─ Pay via VNPay
  │                              │                          │                          │
  │                              │ ←── VNPay IPN Updates DB ──→                        │
  │  (status: completed)         │       (bike: sold or reserved)                      │
  │                              │                          │                          │
  │                              │                          │                          ├─ Rate & Review
  │  (Can see review)            │                          │   (Can see review)       │  (transactionId req.)
```

### Transaction State Machine

```
                    ┌─────────────────────────┐
                    │   PENDING               │
                    │ (Awaiting seller OK)    │
                    └──────────┬──────────────┘
                               │
                    ┌──────────V──────────┐
                    │   APPROVED          │
                    │ (Ready for payment) │
                    └──────────┬──────────┘
                               │
                    ┌──────────V──────────┐
                    │   COMPLETED         │
                    │ (Payment confirmed) │
                    └─────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
         (full_payment)            (deposit: reserved)
           SOLD                          │
                                        │
                            CREATE:remaining_payment
                                  (new transaction)
                                        │
                            PENDING → APPROVED → COMPLETED
                                           │
                                        SOLD
```

---

## Summary

This bike marketplace implements a sophisticated multi-step workflow with:

1. **Seller Control:** List bikes with rich details and images (status: pending)
2. **Quality Assurance First:** Professional inspections occur BEFORE admin approval
   - Inspector verifies bikes match seller description
   - Failed inspections auto-reject bike (seller can resubmit)
   - Passed inspections move to admin approval
3. **Admin Governance:** Final review and approval only after inspection passes
   - Admin approves inspected bikes (status: approved)
   - Bikes become visible to buyers at this point
4. **Flexible Payments:** Support for both full payment and deposit systems
5. **Secure Transactions:** VNPay integration with IPN verification
6. **Reputation System:** Transaction-based review constraints ensure verified purchases
7. **Data Integrity:** Auto-filling, status synchronization, and locked fields prevent inconsistencies

All workflows are deeply interconnected with clear status transitions and validation rules ensuring data consistency throughout the lifecycle.
