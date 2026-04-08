# CHANGES.md - Refund System Implementation

**Branch:** `feature/refund-fee`  
**Date:** April 8, 2026  
**Status:** ✅ Backend Complete, 🟡 FE In Progress

---

## Tóm tắt / Summary

Đã hoàn tất triển khai hệ thống báo cáo gian lận + hoàn tiền trên backend. Buyer có thể báo cáo giao dịch gian lận trên trang chi tiết, admin duyệt báo cáo, sau đó FE sẽ hiển thị nút hoàn tiền để buyer yêu cầu hoàn tiền.

**Completed backend refund-from-report system.** Buyers report fraudulent transactions → admin approves → FE shows refund button → refund processed with full audit trail.

---

## Backend Changes / Thay đổi Backend

### 1. Database Schema (schema.ts)

#### Added to `reports` table:
```typescript
transactionId: uuid('transaction_id').references(() => transactions.id),
// Optional: link to transaction if report submitted from transaction detail page
```

**Purpose:** Track which transaction triggered the report for refund eligibility  
**Vietnamese:** Thêm cột để truy vết giao dịch liên quan

#### Added to `refunds` table:
```typescript
reportId: uuid('report_id').references(() => reports.id),
// Optional: link to report if refund triggered from report approval
```

**Purpose:** Create audit trail linking refund back to report that triggered it  
**Vietnamese:** Link refund về báo cáo gốc để có thể track lịch sử

#### Updated Relations:
- `reportsRelations` - Added transaction relationship
- `refundsRelations` - Added report relationship

---

### 2. Controllers

#### buyerController.ts (submitReport)

**Before:**
```typescript
const { reportedUserId, reportedBikeId, reasonId, reasonText, description } = req.body;
```

**After:**
```typescript
const { reportedUserId, reportedBikeId, reasonId, reasonText, description, transactionId } = req.body;
// ... later in insert ...
transactionId: transactionId || null, // Optional
```

**Change:** Accept optional `transactionId` from request body to link transaction to report  
**Vietnamese:** Nhận `transactionId` từ request để link giao dịch vào báo cáo

---

#### paymentController.ts (requestRefund)

**Before:**
```typescript
const { reason } = req.body as { reason: string };
// ... later in insert ...
await db.insert(refunds).values({
  transactionId,
  buyerId,
  sellerId: transaction.sellerId,
  amount: transaction.amount,
  reason: reason.trim(),
  status: 'pending',
});
```

**After:**
```typescript
const { reason, reportId } = req.body as { reason: string; reportId?: string };
// ... later in insert ...
await db.insert(refunds).values({
  transactionId,
  reportId: reportId || null, // Optional: link to report if refund triggered from report approval
  buyerId,
  sellerId: transaction.sellerId,
  amount: transaction.amount,
  reason: reason.trim(),
  status: 'pending',
});
```

**Change:** Accept optional `reportId` to link refund back to triggering report  
**Vietnamese:** Nhận `reportId` để link hoàn tiền về báo cáo

---

### 3. Database Migrations

**Created:** `drizzle/0024_unknown_whizzer.sql`

Key changes:
- ✅ ALTER TABLE reports ADD COLUMN transaction_id uuid
- ✅ ALTER TABLE refunds ADD COLUMN report_id uuid
- ✅ Add foreign key constraints

**Applied:** to PostgreSQL successfully  
**Journal:** Updated `drizzle/meta/_journal.json` with entry 23

---

## Flow Diagram / Sơ đồ Luồng

```
┌─────────────────────────────────────────────────────────────────┐
│ BUYER: Transaction Detail Page                                   │
│ [Report Button] → Opens modal                                    │
│ Submit: {transactionId, reasonId, description}                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: submitReport() creates report                           │
│ ✅ reports.transactionId = transaction-uuid                      │
│ ✅ reports.reasonId = refund-violation-reason                    │
│ ✅ reports.status = 'pending'                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN: Dashboard                                                  │
│ Reviews report, sees: "Fraudulent Listing"                       │
│ Clicks: [Approve]                                                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: resolveReport()                                         │
│ ✅ reports.status = 'resolved'                                   │
│ ✅ Detects: autoResolveAction = 'refund'                         │
│ ℹ️  Does NOT auto-refund (FE will handle)                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Transaction Detail Page                                │
│ ✅ Polls report status                                            │
│ ✅ Detects: status='resolved' + autoResolveAction='refund'       │
│ 🔄 Button changes: [Report] → [Request Refund]                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ BUYER: Clicks [Request Refund]                                   │
│ FE calls: POST /api/payment/v1/refund/:transactionId             │
│ Body: {reason: "Fraudulent listing", reportId: "report-uuid"}   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: requestRefund()                                         │
│ ✅ Creates refund record:                                         │
│    - refunds.transactionId = transaction-uuid                    │
│    - refunds.reportId = report-uuid ← AUDIT LINK               │
│    - refunds.buyerId, sellerId, amount, reason...                │
│ ✅ Calls refund provider (VNPay/mock)                            │
│ ✅ Updates: transaction.status = 'refunded'                      │
│ ✅ Updates: bike.status = 'for_sale'                             │
│ ✅ refund.status = 'completed'                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Shows Refund Confirmation                              │
│ Button: [Refund Complete] ✅                                      │
│ Message: "Refund processed. Amount: XXX VND"                    │
│ Link: "View refund details"                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Audit Trail / Lịch Sử Kiểm Toán

The system now provides complete traceability:

```
Transaction
├── Report (🔗 transactionId)
│   ├── status: resolved
│   ├── reason: Fraudulent Listing - Buyer Demands Refund
│   ├── autoResolveAction: 'refund'
│   └── resolvedBy: admin-id
│
└── Refund (🔗 reportId + transactionId)
    ├── reportId: report-uuid ← LINK TO REPORT
    ├── transactionId: transaction-uuid
    ├── amount: original-amount
    ├── status: completed
    └── createdAt: timestamp
