# FinWise — Complete Project Specification
## Full-Stack Fintech Portfolio App for AmEx Apprenticeship
### Document Version: 1.0 | Target: Coding Agent Build + Live Deployment

---

## 0. AGENT INSTRUCTIONS (READ FIRST)

You are building a complete, production-ready full-stack web application called **FinWise**.
Follow every section in order. Do not skip steps. Do not simplify unless explicitly marked OPTIONAL.
When a section says "exactly", it means the output must match the spec precisely.

**Build order:**
1. Project scaffolding + environment setup
2. Database schema + models
3. Backend API (all endpoints)
4. Unit tests (write alongside backend, not after)
5. Frontend (all pages)
6. Deployment config files
7. README

---

## 1. PROJECT OVERVIEW

| Field | Value |
|---|---|
| **App Name** | FinWise |
| **Tagline** | Track. Analyze. Decide. |
| **Type** | Full-stack fintech web application |
| **Purpose** | Personal finance tracker with transaction management, spending analytics, and live exchange rate data collection |
| **Target User** | Individual users managing personal income and expenses |
| **Portfolio Goal** | Demonstrate REST API design, database schema, frontend JS, data collection, and testing for AmEx apprenticeship |

---

## 2. TECH STACK (EXACT — DO NOT SUBSTITUTE)

### Backend
| Layer | Technology | Version |
|---|---|---|
| Language | Python | 3.11+ |
| Framework | FastAPI | 0.111+ |
| ORM | SQLAlchemy | 2.0+ |
| DB Driver | psycopg2-binary | latest |
| Auth | python-jose[cryptography] + passlib[bcrypt] | latest |
| Validation | Pydantic v2 | 2.0+ |
| HTTP Client | httpx | latest |
| Scheduler | APScheduler | 3.10+ |
| Testing | pytest + pytest-asyncio + httpx | latest |
| Docs | Swagger UI (built-in FastAPI at /docs) | built-in |
| Server | uvicorn | latest |

### Database
| Layer | Technology |
|---|---|
| Database | PostgreSQL 15 |
| Migrations | Alembic |

### Frontend
| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no frameworks — Tailwind NOT allowed) |
| Scripting | Vanilla JavaScript (ES6+, no React/Vue) |
| Charts | Chart.js 4.x (CDN) |
| Icons | Lucide Icons (CDN) |
| Fonts | Inter from Google Fonts |

### Deployment
| Service | Purpose | Tier |
|---|---|---|
| Render.com | Backend API hosting | Free |
| Render.com | PostgreSQL database | Free (90 days) |
| Render.com | Frontend static site | Free |

---

## 3. COMPLETE FILE STRUCTURE

The coding agent must create exactly this structure. No extra files. No missing files.

```
finwise/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Settings via pydantic BaseSettings
│   │   ├── database.py              # SQLAlchemy engine + session
│   │   ├── auth.py                  # JWT creation, verification, password hashing
│   │   ├── dependencies.py          # get_db, get_current_user dependencies
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   ├── category.py
│   │   │   └── exchange_rate.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── transaction.py
│   │   │   ├── category.py
│   │   │   ├── report.py
│   │   │   └── exchange_rate.py
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # /auth/register, /auth/login, /auth/me
│   │   │   ├── transactions.py      # /transactions CRUD
│   │   │   ├── categories.py        # /categories CRUD
│   │   │   ├── reports.py           # /reports/summary, /reports/by-category, etc.
│   │   │   └── data.py              # /data/exchange-rates, /data/latest
│   │   │
│   │   └── services/
│   │       ├── __init__.py
│   │       └── data_collector.py    # APScheduler + exchange rate fetcher
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py              # pytest fixtures, test DB setup
│   │   ├── test_auth.py
│   │   ├── test_transactions.py
│   │   ├── test_categories.py
│   │   └── test_reports.py
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   │
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example
│   └── Procfile                     # For Render deployment
│
├── frontend/
│   ├── index.html                   # Login + Register page
│   ├── dashboard.html               # Main dashboard
│   ├── transactions.html            # Transaction list + add/edit
│   ├── reports.html                 # Charts and analytics
│   ├── rates.html                   # Live exchange rates page
│   │
│   └── assets/
│       ├── css/
│       │   ├── base.css             # Reset, variables, typography
│       │   ├── components.css       # Buttons, cards, inputs, modals
│       │   ├── layout.css           # Sidebar, topbar, grid
│       │   └── pages.css            # Page-specific styles
│       │
│       └── js/
│           ├── config.js            # API_BASE_URL constant
│           ├── api.js               # All fetch() calls to backend
│           ├── auth.js              # Login, register, token management
│           ├── dashboard.js         # Dashboard page logic
│           ├── transactions.js      # Transaction CRUD logic
│           ├── reports.js           # Chart rendering
│           └── rates.js             # Exchange rates display
│
├── render.yaml                      # Render deployment config (IaC)
└── README.md                        # Portfolio README (spec in Section 12)
```

