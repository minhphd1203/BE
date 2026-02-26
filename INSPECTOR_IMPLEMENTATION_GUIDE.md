# 📋 Inspector System - Implementation Guide

## 🎯 Tổng Quan

Hệ thống Inspector đã được implement **đầy đủ** với 8 endpoints chính, hoàn toàn khớp với UI/UX yêu cầu.

---

## 🚀 API Endpoints

### Base URL: `/api/inspector/v1`

**Authentication**: Tất cả endpoints yêu cầu JWT token với role `inspector`

```
Authorization: Bearer <jwt_token>
```

---

## 📊 1. Dashboard - Thống Kê Tổng Quan

**Endpoint**: `GET /api/inspector/v1/dashboard`

**UI Mapping**: Màn hình "Trang chủ" - Bảng thống kê kiểm định

### Response
```json
{
  "success": true,
  "data": {
    "pendingInspections": 24,      // Đang chờ kiểm định
    "completedInspections": 156,   // Đã kiểm định
    "passedCount": 120,            // Xe đạt
    "failedCount": 36,             // Xe không đạt
    "disputesCount": 0             // Khiếu nại (future)
  }
}
```

### Frontend Example
```javascript
const response = await fetch('/api/inspector/v1/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();

// Display
<Card>
  <Icon>✓</Icon>
  <Title>Đã kiểm định</Title>
  <Count>{data.completedInspections}</Count>
</Card>

<Card>
  <Icon>⏰</Icon>
  <Title>Đang chờ kiểm định</Title>
  <Count>{data.pendingInspections}</Count>
</Card>
```

---

## 🔍 2. Danh Sách Xe Chờ Kiểm Định

**Endpoint**: `GET /api/inspector/v1/bikes/pending`

**UI Mapping**: Màn hình "Danh sách kiểm định"

### Query Parameters
- `search` (optional): Tìm kiếm theo title, brand, model, seller name
- `sort` (optional): `newest` (default), `oldest`, `price_asc`, `price_desc`

### Request Examples
```
GET /api/inspector/v1/bikes/pending
GET /api/inspector/v1/bikes/pending?search=Giant
GET /api/inspector/v1/bikes/pending?sort=price_desc
GET /api/inspector/v1/bikes/pending?search=Pinarello&sort=newest
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Xe đạp địa hình Giant Talon 3",
      "brand": "Giant",
      "model": "Talon 3",
      "year": 2023,
      "price": 8500000,
      "condition": "Mới",
      "images": ["url1.jpg", "url2.jpg"],
      "status": "approved",
      "isVerified": "not_verified",
      "inspectionStatus": "pending",
      "sellerId": "uuid",
      "sellerName": "Nguyễn Văn A",
      "categoryName": "Xe địa hình",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "message": "Found 4 bikes pending inspection"
}
```

