# Inspection Constraint Flow - Detailed Explanation

## Overview

The inspection form now has a **two-layer constraint system**:
1. **UI Layer (Validation Endpoint)** - Real-time feedback, disables/hides invalid options
2. **Backend Layer (Submit Endpoint)** - Hard enforcement, rejects invalid submissions

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INSPECTOR FILLING INSPECTION FORM                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌──────────────────────────────────────────────┐
        │ Inspector selects overall condition:         │
        │ Excellent / Good / Fair / Poor               │
        └──────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ STEP 1: CALL VALIDATION ENDPOINT (Real-time)                    │
        │ GET /api/inspector/v1/inspection/:bikeId/validate-status         │
        │     ?overallCondition=fair                                        │
        └──────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
    ┌───────────▼──────────┐           ┌───────────────▼────────────┐
    │ overallCondition:    │           │ overallCondition:          │
    │ Excellent / Good     │           │ Fair / Poor                │
    └───────────┬──────────┘           └───────────────┬────────────┘
                │                                       │
    ┌───────────▼──────────────────┐   ┌───────────────▼────────────┐
    │ Backend Response:             │   │ Backend Response:          │
    │ {                             │   │ {                          │
    │   "canPass": true,            │   │   "canPass": false,        │
    │   "availableStatuses":        │   │   "availableStatuses":     │
    │     ["passed", "failed"],     │   │     ["failed"],            │
    │   "lockedStatuses": [],       │   │   "lockedStatuses":        │
    │   "reason": "Acceptable"      │   │     ["passed"],            │
    │ }                             │   │   "reason": "Condition not │
    │                               │   │    meet good standard"     │
    └────────────┬──────────────────┘   └────────────┬───────────────┘
                 │                                    │
    ┌────────────▼──────────────────┐   ┌────────────▼───────────────┐
    │ UI Enables Both Buttons:      │   │ UI Disables/Hides:        │
    │ ✅ [PASSED] button ENABLED    │   │ ❌ [PASSED] button LOCKED │
    │ ✅ [FAILED] button ENABLED    │   │ ✅ [FAILED] button ENABLED│
    │                               │   │                            │
    │ Inspector can choose either   │   │ Inspector MUST choose      │
    │                               │   │ FAILED (or change          │
    │                               │   │ overallCondition)          │
    └────────────┬──────────────────┘   └────────────┬───────────────┘
                 │                                    │
                 └────────────────┬───────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ STEP 2: INSPECTOR CLICKS SUBMIT BUTTON                      │
        │ POST /api/inspector/v1/bikes/:bikeId/inspect                │
        │ Payload: {                                                  │
        │   status: "passed" or "failed",                             │
        │   overallCondition: "excellent", "good", "fair", "poor",    │
        │   frameCondition: "...",                                    │
        │   ... other condition fields ...                            │
        │ }                                                            │
        └──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────────────────┐
        │ STEP 3: BACKEND CONSTRAINT ENFORCEMENT                      │
        │ Check: Is status 'passed' AND overall condition             │
        │        NOT in ['excellent', 'good']?                        │
        └──────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴──────────────────┐
                │                                    │
    ┌───────────▼──────────────────┐   ┌────────────▼──────────────┐
    │ CONSTRAINT PASSED ✅         │   │ CONSTRAINT FAILED ❌       │
    │                              │   │                           │
    │ status: "passed"             │   │ status: "passed"          │
    │ overallCondition: "good"     │   │ overallCondition: "fair"  │
    │                              │   │                           │
    │ Response: 200 OK             │   │ Response: 403 FORBIDDEN   │
    │ Inspector's findings are     │   │                           │
    │ reasonable ✓                 │   │ Error Message:            │
    │                              │   │ "❌ CANNOT PASS: Overall │
    └────────────┬─────────────────┘   │ condition 'fair' does not │
                 │                      │ meet minimum 'good'       │
                 ▼                      │ standard. This constraint │
    ┌──────────────────────────────┐   │ is LOCKED and cannot be   │
    │ CREATE INSPECTION RECORD     │   │ overridden."              │
    │ INSERT INTO inspections:     │   │                           │
    │ - id: uuid generated         │   │ Frontend shows error, form│
    │ - status: "passed"           │   │ cannot be submitted       │
    │ - overallCondition: "good"   │   │                           │
    │ - ... other fields ...       │   │ Inspector must:           │
    │                              │   │ 1. Change overallCondition│
    │ Update BIKE status:          │   │    to good/excellent OR   │
    │ - isVerified: "verified"     │   │ 2. Change status to       │
    │ - status: "pending"          │   │    "failed"               │
    │   (awaits admin)             │   │                           │
    │                              │   └───────────────────────────┘
    └────────────┬─────────────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │ Response: 200 OK             │
    │ {                            │
    │   success: true,             │
    │   data: {inspection obj},    │
    │   message: "Inspection pass  │
    │             awaiting admin"  │
    │ }                            │
    │                              │
    │ Frontend shows success ✓      │
    └──────────────────────────────┘
```

---

## Scenario-by-Scenario Breakdown

### Scenario 1: Inspector selects "Good" and "Passed" ✅

**Step 1 - Validation (Frontend Guide)**
```bash
GET /api/inspector/v1/inspection/bike-123/validate-status?overallCondition=good

Response:
{
  "canPass": true,
  "availableStatuses": ["passed", "failed"],
  "lockedStatuses": [],
  "reason": "Overall condition 'good' is acceptable..."
}
```
**UI Action:** Both "PASSED" and "FAILED" buttons are ENABLED

**Step 2 - Submit**
```bash
POST /api/inspector/v1/bikes/bike-123/inspect
{
  "status": "passed",
  "overallCondition": "good",
  ...
}

Response: 200 OK ✅
Inspection created: status="passed", isVerified="verified"
Bike status: "pending" (awaits admin approval)
```

---

### Scenario 2: Inspector selects "Fair" but tries "Passed" ❌

**Step 1 - Validation (Frontend Guide)**
```bash
GET /api/inspector/v1/inspection/bike-123/validate-status?overallCondition=fair

Response:
{
  "canPass": false,
  "availableStatuses": ["failed"],
  "lockedStatuses": ["passed"],
  "reason": "Overall condition 'fair' does not meet 'good' standard..."
}
```
**UI Action:** "PASSED" button is DISABLED/HIDDEN, only "FAILED" shown

**If inspector tries to hack the frontend and submit anyway:**
```bash
POST /api/inspector/v1/bikes/bike-123/inspect
{
  "status": "passed",           ← Attempting despite validation
  "overallCondition": "fair",   ← Below minimum standard
  ...
}

Response: 403 FORBIDDEN ❌
{
  "success": false,
  "code": "INSUFFICIENT_CONDITION_FOR_PASS",
  "message": "❌ CANNOT PASS INSPECTION: Overall condition 'fair' does not meet minimum 'good' standard. This constraint is LOCKED and cannot be overridden.",
  "details": {
    "attemptedStatus": "passed",
    "overallCondition": "fair",
    "minimumRequiredCondition": "good",
    "acceptableConditionsForPass": ["excellent", "good"],
    "rejectedConditions": ["fair", "poor"],
    "instruction": "Inspector MUST mark this bike as FAILED..."
  }
}
```
**Frontend Action:** Show error, form cannot be submitted

**What inspector should do:**
- Option A: Change overallCondition to "good" or "excellent" → Now can select "passed"
- Option B: Keep "fair" and select "failed" → Submission succeeds

---

### Scenario 3: Inspector selects "Poor" and "Failed" ✅

**Step 1 - Validation**
```bash
GET /api/inspector/v1/inspection/bike-123/validate-status?overallCondition=poor

Response:
{
  "canPass": false,
  "availableStatuses": ["failed"],
  "lockedStatuses": ["passed"],
  ...
}
```
**UI Action:** Only "FAILED" button enabled

**Step 2 - Submit**
```bash
POST /api/inspector/v1/bikes/bike-123/inspect
{
  "status": "failed",
  "overallCondition": "poor",
  ...
}

Response: 200 OK ✅
Inspection created: status="failed", isVerified="failed"
Bike status: "rejected" (auto-rejected, no admin needed)
Seller receives notification to fix bike
```

---

## Resubmission Flow (with locked fields)

When a bike was previously rejected and seller resubmits:

```
┌──────────────────────────────────────────────────────────┐
│ PREVIOUS INSPECTION (Stored in DB)                       │
│ - status: "failed"                                       │
│ - overallCondition: "poor"                               │
│ - frameCondition: "severe rust"                          │
│ - brakeCondition: "worn pads need replacement"           │
└──────────────────────────────────────────────────────────┘
                            │
                            │ Seller fixes bike & resubmits
                            ▼
┌──────────────────────────────────────────────────────────┐
│ AUTO-FILL FROM PREVIOUS INSPECTION                       │
│ The form pre-populates with:                             │
│ - frameCondition: "severe rust" (LOCKED - cannot change) │
│ - brakeCondition: "worn pads..." (LOCKED - cannot change)│
│ - overallCondition: "poor" (LOCKED - cannot change)      │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ WHY? Inspector's findings reflect ACTUAL bike reality    │
│ The condition fields represent what inspector SAW,       │
│ not what seller claims. Those don't change just because  │
│ seller "says" they fixed it.                             │
│                                                          │
│ Inspector only needs to decide: PASS or FAIL again?      │
└──────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
    ┌───▼────────┐                   ┌─────────▼──┐
    │ Inspector  │                   │ Inspector  │
    │ sees same  │                   │ inspects   │
    │ "poor"     │                   │ again, sees│
    │ condition  │                   │ "good"     │
    │            │                   │            │
    │ MUST fail  │                   │ CAN change │
    │ again      │                   │ (override) │
    │            │                   │            │
    └───┬────────┘                   └─────────┬──┘
        │                                      │
        ▼                                      ▼
    Still poor                         Changed to "good"
    Status: "failed"        OR         Status: "passed"
    (repeat cycle)                     (inspection passes)
```

When submitting resubmission with **override**:
```bash
POST /api/inspector/v1/bikes/bike-123/inspect
{
  "status": "passed",
  "overallCondition": "good",           ← Changed from "poor"
  "frameCondition": "severe rust",      ← MUST match previous
  "brakeCondition": "worn pads...",     ← MUST match previous
  ...
}

Backend checks:
- If frameCondition !== previous: ❌ ERROR "frameCondition is locked"
- If brakeCondition !== previous: ❌ ERROR "brakeCondition is locked"
- If overallCondition !== previous: ❌ ERROR "overallCondition is locked"
  
But wait... in response above, overallCondition CHANGED!
That would trigger the resubmission lock error!

So actually, on resubmission:
- ALL condition fields are LOCKED
- Inspector can ONLY change status (pass ↔ fail)
- Cannot override condition findings
```

---

## Key Points

### ✅ What Gets Validated

1. **Initial Submission:**
   - `status` and `overallCondition` are REQUIRED
   - Constraint: If `status=passed`, then `overallCondition` must be `good` or `excellent`
   - All condition fields can be entered

2. **Resubmission (After Previous Rejection):**
   - All condition fields are **LOCKED** to previous values
   - Only `status` can change
   - Constraint still applies: If `status=passed`, overall must be `good` or above

### 🔒 Two-Layer Protection

| Layer | Mechanism | Response |
|-------|-----------|----------|
| **UI Layer** | Validation endpoint disables button | Frontend shows locked button |
| **Backend Layer** | Constraint check rejects submission | 403 Forbidden error |

### 📱 Frontend Integration

```javascript
// When inspector changes overallCondition dropdown
async function onOverallConditionChange(bikeId, newCondition) {
  const response = await fetch(
    `/api/inspector/v1/inspection/${bikeId}/validate-status?overallCondition=${newCondition}`
  );
  
  const { data } = await response.json();
  
  // Update UI based on response
  document.getElementById('passButton').disabled = !data.canPass;
  document.getElementById('failButton').disabled = false;
  document.getElementById('constraintMessage').textContent = data.reason;
}

// On form submit
async function submitInspectionForm(formData) {
  const response = await fetch(
    `/api/inspector/v1/bikes/${bikeId}/inspect`,
    {
      method: 'POST',
      body: JSON.stringify(formData)
    }
  );
  
  if (response.status === 403) {
    // Hard constraint violated
    const error = await response.json();
    showErrorAlert(error.message);
    return;
  }
  
  if (response.ok) {
    showSuccessAlert('Inspection submitted!');
  }
}
```

---

## Summary

```
Inspector Action          Validation Endpoint           Submit Endpoint
─────────────────────────────────────────────────────────────────────────
Changes condition    →    Returns available options  →  (UI updates)
Clicks Submit        →    (no call, already done)    →  Enforce constraint
                                                        Create inspection
                                                        Update bike status
```

The **validation endpoint is optional UX enhancement**, but the **submit endpoint's constraint is mandatory enforcement**. Even if frontend buggy, backend always enforces the rule! 🔒