```

**Benefits:**
- ✅ Can track which report triggered which refund
- ✅ Can audit all refund history for transaction
- ✅ Can prevent duplicate refunds
- ✅ Full compliance audit trail

**Vietnamese:**
- ✅ Có thể track báo cáo nào trigger hoàn tiền
- ✅ Có thể audit lịch sử hoàn tiền
- ✅ Ngừa hoàn tiền trùng lặp
- ✅ Audit trail đầy đủ

---

## Files Modified / Tệp Thay Đổi

### Schema & Migrations:
- ✅ `src/db/schema.ts` - Added transactionId & reportId with relations
- ✅ `drizzle/0024_unknown_whizzer.sql` - Migration SQL
- ✅ `drizzle/meta/_journal.json` - Migration journal entry

### Controllers:
- ✅ `src/controllers/buyerController.ts` - submitReport() updated
- ✅ `src/controllers/paymentController.ts` - requestRefund() updated
- ✅ `src/controllers/adminController.ts` - No changes needed

### Other Backend:
- ✅ `src/services/refundProvider.ts` - Already exists
- ✅ `src/routes/paymentRoutes.ts` - No changes needed (endpoints exist)

---

## Frontend Work / Công Việc Frontend

📋 **See:** `FE_REFUND_VIOLATION_TODOLIST.md`

### Quick Summary:
1. Add "Report" button to transaction detail → opens modal
2. Submit report with transactionId
3. Poll report status every 5 sec
4. Detect admin approval (status='resolved' + autoResolveAction='refund')
5. Change button: [Report] → [Request Refund]
6. Call refund API with reportId
7. Show refund completion & status

### Estimated Timeline: 5-8 days

---

## Testing / Kiểm Thử

### Backend (Completed):
- ✅ Build: `npm run build` - TypeScript compilation passing
- ✅ Schema: Migrations applied to PostgreSQL
- ✅ API: Endpoints accept new parameters

### Frontend (TODO):
- [ ] Integration tests
- [ ] E2E test: Report → Approve → Refund flow
- [ ] Error scenarios
- [ ] Button state transitions
- [ ] Error messages

---

## Deploy Steps / Bước Deploy

### 1. Apply Migrations (if database hasn't been updated):
```bash
npx drizzle-kit push --force
```

### 2. Rebuild Backend:
```bash
npm run build
```

### 3. Start Backend:
```bash
npm start
```

### 4. Frontend Changes:
- Create `FE_REFUND_VIOLATION_TODOLIST.md` (created ✅)
- Execute FE tasks following the todo list
- Test end-to-end flow

---

## Notes / Ghi Chú

### What Was Done / Những Gì Đã Làm:
1. ✅ Schema updates - transactionId & reportId columns added
2. ✅ Controllers updated - accept both parameters
3. ✅ Relations configured - full audit trail linking
4. ✅ Migrations created & applied - database synchronized
5. ✅ Build verified - no TypeScript errors

### What's Next / Những Gì Tiếp Theo:
1. 🟡 FE: Report button + modal
2. 🟡 FE: Status polling + button state changes
3. 🟡 FE: Refund button + API call
4. 🟡 FE: Error handling & edge cases
5. 🟡 Testing: Full E2E flow

### Key Design Decisions / Quyết Định Thiết Kế:
- ✅ **FE Orchestrates:** Backend doesn't auto-refund, FE controls flow
- ✅ **Audit Trail:** Both reportId + transactionId in refund record
- ✅ **Backward Compatible:** Old buyer refund path still works
- ✅ **No Auto-Actions:** Report just marks eligibility, FE decides when/how

---

## Rollback / Quay Lại

If needed, rollback steps:
```bash
# Revert migration
npx drizzle-kit drop  # (use with caution)

# Or manually:
ALTER TABLE refunds DROP COLUMN report_id;
ALTER TABLE reports DROP COLUMN transaction_id;

# Revert code
git checkout main -- src/
```

---

## References / Tham Khảo

- Database: PostgreSQL with Drizzle ORM
- Backend: Node.js + Express
- Frontend: React (pending implementation)
- Refund Provider: VNPay / Mock
- Full flow: Report → Admin Approve → FE Trigger → Refund

---

## Questions / Câu Hỏi

For clarifications, refer to:
- Backend flow: See `REFUND_PROVIDER_CONFIG.md`
- Project structure: See `PROJECT_WORKFLOW_BREAKDOWN.md`
- Frontend tasks: See `FE_REFUND_VIOLATION_TODOLIST.md`