---

## 4. DATABASE SCHEMA (EXACT DDL)

Create these 4 tables via Alembic migration `001_initial_schema.py`.

### 4.1 users
```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    username    VARCHAR(100) NOT NULL,
    full_name   VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.2 categories
```sql
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(50) NOT NULL,       -- lucide icon name e.g. "shopping-cart"
    color       VARCHAR(7) NOT NULL,        -- hex e.g. "#4F46E5"
    is_default  BOOLEAN DEFAULT FALSE,      -- TRUE = system category, all users see it
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL if is_default=TRUE
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Seed these default categories on startup (is_default=TRUE, user_id=NULL):**
| name | icon | color |
|---|---|---|
| Food & Dining | utensils | #F59E0B |
| Transport | car | #3B82F6 |
| Shopping | shopping-cart | #8B5CF6 |
| Bills & Utilities | zap | #EF4444 |
| Entertainment | film | #EC4899 |
| Health | heart-pulse | #10B981 |
| Travel | plane | #06B6D4 |
| Income | trending-up | #22C55E |
| Other | circle-dot | #6B7280 |

### 4.3 transactions
```sql
CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    amount      DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    type        VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    description VARCHAR(500),
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
```

### 4.4 exchange_rates
```sql
CREATE TABLE exchange_rates (
    id          SERIAL PRIMARY KEY,
    base        VARCHAR(5) NOT NULL DEFAULT 'USD',
    target      VARCHAR(5) NOT NULL,
    rate        DECIMAL(18, 8) NOT NULL,
    source      VARCHAR(100) NOT NULL DEFAULT 'open.er-api.com',
    fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_exchange_rates_fetched_at ON exchange_rates(fetched_at DESC);
CREATE INDEX idx_exchange_rates_target ON exchange_rates(target);
```

---

## 5. BACKEND — COMPLETE API SPECIFICATION

### 5.1 app/config.py
```python
# Use pydantic BaseSettings. Load from environment variables.
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str           # min 32 chars
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    EXCHANGE_RATE_API_URL: str = "https://open.er-api.com/v6/latest/USD"
    COLLECT_INTERVAL_HOURS: int = 6

    class Config:
        env_file = ".env"
```

### 5.2 app/auth.py
Implement:
- `hash_password(password: str) -> str` using bcrypt
- `verify_password(plain: str, hashed: str) -> bool`
- `create_access_token(data: dict) -> str` — HS256 JWT with exp claim
- `decode_access_token(token: str) -> dict` — raises HTTPException 401 if invalid/expired

### 5.3 app/main.py
```python
# Must include:
# - CORSMiddleware with allow_origins=["*"] for development
# - Include all routers with prefix /api/v1
# - Startup event: seed default categories if table is empty
# - Startup event: start APScheduler for data collection
# - Root endpoint GET / returns {"status": "FinWise API running", "docs": "/docs"}
# - GET /health returns {"status": "healthy", "timestamp": <utcnow>}
```

---

### 5.4 AUTH ROUTER — /api/v1/auth

