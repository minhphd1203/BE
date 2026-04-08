# Backend API Changes for Refund System

**For:** Frontend Developer  
**Date:** April 8, 2026  
**Backend Branch:** `feature/refund-fee`

---

## New Parameters / Tham Số Mới

### 1. Report Submission (`submitReport`)

**Endpoint:** `POST /api/buyer/v1/reports`

**Old Request:**
```json
{
  "reportedUserId": "user-id",
  "reportedBikeId": "bike-id",
  "reasonId": "reason-id",
  "reasonText": "custom text if reasons='others'",
  "description": "detailed description"
}
```

**New Request (with transactionId):**
```json
{
  "reportedUserId": "user-id",
  "reportedBikeId": "bike-id",
  "reasonId": "reason-id",
  "reasonText": "custom text if reasons='others'",
  "description": "detailed description",
  "transactionId": "current-transaction-id"  // ← NEW: OPTIONAL
}
```

**What Changed:**
- ✅ `transactionId` is now accepted
- ✅ It's optional (nullable)
- ✅ Used to link report to transaction for refund eligibility

**Vietnamese:** Thêm `transactionId` để link báo cáo với giao dịch

**Use Case:**
```typescript
// FE: When user reports from transaction detail page
const submitReport = async (transactionId) => {
  const response = await fetch('/api/buyer/v1/reports', {
    method: 'POST',
    body: JSON.stringify({
      reportedBikeId: transaction.bikeId,
      reportedUserId: transaction.sellerId,
      reasonId: 'f19bb4b5-a59d-46a1-961f-6da7796b9b20', // Refund reason ID
      description: 'Fraudulent listing, seller sent wrong item',
      transactionId: transactionId, // ← LINK TO TRANSACTION
    })
  });
};
```

---

### 2. Refund Request (`requestRefund`)

**Endpoint:** `POST /api/payment/v1/refund/:transactionId`

**Old Request:**
```json
{
  "reason": "Product quality issue"
}
```

**New Request (with reportId):**
```json
{
  "reason": "Product quality issue",
  "reportId": "report-id"  // ← NEW: OPTIONAL
}
```

**What Changed:**
- ✅ `reportId` is now accepted
- ✅ It's optional (nullable)
- ✅ Used to link refund back to the report that triggered it
- ✅ Creates audit trail for compliance

**Vietnamese:** Thêm `reportId` để link hoàn tiền với báo cáo gốc

**Use Case:**
```typescript
// FE: When user requests refund after admin approved report
const requestRefund = async (transactionId, reportId) => {
  const response = await fetch(`/api/payment/v1/refund/${transactionId}`, {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Fraudulent listing',
      reportId: reportId, // ← LINK TO REPORT
    })
  });
};
```

---

## Report ID for Refund Reason / ID Lý Do Báo Cáo Hoàn Tiền

**Refund Violation Reason:**
```json
{
  "id": "f19bb4b5-a59d-46a1-961f-6da7796b9b20",
  "name": "Fraudulent Listing - Buyer Demands Refund",
  "description": "Seller listed fraudulent item, buyer demands refund",
  "autoResolveAction": "refund"
}
```

**Usage in Report:**
```typescript
// When user selects this reason in report modal
const reasonId = 'f19bb4b5-a59d-46a1-961f-6da7796b9b20'; // Pre-defined

// FE should detect this ID and show refund-specific UI
if (selectedReasonId === 'f19bb4b5-a59d-46a1-961f-6da7796b9b20') {
  // Show message: "After admin approval, you can request a refund"
}
```

---

## API Response Changes / Thay Đổi Response

### Report Response
```json
{
  "success": true,
  "data": {
    "id": "report-uuid",
    "reporterId": "buyer-uuid",
    "reportedBikeId": "bike-uuid",
    "transactionId": "transaction-uuid",      // ← NEW: NOW INCLUDED
    "reasonId": "reason-uuid",
    "status": "pending",
    "createdAt": "2026-04-08T10:00:00Z"
  },
  "message": "Báo cáo đã được gửi, admin sẽ xem xét..."
}
```

### Refund Response
```json
{
  "success": true,
  "refund": {
    "id": "refund-uuid",
    "transactionId": "transaction-uuid",
    "reportId": "report-uuid",                // ← NEW: NOW INCLUDED
    "buyerId": "buyer-uuid",
    "amount": 5000000,
    "status": "completed",
    "reason": "Fraudulent listing",
    "processedAt": "2026-04-08T10:05:00Z",
    "createdAt": "2026-04-08T10:01:00Z"
  },
  "message": "Yêu cầu hoàn trả đã được chấp nhận"
}
```

---

## Workflow / Luồng Công Việc

### Step-by-Step for Frontend

#### 1️⃣ User Views Transaction Detail
```
GET /api/buyer/v1/transactions/:transactionId
Response: Transaction data with status, bike, seller info
```

#### 2️⃣ User Clicks "Report" Button
```
Modal opens with form:
- Dropdown: Select reason (fetch from GET /api/admin/v1/report-reasons)
- Important: Show reason "Fraudulent Listing - Buyer Demands Refund"
- Textarea: Enter description
- Button: Submit
```

#### 3️⃣ User Submits Report
```typescript
POST /api/buyer/v1/reports
{
  "reportedBikeId": "bike-uuid",
  "reportedUserId": "seller-uuid",
  "reasonId": "f19bb4b5-a59d-46a1-961f-6da7796b9b20",  // Refund reason
  "description": "User input",
  "transactionId": "transaction-uuid"  // ← KEY: Link transaction
}

Response:
{
  "success": true,
  "data": {
    "id": "report-uuid",
    "transactionId": "transaction-uuid",  // ← Returned for next steps
    ...
  }
}

Save reportId for later use
```