### Frontend Example
```jsx
const BikeListPage = () => {
  const [bikes, setBikes] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  const fetchBikes = async () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('sort', sort);

    const response = await fetch(
      `/api/inspector/v1/bikes/pending?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { data } = await response.json();
    setBikes(data);
  };

  return (
    <div>
      <SearchBar 
        placeholder="Tìm kiếm theo tiêu đề, người bán..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <FilterDropdown value={sort} onChange={setSort}>
        <option value="newest">Tất cả trang thái</option>
        <option value="oldest">Cũ nhất</option>
        <option value="price_desc">Giá cao nhất</option>
        <option value="price_asc">Giá thấp nhất</option>
      </FilterDropdown>

      {bikes.map(bike => (
        <BikeCard key={bike.id}>
          <Image src={bike.images[0]} />
          <Title>{bike.title}</Title>
          <Info>
            <span>Người bán: {bike.sellerName}</span>
            <span>Giá: {formatPrice(bike.price)}</span>
            <span>Tình trạng: {bike.condition}</span>
            <span>Gửi từ {formatTimeAgo(bike.createdAt)}</span>
          </Info>
          <StatusBadge>⏰ Chờ kiểm định</StatusBadge>
          <Button onClick={() => navigate(`/inspector/inspection/${bike.id}`)}>
            🔍 Kiểm định ngay
          </Button>
        </BikeCard>
      ))}
    </div>
  );
};
```

---

## 📄 3. Chi Tiết Xe

**Endpoint**: `GET /api/inspector/v1/bikes/:bikeId`

**UI Mapping**: Phần trên của màn hình form kiểm định

### Response
```json
{
  "success": true,
  "data": {
    "bike": {
      "id": "uuid",
      "title": "Xe đạp địa hình Giant Talon 3",
      "description": "Xe đạp địa hình chất lượng cao...",
      "brand": "Giant",
      "model": "Talon 3",
      "year": 2023,
      "price": 8500000,
      "condition": "Mới",
      "mileage": null,
      "color": "Đen",
      "images": ["url1.jpg", "url2.jpg"],
      "status": "approved",
      "isVerified": "not_verified",
      "inspectionStatus": "pending",
      "sellerId": "uuid",
      "sellerName": "Nguyễn Văn A",
      "sellerPhone": "0901234567",
      "sellerEmail": "nguyen@example.com",
      "categoryName": "Xe địa hình",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "inspectionHistory": []
  }
}
```

---

## 🚀 4. Bắt Đầu Kiểm Định

**Endpoint**: `POST /api/inspector/v1/bikes/:bikeId/start`

**Chức năng**: Chuyển trạng thái xe từ `pending` → `in_progress`

### Request
```
POST /api/inspector/v1/bikes/abc123/start
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "inspectionStatus": "in_progress",
    // ... other bike fields
  },
  "message": "Inspection started successfully"
}
```

---

## ✅ 5. Submit Form Kiểm Định

**Endpoint**: `POST /api/inspector/v1/bikes/:bikeId/inspect`

**UI Mapping**: Form "Đánh giá tình trạng" với các dropdown và textarea

### Request Body
```json
{
  "status": "passed",                    // REQUIRED: "passed" | "failed"
  "overallCondition": "good",           // REQUIRED: "excellent" | "good" | "fair" | "poor"
  "frameCondition": "excellent",        // Optional
  "brakeCondition": "good",             // Optional
  "drivetrainCondition": "fair",        // Optional
  "wheelCondition": "good",             // Optional
  "inspectionNote": "Bàn đạp thay mới, phanh OK", // Optional
  "recommendation": "Phù hợp để sử dụng",         // Optional
  "inspectionImages": ["url1.jpg"],               // Optional
  "reportFile": "report.pdf"                      // Optional
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "inspection-uuid",
    "bikeId": "bike-uuid",
    "inspectorId": "inspector-uuid",
    "status": "passed",
    "overallCondition": "good",
    "frameCondition": "excellent",
    "brakeCondition": "good",
    "drivetrainCondition": "fair",
    "wheelCondition": "good",
    "inspectionNote": "Bàn đạp thay mới, phanh OK",
    "inspectionImages": ["url1.jpg"],
    "createdAt": "2024-01-15T11:00:00Z"
  },
  "message": "Inspection completed. Bike status: verified"
}
```

### Frontend Example
```jsx
const InspectionForm = ({ bikeId }) => {
  const [formData, setFormData] = useState({
    status: 'passed',
    overallCondition: '',
    frameCondition: '',
    brakeCondition: '',
    drivetrainCondition: '',
    wheelCondition: '',
    inspectionNote: '',
    inspectionImages: []
  });

  const handleSubmit = async () => {
    // Validate
    if (!formData.overallCondition) {
      alert('Vui lòng chọn tình trạng chung');
      return;
    }

    const response = await fetch(
      `/api/inspector/v1/bikes/${bikeId}/inspect`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      }
    );

    const result = await response.json();
    if (result.success) {
      alert('Kiểm định thành công!');
      navigate('/inspector/history');
    }
  };

  return (
    <Form>
      <Section>
        <Label>Tình trạng chung *</Label>
        <Select 
          value={formData.overallCondition}
          onChange={(e) => setFormData({...formData, overallCondition: e.target.value})}
        >
          <option value="">Chọn tình trạng</option>
          <option value="excellent">Tuyệt vời</option>
          <option value="good">Tốt</option>
          <option value="fair">Bình thường</option>
          <option value="poor">Kém</option>
        </Select>
      </Section>

      <Section>
        <Label>Tình trạng khung</Label>
        <Select 
          value={formData.frameCondition}
          onChange={(e) => setFormData({...formData, frameCondition: e.target.value})}
        >
          <option value="">Chọn tình trạng</option>
          <option value="excellent">Tuyệt vời</option>
          <option value="good">Tốt</option>
          <option value="fair">Bình thường</option>
          <option value="poor">Kém</option>
        </Select>
      </Section>

      {/* Similar for brake, drivetrain, wheel */}

      <Section>
        <Label>Ghi chú thêm</Label>
        <Textarea 
          value={formData.inspectionNote}
          onChange={(e) => setFormData({...formData, inspectionNote: e.target.value})}
          placeholder="Nhập bất kỳ nhận xét hoặc vấn đề khác..."
        />
      </Section>

      <Section>
        <Label>Upload hình ảnh kiểm định</Label>
        <ImageUpload 
          onUpload={(urls) => setFormData({...formData, inspectionImages: urls})}
        />
      </Section>

      <ButtonGroup>
        <Button variant="secondary" onClick={() => navigate(-1)}>Hủy</Button>
        <Button variant="primary" onClick={handleSubmit}>✓ Xác nhận kiểm định</Button>
      </ButtonGroup>
    </Form>
  );
};
```

---

## 📋 6. Lịch Sử Kiểm Định

**Endpoint**: `GET /api/inspector/v1/inspections`

**UI Mapping**: Màn hình "Lịch sử kiểm định"

### Query Parameters
- `search` (optional): Tìm kiếm theo title, brand, seller name
- `sort` (optional): `newest` (default), `oldest`, `price_asc`, `price_desc`
- `status` (optional): `passed` | `failed`

### Request Examples
```
GET /api/inspector/v1/inspections
GET /api/inspector/v1/inspections?status=passed
GET /api/inspector/v1/inspections?search=Trek&sort=newest
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "inspection": {
        "id": "uuid",
        "bikeId": "uuid",
        "inspectorId": "uuid",
        "status": "passed",
        "overallCondition": "good",
        "frameCondition": "excellent",
        "brakeCondition": "good",
        "drivetrainCondition": "fair",
        "wheelCondition": "good",
        "inspectionNote": "Bàn đạp thay mới, phanh OK",
        "createdAt": "2024-01-15T11:00:00Z"
      },
      "bikeTitle": "Xe đạp địa hình Trek X-Caliber 8",
      "bikeBrand": "Trek",
      "bikeModel": "X-Caliber 8",
      "bikePrice": 22000000,
      "bikeCondition": "Tốt",
      "bikeImages": ["url1.jpg"],
      "sellerName": "Trần Văn M"
    }
  ]
}
```

### Frontend Example
```jsx
const HistoryPage = () => {
  const [inspections, setInspections] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInspections = async () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);

    const response = await fetch(
      `/api/inspector/v1/inspections?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { data } = await response.json();
    setInspections(data);
  };

  return (
    <div>
      <Header>
        <Title>Lịch sử kiểm định</Title>
        <Subtitle>Danh sách các xe đã hoàn thành kiểm định chất lượng</Subtitle>
      </Header>

      <SearchBar 
        placeholder="Tìm kiếm theo tiêu đề, người bán..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Table>
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Người bán</th>
            <th>Giá</th>
            <th>Tình trạng</th>
            <th>Thời gian kiểm định</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {inspections.map(item => (
            <tr key={item.inspection.id}>
              <td>{item.bikeTitle}</td>
              <td>{item.sellerName}</td>
              <td>{formatPrice(item.bikePrice)}</td>
              <td>{item.inspection.overallCondition}</td>
              <td>{formatTimeAgo(item.inspection.createdAt)}</td>
              <td>
                <StatusBadge status={item.inspection.status}>
                  {item.inspection.status === 'passed' ? '✓ Đã kiểm' : '✗ Không đạt'}
                </StatusBadge>
              </td>
              <td>
                <Button onClick={() => navigate(`/inspector/history/${item.inspection.id}`)}>
                  Xem chi tiết
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};
```

---

## 📊 7. Chi Tiết Báo Cáo Kiểm Định

**Endpoint**: `GET /api/inspector/v1/inspections/:inspectionId`

**UI Mapping**: Màn hình "Chi tiết kiểm định"

### Response
```json
{
  "success": true,
  "data": {
    "inspection": {
      "id": "uuid",
      "bikeId": "uuid",
      "inspectorId": "uuid",
      "status": "passed",
      "overallCondition": "good",
      "frameCondition": "excellent",
      "brakeCondition": "good",
      "drivetrainCondition": "fair",
      "wheelCondition": "good",
      "inspectionNote": "Bàn đạp thay mới, phanh OK",
      "recommendation": null,
      "inspectionImages": ["url1.jpg"],
      "createdAt": "2024-01-15T11:00:00Z"
    },
    "bike": {
      "id": "uuid",
      "title": "Xe đạp mountain bike Merida Big Nine",
      "price": 18500000,
      "condition": "Tốt",
      // ... all bike fields
    },
    "inspector": {
      "id": "uuid",
      "name": "Kiểm duyệt viên",
      "email": "inspector@example.com"
    }
  }
}
```

### Frontend Example
```jsx
const InspectionDetailPage = ({ inspectionId }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      const response = await fetch(
        `/api/inspector/v1/inspections/${inspectionId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const result = await response.json();
      setData(result.data);
    };
    fetchDetail();
  }, [inspectionId]);

  if (!data) return <Loading />;

  return (
    <Container>
      <BackButton onClick={() => navigate(-1)}>← Quay lại</BackButton>

      <Card>
        <Title>Chi tiết kiểm định</Title>
        <Subtitle>Xem thông tin kiểm định đã hoàn thành</Subtitle>

        <Section>
          <Label>Xe đạp</Label>
          <BikeInfo>
            <h3>{data.bike.title}</h3>
            <p>Người bán: {data.bike.sellerName}</p>
            <p>Giá: {formatPrice(data.bike.price)}</p>
            <p>Tình trạng ban đầu: {data.bike.condition}</p>
          </BikeInfo>
        </Section>

        <Section>
          <Label>Kết quả kiểm định</Label>
          <StatusBadge status={data.inspection.status}>
            {data.inspection.status === 'passed' ? '✓ Đã kiểm' : '✗ Không đạt'}
          </StatusBadge>
          <p>Tình trạng: {data.inspection.overallCondition}</p>
          <p>Thời gian: {formatDateTime(data.inspection.createdAt)}</p>
        </Section>

        <Section>
          <Label>Ghi chú kiểm định</Label>
          <p>{data.inspection.inspectionNote || 'Không có ghi chú'}</p>
        </Section>

        {data.inspection.inspectionImages?.length > 0 && (
          <Section>
            <Label>Hình ảnh kiểm định</Label>
            <ImageGallery images={data.inspection.inspectionImages} />
          </Section>
        )}
      </Card>
    </Container>
  );
};
```

---

## 🔄 8. Cập Nhật Báo Cáo (Optional)

**Endpoint**: `PUT /api/inspector/v1/inspections/:inspectionId`

**Chức năng**: Cho phép inspector sửa lại báo cáo kiểm định của mình

### Request Body
```json
{
  "status": "passed",
  "overallCondition": "excellent",
  "inspectionNote": "Updated note..."
}
```

---

## 🔐 Authentication Flow

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/v1/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'inspector@example.com',
    password: 'password123'
  })
});
const { token } = await loginResponse.json();

// 2. Store token
localStorage.setItem('token', token);

// 3. Use token in all requests
const response = await fetch('/api/inspector/v1/dashboard', {
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🎨 UI Component Mapping

| UI Screen | API Endpoint | Component Name |
|-----------|--------------|----------------|
| Trang chủ (Dashboard) | `GET /dashboard` | `InspectorDashboard` |
| Danh sách kiểm định | `GET /bikes/pending` | `BikeListPage` |
| Form kiểm định | `GET /bikes/:id`<br>`POST /bikes/:id/inspect` | `InspectionForm` |
| Lịch sử kiểm định | `GET /inspections` | `HistoryPage` |
| Chi tiết báo cáo | `GET /inspections/:id` | `InspectionDetail` |

---

## 📦 Data Flow Summary

```
INSPECTOR LOGIN
    ↓