#### POST /api/v1/auth/register
**Request body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "password": "StrongPass123!"
}
```
**Validation:**
- email: valid email format, unique in DB
- username: 3–50 chars, alphanumeric + underscores only
- password: min 8 chars, must contain uppercase, lowercase, digit
- full_name: optional, max 255 chars

**Success Response 201:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "created_at": "2024-01-15T10:30:00Z"
}
```
**Error 400:** email already registered
**Error 422:** validation failure with field-level detail

---

#### POST /api/v1/auth/login
**Request body (form data — OAuth2 compatible):**
```json
{
  "username": "user@example.com",
  "password": "StrongPass123!"
}
```
Note: `username` field accepts email (OAuth2 standard).

**Success Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe"
  }
}
```
**Error 401:** Invalid credentials

---

#### GET /api/v1/auth/me
**Auth:** Bearer token required

**Success Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### 5.5 CATEGORIES ROUTER — /api/v1/categories
**All endpoints require Bearer token.**

#### GET /api/v1/categories
Returns all default categories PLUS categories created by the current user.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Food & Dining",
    "icon": "utensils",
    "color": "#F59E0B",
    "is_default": true,
    "user_id": null
  },
  ...
]
```

#### POST /api/v1/categories
Create a custom category for the current user.

**Request body:**
```json
{
  "name": "Gym",
  "icon": "dumbbell",
  "color": "#F97316"
}
```
**Validation:** name 1–100 chars, color valid hex (#RRGGBB), icon non-empty string
**Response 201:** created category object
**Error 400:** user already has a category with same name

#### PUT /api/v1/categories/{category_id}
Update a user-created category. Cannot modify default categories.
**Error 403:** if attempting to modify a default category
**Error 404:** category not found or not owned by user
**Response 200:** updated category object

#### DELETE /api/v1/categories/{category_id}
Delete a user-created category. Cannot delete defaults.
**Error 403:** if attempting to delete a default category
**Error 409:** if category has transactions — return count of affected transactions
**Response 204:** no content on success

---

### 5.6 TRANSACTIONS ROUTER — /api/v1/transactions
**All endpoints require Bearer token.**

#### GET /api/v1/transactions
Retrieve paginated, filterable list of transactions for current user.

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| page | int | 1 | Page number |
| limit | int | 20 | Items per page (max 100) |
| type | string | null | "income" or "expense" |
| category_id | int | null | Filter by category |
| start_date | date | null | YYYY-MM-DD |
| end_date | date | null | YYYY-MM-DD |
| search | string | null | Search in description |
| sort_by | string | "date" | "date", "amount", "created_at" |
| order | string | "desc" | "asc" or "desc" |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "amount": 250.00,
      "type": "expense",
      "description": "Grocery shopping",
      "date": "2024-01-15",
      "category": {
        "id": 1,
        "name": "Food & Dining",
        "icon": "utensils",
        "color": "#F59E0B"
      },
      "created_at": "2024-01-15T18:30:00Z"
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

#### POST /api/v1/transactions
**Request body:**
```json
{
  "amount": 250.00,
  "type": "expense",
  "category_id": 1,
  "description": "Grocery shopping at BigMart",
  "date": "2024-01-15"
}
```
**Validation:**
- amount: positive decimal, max 2 decimal places, max 999999999.99
- type: exactly "income" or "expense"
- category_id: must exist and be accessible to the user
- description: optional, max 500 chars
- date: valid date, not more than 5 years in the past, not in future

**Response 201:** full transaction object (same shape as GET item)

#### GET /api/v1/transactions/{transaction_id}
**Response 200:** single transaction object
**Error 404:** not found or not owned by user

#### PUT /api/v1/transactions/{transaction_id}
All fields optional (partial update).
**Response 200:** updated transaction object
**Error 404:** not found or not owned by user

#### DELETE /api/v1/transactions/{transaction_id}
**Response 204:** no content
**Error 404:** not found or not owned by user

---

### 5.7 REPORTS ROUTER — /api/v1/reports
**All endpoints require Bearer token.**

#### GET /api/v1/reports/summary
**Query params:** `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD)
Default: current calendar month

**Response 200:**
```json
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "total_income": 85000.00,
  "total_expenses": 32450.75,
  "net_balance": 52549.25,
  "transaction_count": 23,
  "avg_daily_expense": 1046.80,
  "largest_expense": {
    "amount": 12000.00,
    "description": "Rent",
    "date": "2024-01-01",
    "category": "Bills & Utilities"
  }
}
```

#### GET /api/v1/reports/by-category
**Query params:** `start_date`, `end_date`, `type` (default "expense")

**Response 200:**
```json
{
  "period": { "start": "...", "end": "..." },
  "type": "expense",
  "total": 32450.75,
  "breakdown": [
    {
      "category_id": 1,
      "category_name": "Food & Dining",
      "icon": "utensils",
      "color": "#F59E0B",
      "amount": 8200.00,
      "percentage": 25.3,
      "transaction_count": 12
    }
  ]
}
```
Sort breakdown by amount descending.

#### GET /api/v1/reports/monthly-trend
**Query params:** `months` (int, default 6, max 12)
Returns last N months of income vs expense data.

**Response 200:**
```json
{
  "months": [
    {
      "month": "2024-01",
      "label": "Jan 2024",
      "income": 85000.00,
      "expenses": 32450.75,
      "net": 52549.25
    }
  ]
}
```

#### GET /api/v1/reports/daily-trend
**Query params:** `start_date`, `end_date` (default: last 30 days)
Returns daily expense totals for sparkline charts.

**Response 200:**
```json
{
  "daily": [
    { "date": "2024-01-01", "expenses": 12000.00, "income": 85000.00 }
  ]
}
```

---

### 5.8 DATA ROUTER — /api/v1/data

#### GET /api/v1/data/exchange-rates
**No auth required.**
Returns the most recently collected exchange rates (all currencies vs USD).

**Response 200:**
```json
{
  "base": "USD",
  "last_updated": "2024-01-15T12:00:00Z",
  "rates": {
    "INR": 83.15,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 148.50,
    "AUD": 1.53,
    "CAD": 1.34,
    "SGD": 1.34,
    "AED": 3.67,
    "CNY": 7.19,
    "CHF": 0.89
  }
}
```
If no data collected yet, return 503 with message "Data not yet collected. Try again in a moment."

#### POST /api/v1/data/collect (trigger manual collection)
**Auth required.**
Manually triggers a data collection run. Returns immediately with status.

**Response 202:**
```json
{ "status": "collection triggered", "message": "Exchange rates will be updated shortly." }
```

#### GET /api/v1/data/collection-history
**Auth required.**
**Query params:** `limit` (default 10, max 50)
Returns the last N collection timestamps.

**Response 200:**
```json
{
  "collections": [
    { "fetched_at": "2024-01-15T12:00:00Z", "currency_count": 32, "base": "USD" }
  ]
}
```

---

### 5.9 DATA COLLECTION SERVICE — app/services/data_collector.py

```python
# This service runs on startup via APScheduler
# Schedule: every 6 hours (configurable via COLLECT_INTERVAL_HOURS env var)
# On each run:
# 1. Fetch from https://open.er-api.com/v6/latest/USD (free, no API key needed)
# 2. Parse response: {"rates": {"INR": 83.15, "EUR": 0.92, ...}}
# 3. Insert ALL currency rates as individual rows in exchange_rates table
# 4. Log: "Collected {count} exchange rates at {timestamp}"
# 5. On failure: log error, do NOT crash the app