#### 4️⃣ Poll Report Status (Every 5 seconds)
```javascript
// After report submitted, periodically check status
setInterval(async () => {
  const reports = await fetch('/api/buyer/v1/reports?status=pending');
  const report = reports.find(r => r.id === savedReportId);
  
  if (report.status === 'resolved' && report.reason?.autoResolveAction === 'refund') {
    // ✅ Admin approved! Change button from Report → Request Refund
    setButtonState('refund-ready');
  }
}, 5000);
```

#### 5️⃣ User Clicks "Request Refund" (After Approval)
```typescript
POST /api/payment/v1/refund/:transactionId
{
  "reason": "Fraudulent listing",
  "reportId": "report-uuid"  // ← KEY: Link back to report
}

Response:
{
  "success": true,
  "refund": {
    "id": "refund-uuid",
    "reportId": "report-uuid",  // ← Confirmed link
    "status": "completed",
    "amount": 5000000,
    ...
  }
}

Show success message: "Refund processed! XXX VND returned"
```

#### 6️⃣ Poll Refund Status (Until complete)
```javascript
setInterval(async () => {
  const refund = await fetch(`/api/payment/v1/refund/${refundId}/status`);
  
  if (refund.status === 'completed') {
    // ✅ Done! Show completion message
    setButtonState('refund-complete');
    clearInterval();
  }
}, 3000);
```

---

## Error Handling / Xử Lý Lỗi

### Common Errors with Solutions

#### 1. Report Already Exists
```json
{
  "success": false,
  "message": "Giao dịch này đã được báo cáo rồi"
}
```
**Solution:** Hide report button if user already reported this transaction

#### 2. Transaction Not Completed
```json
{
  "success": false,
  "message": "Chỉ có thể hoàn trả giao dịch đã hoàn thành"
}
```
**Solution:** Check transaction status before showing buttons

#### 3. Already Has Refund
```json
{
  "success": false,
  "message": "Giao dịch này đã có yêu cầu hoàn trả",
  "refundId": "existing-refund-uuid"
}
```
**Solution:** Show existing refund status instead of creating new one

#### 4. Refund Provider Error
```json
{
  "success": false,
  "message": "Refund provider error or service unavailable"
}
```
**Solution:** Show retry button, inform user transaction will be processed shortly

---

## State Management Structure / Cấu Trúc State

### Recommended Redux/Zustand Store

```typescript
interface RefundState {
  // Report tracking
  currentReport: {
    id: string;
    transactionId: string;
    status: 'pending' | 'resolved' | 'rejected';
    autoResolveAction?: string;
  } | null;
  
  // Refund tracking
  currentRefund: {
    id: string;
    reportId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: number;
  } | null;
  
  // UI state
  buttonState: 'report' | 'pending-approval' | 'refund-ready' | 'refund-processing' | 'refund-complete' | 'error';
  
  // Loading states
  isReportLoading: boolean;
  isRefundLoading: boolean;
  pollingActive: boolean;
  
  // Error messages
  error: string | null;
  
  // Actions
  submitReport: (transactionId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  requestRefund: (transactionId: string) => Promise<void>;
  clearError: () => void;
}
```

---

## Backward Compatibility / Tương Thích Ngược

### Old Code Still Works
```typescript
// Old way (without transactionId) - still works
POST /api/buyer/v1/reports
{
  "reportedBikeId": "bike-id",
  "reasonId": "some-reason-id",
  "description": "description"
}
// ✅ Works - transactionId will be null in DB

// Old refund way (without reportId) - still works  
POST /api/payment/v1/refund/:transactionId
{
  "reason": "some reason"
}
// ✅ Works - reportId will be null in DB
```

All existing code continues to function without changes.

---

## Performance Considerations / Xem Xét Hiệu Năng

### Polling Optimization
```typescript
// ❌ Not ideal: Poll every second
setInterval(checkStatus, 1000); // High CPU usage

// ✅ Better: Poll every 5 seconds
setInterval(checkStatus, 5000);

// ✅ Best: WebSocket (if available)
ws.on('report-approved', () => {
  // Real-time update without polling
});
```

### State Management
```typescript
// ✅ Store reportId after submit for easy access
const reportId = response.data.id;
sessionStorage.setItem(`report_${transactionId}`, reportId);

// ✅ Use reportId later without refetching
const reportId = sessionStorage.getItem(`report_${transactionId}`);
```

---

## Testing Checklist / Danh Sách Kiểm Thử

| Test Case | Status | Notes |
|-----------|--------|-------|
| Submit report with transactionId | ⚠️ Ready | API accepts, stores correctly |
| Report appears in list with transactionId | ⚠️ Ready | Can query by transactionId |
| Refund accepts reportId | ⚠️ Ready | API accepts, stores in refund record |
| Refund links back to report | ⚠️ Ready | Can query refund.reportId → report |
| Audit trail complete | ⚠️ Ready | Transaction → Report → Refund chain |
| Backward compatibility maintained | ⚠️ Ready | Old code without params works |

---

## Version History / Lịch Sử Phiên Bản

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-08 | Initial implementation - transactionId + reportId |
| TBD | TBD | WebSocket real-time updates |
| TBD | TBD | Batch report processing |

---

## Navigation / Điều Hướng

- 📄 [Backend Changes Summary](REFUND_SYSTEM_CHANGES.md)
- 📋 [FE Todo List](../FE/FE_REFUND_VIOLATION_TODOLIST.md)
- 🔧 [System Architecture](PROJECT_WORKFLOW_BREAKDOWN.md)
- 📚 [Refund Provider Config](REFUND_PROVIDER_CONFIG.md)
