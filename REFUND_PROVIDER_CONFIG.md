# Refund Provider Configuration

## Options

### 1. REAL VNPay Refund API (Production)
```env
REFUND_PROVIDER=vnpay
VNP_ACCESS_CODE=your_vnpay_access_code  # Get from VNPay merchant portal
```

**Timeline:** 3-5 business days (bank processing)
- Day 1-2: VNPay processes
- Day 3-5: Bank transfers to buyer's account
- Webhook updates `refund.status` → `completed` when done

### 2. Mock Refund with Delay (Testing)
```env
REFUND_PROVIDER=mock
REFUND_MOCK_DELAY_MS=60000  # 1 minute (default)
```

**Timeline:** Configurable (default 1 minute)
- Simulates real VNPay processing for testing
- After delay, webhook callback automatically confirms refund
- Perfect for demo without waiting days

Examples:
```env
REFUND_MOCK_DELAY_MS=5000    # 5 seconds
REFUND_MOCK_DELAY_MS=10000   # 10 seconds
REFUND_MOCK_DELAY_MS=60000   # 1 minute (default)
REFUND_MOCK_DELAY_MS=300000  # 5 minutes
```

### 3. Mock Instant Refund (Demo/Quick Testing)
```env
REFUND_PROVIDER=mock-instant
```

**Timeline:** Instant
- Refund completes immediately
- No waiting, good for demo
- Perfect for quick testing

---

## Flow by Provider

### VNPay Refund API Flow
```
Buyer requests refund
        ↓
Create refund (status=pending)
        ↓
Call VNPay Refund API
        ↓
Return "pending" to buyer
        ↓
(3-5 business days later)
        ↓
VNPay webhook callback
        ↓
Update refund → completed
Transaction → refunded
Bike → for_sale
```

### Mock Refund Flow
```
Buyer requests refund
        ↓
Create refund (status=pending)
        ↓
Return "pending" to buyer
        ↓
(Wait REFUND_MOCK_DELAY_MS)
        ↓
Auto-send webhook callback
        ↓
Update refund → completed
Transaction → refunded
Bike → for_sale
```

### Mock Instant Refund Flow
```
Buyer requests refund
        ↓
Create refund (status=pending)
        ↓
Provider returns status=completed
        ↓
Immediately update refund → completed
Transaction → refunded
Bike → for_sale
        ↓
Return to buyer instantly
```

---

## Default Configuration

If no `REFUND_PROVIDER` is set, defaults to `mock` with 1 minute delay.

```env
# Default (if omitted):
REFUND_PROVIDER=mock
REFUND_MOCK_DELAY_MS=60000
```

---

## API Response by Provider

### Mock Instant (Immediate Response)
```json
{
  "success": true,
  "message": "Yêu cầu hoàn trả đã được chấp nhận",
  "refund": {
    "id": "uuid",
    "status": "completed",     ← Already done
    "amount": 35000000,
    "processedAt": "2026-04-08T...",
    "createdAt": "2026-04-08T..."
  }
}
```

### Mock with Delay / VNPay (Need to Wait)
```json
{
  "success": true,
  "message": "Yêu cầu hoàn trả đã được chấp nhận",
  "refund": {
    "id": "uuid",
    "status": "pending",       ← Waiting for provider
    "amount": 35000000,
    "processedAt": null,
    "createdAt": "2026-04-08T..."
  }
}
```

Check status later:
```
GET /api/payment/v1/refund/{refundId}/status
→ Returns updated status when provider confirms
```

---

## Recommended Settings

**Development/Testing:**
```env
REFUND_PROVIDER=mock-instant  # Fast testing
# OR
REFUND_PROVIDER=mock          # Realistic timing
REFUND_MOCK_DELAY_MS=5000     # 5 second demo
```

**Staging:**
```env
REFUND_PROVIDER=mock
REFUND_MOCK_DELAY_MS=300000   # 5 minutes (closer to real 3-5 days)
```

**Production:**
```env
REFUND_PROVIDER=vnpay
VNP_ACCESS_CODE=<your_real_access_code>
```
