## 🛍️ BUYER API TEST FLOW - Postman Guide

### Prerequisites
- Server running: `npm run dev` at `http://localhost:3000`
- Postman installed
- Database with at least 1 approved & verified bike

---

### ⚙️ Step 0: Setup Environment Variables (Postman)

1. Create new Environment called "Buyer-Test"
2. Add variables:

```
BASE_URL: http://localhost:3000
BUYER_TOKEN: (will be set after login)
BUYER_ID: (will be set after login)
BIKE_ID: (will be set after search)
```

---

### 📝 Step 1: Register as Buyer

**Method:** `POST`  
**URL:** `{{BASE_URL}}/api/auth/register`  
**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "buyer.test@example.com",
  "password": "buyer123",
  "name": "Test Buyer",
  "phone": "0987654321"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-buyer-id",
    "email": "buyer.test@example.com",
    "name": "Test Buyer",
    "role": "buyer",
    "createdAt": "2026-03-07T..."
  }
}
```

**Notes:**
- ✅ `role` should be `'buyer'` (not `'user'`)
- You can see the id from response set to `BUYER_ID`

---

### 🔑 Step 2: Login as Buyer

**Method:** `POST`  
**URL:** `{{BASE_URL}}/api/auth/login`  
**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "buyer.test@example.com",
  "password": "buyer123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "userId": "uuid-buyer-id",
    "email": "buyer.test@example.com",
    "name": "Test Buyer",
    "role": "buyer"
  }
}
```

**Setup for next requests:**
1. Copy the `token` value
2. Go to Environment → set `BUYER_TOKEN` to the token value
3. In Postman: Right-click Environment → set variable or use Tests:

```javascript
// Add this in Tests tab
pm.environment.set("BUYER_TOKEN", pm.response.json().data.token);
pm.environment.set("BUYER_ID", pm.response.json().data.userId);
```

---

### ⭐ Step 3: Get Recommended Bikes (Homepage)

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/recommended?limit=5`  
**Headers:**
```
Authorization: Bearer {{BUYER_TOKEN}}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bike-uuid-1",
      "title": "Giant Escape 3",
      "brand": "Giant",
      "model": "Escape 3",
      "price": 15000000,
      "year": 2023,
      "condition": "excellent",
      "images": ["url1", "url2"],
      "status": "approved",
      "isVerified": "verified",
      "createdAt": "2026-03-07T...",
      "seller": {
        "id": "uuid",
        "name": "John Seller",
        "avatar": "url"
      }
    },
    // ... more bikes
  ],
  "message": "Recommended bikes fetched successfully"
}
```

**Verify:**
- ✅ At least 5 bikes returned (or less if DB has fewer)
- ✅ All bikes have `status: "approved"`
- ✅ All bikes have `isVerified: "verified"`
- ✅ Response 200 OK

---

### 🔍 Step 4: Search Bikes with Filters

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/search`  
**Query Parameters:**
```
brand=Giant
minPrice=10000000
maxPrice=20000000
condition=excellent
sortBy=price
sortOrder=asc
page=1
limit=10
```

**Headers:**
```
Authorization: Bearer {{BUYER_TOKEN}}
```

**Full URL Example:**
```
http://localhost:3000/api/buyer/v1/bikes/search?brand=Giant&minPrice=10000000&maxPrice=20000000&condition=excellent&sortBy=price&sortOrder=asc&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bike-uuid-1",
      "title": "Giant Escape 3",
      "brand": "Giant",
      "model": "Escape 3",
      "price": 15000000,
      "year": 2023,
      "condition": "excellent",
      "images": ["url1"],
      "status": "approved",
      "isVerified": "verified",
      "createdAt": "2026-03-07T...",
      "seller": {
        "id": "uuid",
        "name": "John Seller",
        "avatar": "url"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "message": "Bikes searched successfully"
}
```

**Copy bike ID for next step:**
```javascript
// Tests tab
if (pm.response.code === 200 && pm.response.json().data.length > 0) {
  pm.environment.set("BIKE_ID", pm.response.json().data[0].id);
}
```

**Verify:**
- ✅ Returned bikes match filter criteria
- ✅ `meta` shows pagination info
- ✅ Response 200 OK

---

### 📄 Step 5: Get Bike Detail

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/{{BIKE_ID}}`  
**Headers:**
```
Authorization: Bearer {{BUYER_TOKEN}}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "bike-uuid-1",
    "title": "Giant Escape 3",
    "description": "Very clean bike...",
    "brand": "Giant",
    "model": "Escape 3",
    "year": 2023,
    "price": 15000000,
    "condition": "excellent",
    "mileage": 5000,
    "color": "Black",
    "images": ["url1", "url2", "url3"],
    "status": "approved",
    "isVerified": "verified",
    "inspectionStatus": "completed",
    "createdAt": "2026-03-07T...",
    "seller": {
      "id": "uuid",
      "name": "John Seller",
      "email": "john@example.com",
      "phone": "0123456789",
      "avatar": "url",
      "createdAt": "2026-02-01T..."
    },
    "category": {
      "id": "uuid",
      "name": "Road Bike",
      "slug": "road-bike",
      "description": "..."
    },
    "inspections": [
      {
        "id": "inspection-uuid",
        "status": "passed",
        "overallCondition": "excellent",
        "frameCondition": "excellent",
        "brakeCondition": "excellent",
        "wheelCondition": "excellent",
        "inspectionNote": "All good",
        "recommendation": "Safe to buy",
        "createdAt": "2026-03-05T..."
      }
    ]
  },
  "message": "Bike detail fetched successfully"
}
```

**Verify:**
- ✅ All bike info returned (including inspection report)
- ✅ Seller contact info visible
- ✅ Inspection details included
- ✅ Response 200 OK

---

### ❌ Step 6: Test Error Cases

#### 6.1 Search for non-existent bike detail

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/invalid-id`  
**Headers:**
```
Authorization: Bearer {{BUYER_TOKEN}}
```

**Expected Response (404):**
```json
{
  "success": false,
  "message": "Bike not found or not available"
}
```

#### 6.2 Access without token

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/recommended`  
**Headers:** (empty - no Authorization)

**Expected Response (401):**
```json
{
  "message": "No token provided"
}
```

#### 6.3 Access with invalid token

**Method:** `GET`  
**URL:** `{{BASE_URL}}/api/buyer/v1/bikes/recommended`  
**Headers:**
```
Authorization: Bearer invalid.token.here
```

**Expected Response (401):**
```json
{
  "message": "Invalid token"
}
```

---

### 📊 Full Buyer Flow Summary

```
1. Register as Buyer
   ↓ (role = 'buyer' by default)
2. Login
   ↓ (get token)
3. Get Recommended Bikes
   ↓ (auto-load homepage)
4. Search Bikes with filters
   ↓ (find specific bike)
5. Get Bike Details
   ↓ (view full info + inspection report)
6. Error handling tests
   ↓ ✅ Complete flow tested
```

---

### 💾 Export as Postman Collection (Optional)

1. In Postman: Collections → Export
2. Save as `BUYER_FLOW.postman_collection.json`
3. Share with team for consistent testing

---

### 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token is valid and copied correctly |
| 404 Bike not found | Ensure bike is approved AND verified status |
| 400 Bad request | Check query parameters syntax |
| Connection refused | Ensure server is running on port 3000 |
| Empty search results | Check database has bikes matching filter criteria |

