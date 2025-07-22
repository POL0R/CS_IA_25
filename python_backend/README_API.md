# Smart Product Recommendation & Pricing API

## 1. POST `/match-products`

**Description:**
Returns a list of recommended products based on client requirements, with match scores and explanations.

### Request Body (JSON):
```
{
  "application": "Auto DG-Solar Switch",
  "power_load_kw": 120,
  "voltage_rating": 415,
  "phase_type": "3-phase",
  "mount_type": "Outdoor",
  "compliance": ["IS-8623", "IEC-61439"],
  "preferred_features": ["Remote monitoring", "Harmonic filtering"]
}
```

### Response (JSON):
```
[
  {
    "product_id": 1,
    "name": "Auto Transfer Switch Panel - 120kW",
    "match_score": 0.92,
    "why_suitable": [
      "Supports 120kW load",
      "Outdoor-rated (IP65)",
      "Compliant with IS-8623",
      "Includes Remote Monitoring Module"
    ],
    "stock_status": "In Stock",
    "lead_time_days": 0
  },
  ...
]
```

**Notes:**
- Products are sorted by `match_score` (descending).
- `why_suitable` explains the match logic for transparency.

---

## 2. GET `/price-breakdown`

**Description:**
Returns a detailed price breakdown for a given product and quantity, including margin and all fees.

### Query Parameters:
- `product_id` (int, required): Product ID
- `qty` (int, default 1): Quantity
- `install` (bool, default false): Include installation charge

### Example Request:
```
GET /price-breakdown?product_id=1&qty=2&install=true
```

### Response (JSON):
```
{
  "product_base_price": 190000,
  "customization_fee": 10000,
  "installation_charge": 20000,
  "tax_amount": 43200,
  "delivery_fee": 3000,
  "total_price": 266200,
  "profit_margin_percent": 18.0,
  "net_profit_amount": 40000,
  "note": "Includes 1-year warranty and on-site support"
}
```

**Notes:**
- `total_price` includes all fees and tax.
- `profit_margin_percent` and `net_profit_amount` are calculated from procurement cost and total price.
- `note` is pulled from the product's warranty or support info.

---

## Usage
- Use `/match-products` to recommend products to clients based on their needs.
- Use `/price-breakdown` to show clients a transparent, itemized price for any product.

---

## Future Extensions
- Region-based tax and margin rules
- AI learning from requirements history
- More advanced feature/need matching 