# Also run once immediately on startup (don't wait 6 hours for first data)
```

---

## 6. UNIT TESTS SPECIFICATION

### 6.1 tests/conftest.py
```python
# - Create a separate test database (use SQLite for speed, or test PostgreSQL)
# - Override get_db dependency with test DB
# - Fixture: test_client -> TestClient(app)
# - Fixture: test_user -> creates a user, returns {"user": ..., "token": "Bearer eyJ..."}
# - Fixture: test_categories -> seeds default categories in test DB
# - Fixture: sample_transactions -> creates 10 test transactions for test_user
# - Teardown: drop all tables after each test module
```

### 6.2 tests/test_auth.py — Minimum 8 tests
```
test_register_success
test_register_duplicate_email_fails
test_register_weak_password_fails
test_register_invalid_email_fails
test_login_success_returns_token
test_login_wrong_password_fails
test_login_nonexistent_user_fails
test_get_me_with_valid_token
test_get_me_with_invalid_token_fails
```

### 6.3 tests/test_transactions.py — Minimum 10 tests
```
test_create_transaction_expense
test_create_transaction_income
test_create_transaction_invalid_amount_fails
test_create_transaction_future_date_fails
test_create_transaction_invalid_category_fails
test_get_transactions_returns_paginated_list
test_get_transactions_filter_by_type
test_get_transactions_filter_by_date_range
test_update_transaction_success
test_delete_transaction_success
test_cannot_access_other_users_transactions
```

### 6.4 tests/test_reports.py — Minimum 5 tests
```
test_summary_returns_correct_totals
test_summary_empty_period_returns_zeros
test_by_category_sums_correctly
test_monthly_trend_returns_n_months
test_daily_trend_returns_date_range
```

**Coverage target:** Run `pytest --cov=app --cov-report=term-missing` — must show ≥ 70% coverage.

---

## 7. FRONTEND SPECIFICATION

### 7.1 Design Tokens (define in base.css as CSS variables)
```css
:root {
  /* Brand Colors */
  --color-primary: #1D4ED8;        /* AmEx-inspired deep blue */
  --color-primary-light: #3B82F6;
  --color-primary-dark: #1E3A8A;
  --color-accent: #10B981;         /* Green for income/positive */
  --color-danger: #EF4444;         /* Red for expense/negative */
  --color-warning: #F59E0B;        /* Amber for alerts */

  /* Neutrals */
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;

  /* Sidebar */
  --color-sidebar-bg: #0F172A;
  --color-sidebar-text: #CBD5E1;
  --color-sidebar-active: #1D4ED8;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

### 7.2 Layout (layout.css)
All authenticated pages use a **sidebar + main content** layout:
```
┌─────────────────────────────────────────┐
│  SIDEBAR (240px fixed left)             │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Logo        │  │   TOP BAR       │  │
│  │  FinWise     │  │  (search+user)  │  │
│  ├──────────────┤  ├─────────────────┤  │
│  │  Dashboard   │  │                 │  │
│  │  Transactions│  │   PAGE CONTENT  │  │
│  │  Reports     │  │                 │  │
│  │  Rates       │  │                 │  │
│  │              │  │                 │  │
│  │  ──────────  │  │                 │  │
│  │  Logout      │  └─────────────────┘  │
│  └──────────────┘                       │
└─────────────────────────────────────────┘
```

Mobile (< 768px): sidebar collapses to hamburger menu.

### 7.3 assets/js/config.js
```javascript
// IMPORTANT: coding agent must set this to the deployed Render URL after deployment
const API_BASE_URL = 'http://localhost:8000/api/v1';
// In production this becomes: 'https://finwise-api.onrender.com/api/v1'
```

### 7.4 assets/js/api.js
Implement these functions (all return parsed JSON or throw Error):
```javascript
// Auth
async function apiRegister(email, username, fullName, password)
async function apiLogin(email, password)
async function apiGetMe()

// Categories
async function apiGetCategories()
async function apiCreateCategory(name, icon, color)
async function apiDeleteCategory(id)

// Transactions
async function apiGetTransactions(params = {})
async function apiCreateTransaction(data)
async function apiUpdateTransaction(id, data)
async function apiDeleteTransaction(id)

// Reports
async function apiGetSummary(startDate, endDate)
async function apiByCategoryReport(startDate, endDate, type)
async function apiMonthlyTrend(months)

// Data
async function apiGetExchangeRates()
async function apiTriggerCollection()

// Helper: all authenticated requests include Authorization: Bearer <token>
// Token stored in localStorage under key 'finwise_token'
// On 401 response: clear token, redirect to index.html
```

---

### 7.5 PAGE: index.html (Login / Register)

**Layout:** Centered two-panel layout
- Left panel: App branding — "FinWise" logo, tagline "Track. Analyze. Decide.", 3 bullet-point features
- Right panel: Tab-toggled Login / Register forms

**Login form fields:**
- Email (type="email", required)
- Password (type="password", required)
- "Sign In" button
- Link: "Don't have an account? Register"

**Register form fields:**
- Full Name (optional)
- Email (required)
- Username (required)
- Password (required) + strength indicator (weak/medium/strong)
- Confirm Password (required)
- "Create Account" button

**Behavior:**
- On successful login: store token to localStorage, redirect to dashboard.html
- On failed login: show inline error message below form (not alert())
- Validate passwords match before submitting register
- Show loading spinner on button while request is in flight
- If user is already logged in (valid token in localStorage): redirect to dashboard.html automatically

---

### 7.6 PAGE: dashboard.html

**Top Section — 4 stat cards in a grid:**
| Card | Data Source | Color Indicator |
|---|---|---|
| Total Balance (this month) | net_balance from /reports/summary | green if positive, red if negative |
| Total Income | total_income | green |
| Total Expenses | total_expenses | red |
| Transactions | transaction_count | blue |

Each card shows: label, large number (formatted with commas + 2 decimal places), and a small % change vs last month (green up arrow or red down arrow).

**Middle Section — 2 charts side by side:**
- Left: Doughnut chart — spending by category (this month) — from /reports/by-category
- Right: Line chart — income vs expenses last 6 months — from /reports/monthly-trend

Chart library: Chart.js 4.x loaded from CDN.

**Bottom Section — Recent Transactions table:**
- Last 5 transactions from /transactions?limit=5
- Columns: Date | Category (icon + name) | Description | Amount (red for expense, green for income)
- "View All" link → transactions.html

**Behavior:**
- All 4 data sections load in parallel (Promise.all)
- Show skeleton loading placeholders while fetching
- Show error state if any fetch fails
- Display current user's name in topbar: "Welcome back, {username}"

---

### 7.7 PAGE: transactions.html

**Top section:**
- Page title "Transactions"
- "+ Add Transaction" button (opens modal)
- Filter bar: Type dropdown | Category dropdown | Date range (start + end) | Search input | "Apply" button | "Reset" button

**Transaction Table:**
| Column | Details |
|---|---|
| Date | formatted as "15 Jan 2024" |
| Category | colored icon circle + category name |
| Description | truncated at 40 chars with tooltip on hover |
| Type | badge: "Income" (green) or "Expense" (red) |
| Amount | ₹ X,XXX.XX — red for expense, green for income |
| Actions | Edit (pencil icon) | Delete (trash icon) |

- Pagination: Previous / Page X of Y / Next
- Row hover: subtle background highlight

**Add/Edit Transaction Modal:**
- Fields: Amount, Type (radio: Income/Expense), Category (dropdown), Description, Date
- "Save" and "Cancel" buttons
- Form validation with inline error messages
- On save: refresh transaction list (no full page reload)
- Pre-fill all fields when editing

**Delete Confirmation:**
- Inline confirmation prompt within the row (not browser confirm())
- "Confirm Delete" and "Cancel" buttons appear, then disappear on cancel

**Behavior:**
- Filters update URL query params (so links are shareable)
- Currency formatted as ₹ (Indian Rupee — INR) throughout the frontend

---

### 7.8 PAGE: reports.html

**Section 1 — Date Range Picker:**
- Preset buttons: "This Month" | "Last Month" | "Last 3 Months" | "Last 6 Months" | "This Year"
- Or custom start/end date inputs
- "Apply" button — all charts refresh

**Section 2 — Summary Cards:**
Same 4 cards as dashboard but for the selected period.

**Section 3 — Spending by Category:**
- Horizontal bar chart (Chart.js) — categories on Y axis, amount on X axis
- Each bar colored with category's color
- Shows amount + percentage label on each bar

**Section 4 — Monthly Income vs Expense Trend:**
- Line chart — two lines: Income (green) and Expenses (red)
- X axis: months | Y axis: amounts
- Show data points, hover tooltip with exact values

**Section 5 — Daily Spending Heatmap:**
- A simple table-based heatmap (7 columns = days of week, rows = weeks)
- Cells colored from white → deep blue based on expense amount
- Tooltip on hover: "15 Jan: ₹2,340"

---

### 7.9 PAGE: rates.html

**Title:** "Live Exchange Rates" with "Base: USD" badge and "Last updated: {timestamp}" text.

**Manual Refresh button** — calls POST /data/collect then re-fetches GET /data/exchange-rates

**Currency Cards Grid (3 columns):**
Display these 10 currencies with flag emoji, currency name, currency code, and rate:
| Emoji | Name | Code |
|---|---|---|
| 🇮🇳 | Indian Rupee | INR |
| 🇪🇺 | Euro | EUR |
| 🇬🇧 | British Pound | GBP |
| 🇯🇵 | Japanese Yen | JPY |
| 🇦🇺 | Australian Dollar | AUD |
| 🇨🇦 | Canadian Dollar | CAD |
| 🇸🇬 | Singapore Dollar | SGD |
| 🇦🇪 | UAE Dirham | AED |
| 🇨🇳 | Chinese Yuan | CNY |
| 🇨🇭 | Swiss Franc | CHF |

Each card: flag + currency name + code on left, large rate number on right (e.g. "83.15")

**Currency Converter Widget below grid:**
- Input: Amount in USD
- Output: live converted amount in selected currency (dropdown)
- No API call — calculate client-side from stored rates

---

## 8. ENVIRONMENT VARIABLES

### backend/.env.example (commit this file, NOT .env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/finwise_db
SECRET_KEY=your-super-secret-key-min-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest/USD
COLLECT_INTERVAL_HOURS=6
```

---

## 9. REQUIREMENTS.TXT (EXACT)

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic[email]==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
apscheduler==3.10.4
pytest==8.2.0
pytest-asyncio==0.23.6
pytest-cov==5.0.0
python-multipart==0.0.9
```

---

## 10. DEPLOYMENT CONFIGURATION

### 10.1 backend/Procfile
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 10.2 render.yaml (in project root)
```yaml
databases:
  - name: finwise-db
    databaseName: finwise_db
    user: finwise_user
    plan: free

services:
  - type: web
    name: finwise-api
    env: python
    buildCommand: "pip install -r requirements.txt && alembic upgrade head"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: finwise-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: PYTHON_VERSION
        value: 3.11.0
    rootDir: backend

  - type: web
    name: finwise-frontend
    env: static
    buildCommand: ""
    staticPublishPath: ./frontend
    envVars: []
```

### 10.3 Step-by-Step Render Deployment Instructions

**Step 1 — Push to GitHub**
```bash
git init
git add .
git commit -m "feat: initial FinWise full-stack implementation"
git remote add origin https://github.com/<your-username>/finwise.git
git push -u origin main
```

**Step 2 — Deploy on Render**
1. Go to https://render.com → Sign up with GitHub
2. Click "New" → "Blueprint"
3. Connect your GitHub repo
4. Render will detect render.yaml and create 3 services: DB + API + Frontend
5. Click "Apply" — deployment starts automatically

**Step 3 — Set Secret Key**
- In Render dashboard → finwise-api service → Environment tab
- SECRET_KEY will be auto-generated (check it's set)

**Step 4 — Update Frontend API URL**
- After API deploys, copy its URL: `https://finwise-api.onrender.com`
- Update `frontend/assets/js/config.js`:
  ```javascript
  const API_BASE_URL = 'https://finwise-api.onrender.com/api/v1';
  ```
- Commit and push → frontend auto-redeploys

**Step 5 — Verify**
- API: visit `https://finwise-api.onrender.com/docs` → Swagger UI should load
- API health: `https://finwise-api.onrender.com/health` → `{"status": "healthy"}`
- Frontend: `https://finwise-frontend.onrender.com` → login page should load

> ⚠️ Render free tier spins down after 15 minutes of inactivity.
> First request after sleep takes ~30 seconds. This is expected on free tier.

---

## 11. GIT COMMIT CONVENTIONS

The coding agent must make commits in this order with these exact messages:

```
feat: initialize project structure and FastAPI app
feat: add database models and alembic migration
feat: implement JWT authentication (register, login, /me)
feat: add categories CRUD endpoints
feat: add transactions CRUD with pagination and filters
feat: add reports endpoints (summary, by-category, monthly-trend)
feat: add exchange rate data collection service
test: add auth unit tests (9 tests)
test: add transaction unit tests (11 tests)
test: add reports unit tests (5 tests)
feat: add frontend base layout (sidebar, topbar, CSS tokens)
feat: add login and register pages
feat: add dashboard page with charts
feat: add transactions page with modal and filters
feat: add reports page with analytics charts
feat: add exchange rates page with converter widget
chore: add render.yaml deployment config
docs: complete README with architecture, setup, and live links
```

---

## 12. README.md SPECIFICATION

The README must contain ALL of the following sections in this order:

```markdown
# FinWise — Personal Finance Tracker

> Track. Analyze. Decide.

[Live Demo](https://finwise-frontend.onrender.com) | [API Docs](https://finwise-api.onrender.com/docs) | [Backend Repo](link)

## Demo Credentials
Email: demo@finwise.app
Password: Demo@1234

## What This Project Demonstrates
- REST API design with FastAPI (15+ endpoints, JWT auth, pagination, filtering)
- PostgreSQL schema design with SQLAlchemy ORM and Alembic migrations
- Full-stack web development (Python backend + Vanilla JS frontend)
- Automated data collection via APScheduler (exchange rates every 6 hours)
- Unit testing with pytest (25+ tests, 70%+ coverage)
- Agile workflow: feature branches, atomic commits, Swagger documentation
- Cloud deployment on Render (API + DB + Static frontend)

## Architecture Diagram
[insert diagram image or ASCII art showing: Browser → Frontend → FastAPI → PostgreSQL + Scheduler → External API]

## Tech Stack
[table of stack]

## API Endpoints
[table of all endpoints grouped by router]

## Database Schema
[ERD diagram or table description]

## Local Setup
[step by step: clone → create venv → pip install → .env → alembic upgrade head → uvicorn]

## Running Tests
[pytest command + screenshot of coverage output]

## Deployment
[deployed on Render — link to live API + frontend]

## What I'd Add With More Time
- Multi-currency support
- Budget alerts via email
- Mobile app (React Native)
- Export to PDF/Excel
```

---

## 13. DEFINITION OF DONE

The project is complete when ALL of the following are true:

- [ ] All database tables created via Alembic migration (not manually)
- [ ] All 15+ API endpoints implemented and returning correct status codes
- [ ] Swagger UI loads at /docs with all endpoints visible and testable
- [ ] All endpoints return correct error codes (400, 401, 403, 404, 409, 422)
- [ ] 25+ unit tests written and passing (`pytest` exits with 0)
- [ ] Test coverage ≥ 70% (`pytest --cov=app`)
- [ ] Exchange rate collector runs on startup and collects data within 30 seconds
- [ ] All 5 frontend pages render without console errors
- [ ] Dashboard charts load and display real data (not hardcoded)
- [ ] Transaction modal opens, submits, and closes without page reload
- [ ] Pagination works on transactions page
- [ ] Currency converter on rates page works client-side
- [ ] Mobile layout is usable (sidebar collapses on < 768px)
- [ ] render.yaml is valid and all 3 Render services deploy successfully
- [ ] Live API URL returns `{"status": "healthy"}` from /health endpoint
- [ ] Live frontend URL loads login page over HTTPS
- [ ] README contains live links, demo credentials, architecture diagram, and test badge
- [ ] Git history has 17+ meaningful commits (no "fix" or "update" messages)
- [ ] No hardcoded credentials anywhere in the codebase
- [ ] .env is in .gitignore, only .env.example is committed

---

*Document End — FinWise Project Specification v1.0*
*Built for AmEx Apprenticeship Portfolio | Stack: Python + FastAPI + PostgreSQL + Vanilla JS*