DASHBOARD (View statistics)
    ↓
BIKES LIST (Browse pending bikes)
    ↓
SELECT BIKE → View detail
    ↓
START INSPECTION (optional)
    ↓
FILL FORM (conditions, notes, images)
    ↓
SUBMIT → Create inspection record
    ↓
BIKE STATUS UPDATED (verified/failed)
    ↓
VIEW HISTORY (See all completed inspections)
```

---

## ✅ Checklist Implementation

### Backend ✓
- [x] Dashboard API
- [x] Pending bikes list with search & filter
- [x] Bike detail
- [x] Start inspection
- [x] Submit inspection
- [x] Inspection history with search & filter
- [x] Inspection detail
- [x] Update inspection
- [x] Authentication middleware
- [x] Database schema

### Frontend (To Do)
- [ ] Dashboard page with statistics cards
- [ ] Bike list page with search and filter
- [ ] Inspection form with dropdowns and image upload
- [ ] History page with table view
- [ ] Inspection detail page
- [ ] Navigation between pages
- [ ] Authentication & token management
- [ ] Error handling & loading states

---

## 🚀 Quick Start

### 1. Test với Postman

Import collection: `BESWP_API.postman_collection.json`

### 2. Tạo Inspector Account

```sql
INSERT INTO users (email, password, name, role) 
VALUES ('inspector@test.com', '<hashed_password>', 'Kiểm duyệt viên', 'inspector');
```

### 3. Login & Get Token

```bash
POST /api/auth/v1/login
{
  "email": "inspector@test.com",
  "password": "your_password"
}
```

### 4. Test API

```bash
GET /api/inspector/v1/dashboard
Headers: Authorization: Bearer <token>
```

---

## 📞 Support

Nếu có câu hỏi hoặc cần hỗ trợ thêm:
- Check `INSPECTOR_API_GUIDE.md` for detailed API docs
- Check `POSTMAN_GUIDE.md` for API testing
- Review code trong `src/controllers/inspectorController.ts`

---

**Status**: ✅ Backend Complete - Ready for Frontend Integration
