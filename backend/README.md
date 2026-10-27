# 💰 Expense Splitter Backend

> **Team: The Opusol**

A robust REST API backend for splitting expenses among groups of friends, roommates, or colleagues. Built with Node.js, Express, and PostgreSQL.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Installation & Running](#installation--running)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication-endpoints)
  - [Groups](#group-endpoints)
  - [Expenses](#expense-endpoints)
  - [Balances](#balance-endpoints)
  - [Settlements](#settlement-endpoints)
  - [Leave Requests](#leave-request-endpoints)
- [Authentication Guide](#authentication-guide)
- [Money Handling](#money-handling)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Frontend Integration Guide](#frontend-integration-guide)
- [Example Workflow](#example-workflow)

---

## Overview

Expense Splitter allows groups to:
- Track shared expenses with multiple payers
- Split expenses equally, by exact amounts, or by percentage
- Calculate net balances across group members
- Suggest optimized settlements to minimize transactions
- Record and manage settlement payments
- Handle member departures with balance redistribution

All monetary values are stored as **integer paise** (100 paise = 1 currency unit) to avoid floating-point errors.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL 14+ |
| DB Driver | pg (node-postgres) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | Joi |
| Security | Helmet, CORS |
| Testing | Vitest + Supertest |

> **Note:** This project does **not** use Prisma or any ORM. All database queries are written as raw SQL with parameterized inputs.

---

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **PostgreSQL** ≥ 14.0
- A PostgreSQL database created and accessible

---

## Project Structure

```
backend/
├── migrations/
│   └── 001_initial.sql          # Database schema
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection pool
│   │   ├── index.js             # Environment configuration
│   │   └── migrate.js           # Migration runner
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── balanceController.js
│   │   ├── expenseController.js
│   │   ├── groupController.js
│   │   ├── leaveRequestController.js
│   │   └── settlementController.js
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Centralized error handling
│   │   ├── groupAccess.js       # Group membership authorization
│   │   └── validate.js          # Joi validation middleware
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── balanceRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── groupRoutes.js
│   │   ├── leaveRequestRoutes.js
│   │   └── settlementRoutes.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── balanceService.js
│   │   ├── expenseService.js
│   │   ├── groupService.js
│   │   ├── leaveRequestService.js
│   │   └── settlementService.js
│   ├── utils/
│   │   ├── errors.js            # Custom error classes
│   │   └── helpers.js           # Utility functions
│   ├── app.js                   # Express application setup
│   └── server.js                # Server startup
├── tests/
│   ├── helpers/
│   │   └── testUtils.js
│   ├── setup.js
│   ├── auth.test.js
│   ├── balances.test.js
│   ├── expenses.test.js
│   ├── groups.test.js
│   ├── leaveRequests.test.js
│   └── settlements.test.js
├── .env.example
├── .gitignore
├── package.json
├── vitest.config.js
└── README.md
```

---

## Environment Setup

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:

   | Variable | Description | Default |
   |----------|-------------|---------|
   | `PORT` | Server port | `5000` |
   | `DATABASE_URL` | PostgreSQL connection string | (required) |
   | `JWT_SECRET` | Secret key for JWT signing | (required — use a strong random string) |
   | `JWT_EXPIRES_IN` | Token expiration time | `7d` |
   | `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
   | `NODE_ENV` | Environment | `development` |

   **Example `DATABASE_URL`:**
   ```
   postgresql://postgres:yourpassword@localhost:5432/expense_splitter
   ```

---

## Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE expense_splitter;
   ```

2. Run migrations:
   ```bash
   npm run migrate
   ```
   This will create all tables, indexes, and constraints defined in `migrations/001_initial.sql`.

---

## Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# 3. Run database migrations
npm run migrate

# 4. Start development server (with hot reload)
npm run dev

# 5. Or start production server
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

Health check: `GET http://localhost:5000/health`

---

## API Documentation

### Response Format

All API responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Success with message:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detail 1", "Detail 2"]
}
```

---

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Alice",
      "email": "alice@example.com",
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:** `400` Validation error, `409` Email already registered

---

#### POST `/api/auth/login`
Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Alice",
      "email": "alice@example.com",
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors:** `400` Validation error, `401` Invalid credentials

---

#### GET `/api/auth/me`
Get the current user's profile. **Requires authentication.**

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Alice",
    "email": "alice@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### Group Endpoints

All group endpoints require authentication.

#### POST `/api/groups`
Create a new group. The creator is automatically added as a member with the `creator` role.

**Request:**
```json
{
  "name": "Roommates",
  "description": "Shared apartment expenses"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Roommates",
    "description": "Shared apartment expenses",
    "createdBy": "uuid",
    "memberCount": 1,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### GET `/api/groups`
List all groups for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Roommates",
      "description": "Shared apartment expenses",
      "role": "creator",
      "memberCount": 3,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/api/groups/:groupId`
Get group details. **Requires group membership.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Roommates",
    "description": "Shared apartment expenses",
    "createdBy": "uuid",
    "creatorName": "Alice",
    "memberCount": 3,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### POST `/api/groups/:groupId/members`
Add a member by email. **Requires group creator role.**

**Request:**
```json
{
  "email": "bob@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Member added successfully",
  "data": {
    "id": "member-uuid",
    "userId": "uuid",
    "name": "Bob",
    "email": "bob@example.com",
    "role": "member",
    "joinedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Errors:** `404` Email not found, `409` Already a member

---

#### GET `/api/groups/:groupId/members`
List all active members. **Requires group membership.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-uuid",
      "userId": "uuid",
      "name": "Alice",
      "email": "alice@example.com",
      "role": "creator",
      "status": "active",
      "joinedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### DELETE `/api/groups/:groupId/members/:memberId`
Remove a member. **Requires group creator role.** Cannot remove the creator. Cannot remove a member with an outstanding balance (use leave request instead).

**Response (200):**
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Errors:** `400` Outstanding balance, `403` Not authorized, `404` Member not found

---

### Expense Endpoints

#### POST `/api/groups/:groupId/expenses`
Add an expense. **Requires group membership.**

**Request (equal split):**
```json
{
  "title": "Dinner",
  "description": "Pizza night",
  "totalAmount": 30000,
  "splitType": "equal",
  "payers": [
    { "userId": "alice-uuid", "amount": 30000 }
  ],
  "splits": [
    { "userId": "alice-uuid" },
    { "userId": "bob-uuid" },
    { "userId": "charlie-uuid" }
  ]
}
```
> Note: For equal split, amounts are auto-calculated. 30000 ÷ 3 = 10000 each.

**Request (exact split):**
```json
{
  "title": "Groceries",
  "totalAmount": 15000,
  "splitType": "exact",
  "payers": [
    { "userId": "alice-uuid", "amount": 15000 }
  ],
  "splits": [
    { "userId": "alice-uuid", "amount": 5000 },
    { "userId": "bob-uuid", "amount": 7000 },
    { "userId": "charlie-uuid", "amount": 3000 }
  ]
}
```

**Request (percentage split):**
```json
{
  "title": "Rent",
  "totalAmount": 100000,
  "splitType": "percentage",
  "payers": [
    { "userId": "alice-uuid", "amount": 60000 },
    { "userId": "bob-uuid", "amount": 40000 }
  ],
  "splits": [
    { "userId": "alice-uuid", "percentage": 50 },
    { "userId": "bob-uuid", "percentage": 30 },
    { "userId": "charlie-uuid", "percentage": 20 }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "expense-uuid",
    "groupId": "uuid",
    "title": "Dinner",
    "description": "Pizza night",
    "totalAmount": 30000,
    "splitType": "equal",
    "createdBy": "uuid",
    "payers": [
      { "userId": "alice-uuid", "name": "Alice", "amount": 30000 }
    ],
    "splits": [
      { "userId": "alice-uuid", "name": "Alice", "amount": 10000, "percentage": null },
      { "userId": "bob-uuid", "name": "Bob", "amount": 10000, "percentage": null },
      { "userId": "charlie-uuid", "name": "Charlie", "amount": 10000, "percentage": null }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### GET `/api/groups/:groupId/expenses`
List all expenses in a group. **Requires group membership.**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "expense-uuid",
      "title": "Dinner",
      "totalAmount": 30000,
      "splitType": "equal",
      "createdBy": "uuid",
      "payers": [...],
      "splits": [...],
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/api/expenses/:expenseId`
Get expense details. **Requires authentication** (must be a member of the expense's group).

**Response (200):** Same structure as individual expense above.

---

#### PATCH `/api/expenses/:expenseId`
Edit an expense. **Requires authentication** (must be expense creator or group creator).

**Request:**
```json
{
  "title": "Updated Dinner",
  "totalAmount": 35000,
  "splitType": "equal",
  "payers": [
    { "userId": "alice-uuid", "amount": 35000 }
  ],
  "splits": [
    { "userId": "alice-uuid" },
    { "userId": "bob-uuid" },
    { "userId": "charlie-uuid" }
  ]
}
```

**Response (200):** Updated expense object.

---

#### DELETE `/api/expenses/:expenseId`
Delete an expense. **Requires authentication** (must be expense creator or group creator).

**Response (200):**
```json
{
  "success": true,
  "data": { "deleted": true }
}
```

---

### Balance Endpoints

#### GET `/api/groups/:groupId/balances`
Get net balances for all group members. **Requires group membership.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "userId": "alice-uuid",
        "name": "Alice",
        "email": "alice@example.com",
        "totalPaid": 30000,
        "totalOwed": 10000,
        "settledPaid": 0,
        "settledReceived": 0,
        "netBalance": 20000
      },
      {
        "userId": "bob-uuid",
        "name": "Bob",
        "email": "bob@example.com",
        "totalPaid": 0,
        "totalOwed": 10000,
        "settledPaid": 0,
        "settledReceived": 0,
        "netBalance": -10000
      }
    ],
    "summary": {
      "totalExpenses": 30000,
      "membersOwed": [...],
      "membersOwing": [...]
    }
  }
}
```

> **Balance formula:** `netBalance = totalPaid - totalOwed + settledPaid - settledReceived`
>
> Positive = owed money (should receive). Negative = owes money (should pay).

---

#### GET `/api/groups/:groupId/settlements/suggestions`
Get suggested settlements that minimize the number of transactions. **Requires group membership.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "from": { "userId": "bob-uuid", "name": "Bob" },
        "to": { "userId": "alice-uuid", "name": "Alice" },
        "amount": 10000
      }
    ],
    "totalTransactions": 1
  }
}
```

> Suggestions are **not** recorded as actual settlements. They are informational only.

---

### Settlement Endpoints

#### POST `/api/groups/:groupId/settlements`
Record a settlement. **Requires group membership.**

**Request:**
```json
{
  "payerId": "bob-uuid",
  "receiverId": "alice-uuid",
  "amount": 10000
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "settlement-uuid",
    "groupId": "uuid",
    "payer": { "id": "bob-uuid", "name": "Bob", "email": "bob@example.com" },
    "receiver": { "id": "alice-uuid", "name": "Alice", "email": "alice@example.com" },
    "amount": 10000,
    "status": "pending",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Validations:**
- Payer must have a negative balance (owes money)
- Receiver must have a positive balance (is owed money)
- Amount cannot exceed the applicable outstanding debt
- Payer and receiver must be different people

---

#### GET `/api/groups/:groupId/settlements`
List all settlements. **Requires group membership.**

**Response (200):** Array of settlement objects.

---

#### PATCH `/api/settlements/:settlementId`
Update settlement status. **Requires authentication.**

- `completed` — only payer or receiver can confirm
- `cancelled` — payer, receiver, or group creator can cancel

**Request:**
```json
{
  "status": "completed"
}
```

**Response (200):** Updated settlement object.

---

### Leave Request Endpoints

#### POST `/api/groups/:groupId/leave-requests`
Request to leave a group. **Requires group membership.**

- If balance is **zero**: auto-approved, member is immediately removed
- If balance is **non-zero**: creates a pending request for the group creator

**Request:**
```json
{
  "reason": "Moving to a different city"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "request-uuid",
    "groupId": "uuid",
    "userId": "uuid",
    "status": "pending",
    "reason": "Moving to a different city",
    "balanceSnapshot": -5000,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### GET `/api/groups/:groupId/leave-requests`
List all leave requests for a group. **Requires group membership.**

**Response (200):** Array of leave request objects.

---

#### PATCH `/api/leave-requests/:requestId`
Approve or reject a leave request. **Requires authentication** (must be group creator).

When approved with non-zero balance, a settlement record is created to document the debt redistribution.

**Request:**
```json
{
  "status": "approved",
  "adminNote": "Debt absorbed by the group"
}
```

**Response (200):** Updated leave request object.

---

## Authentication Guide

### Getting a Token

1. Register or login to receive a JWT token
2. Include the token in all authenticated requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Contents

The JWT payload contains:
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Token Expiration

Tokens expire after the configured `JWT_EXPIRES_IN` period (default: 7 days). The client must re-authenticate after expiration.

---

## Money Handling

**All monetary values are stored and transmitted as integers representing paise.**

| Display Value | API Value (paise) |
|---------------|-------------------|
| ₹100.00 | `10000` |
| ₹50.50 | `5050` |
| ₹0.01 | `1` |

### Equal Split Remainder Handling

When an amount doesn't divide evenly:
- `1000 paise ÷ 3 = 333, 333, 334` (remainder distributed to first participant)
- `10 paise ÷ 3 = 3, 3, 4`

### Percentage Split Rounding

Percentages are calculated then floored, with remainder paise distributed to participants with the largest fractional parts.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "\"name\" is required",
    "\"email\" must be a valid email"
  ]
}
```

---

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

| Domain | Tests |
|--------|-------|
| Authentication | Registration, login, invalid credentials, token validation |
| Groups | Creation, membership, authorization, member management |
| Expenses | Equal/exact/percentage splits, multiple payers, validation |
| Balances | Net balance calculations, multi-payer scenarios |
| Settlements | Creation, validation, status updates, authorization |
| Leave Requests | Auto-approval, pending requests, balance redistribution |

Tests use **mocked database queries** (via Vitest's `vi.mock`), so they run without a live PostgreSQL database.

---

## Frontend Integration Guide

### Base URL

```
http://localhost:5000/api
```

### CORS

CORS is configured via the `FRONTEND_URL` environment variable. Set it to your React app's URL (e.g., `http://localhost:3000`).

### Example Fetch Call (JavaScript)

```javascript
// Login
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
});
const data = await response.json();
const token = data.data.token;

// Authenticated request
const groups = await fetch('http://localhost:5000/api/groups', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});
const groupData = await groups.json();
```

### Response Handling Pattern

```javascript
const res = await fetch(url, options);
const data = await res.json();

if (data.success) {
  // Handle success
  console.log(data.data);
} else {
  // Handle error
  console.error(data.message);
  if (data.errors) {
    data.errors.forEach(err => console.error(err));
  }
}
```

### Content-Type

Always send `Content-Type: application/json` for POST/PATCH requests.

---

## Example Workflow

Here's a complete flow using `curl`:

```bash
BASE_URL="http://localhost:5000/api"

# 1. Register Alice
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

# Save the token from the response
TOKEN_ALICE="<token-from-response>"

# 2. Register Bob
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com","password":"password123"}'

TOKEN_BOB="<token-from-response>"

# 3. Alice creates a group
curl -X POST "$BASE_URL/groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -d '{"name":"Roommates","description":"Apartment expenses"}'

GROUP_ID="<group-id-from-response>"

# 4. Alice adds Bob to the group
curl -X POST "$BASE_URL/groups/$GROUP_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -d '{"email":"bob@example.com"}'

# 5. Alice creates an expense (she paid ₹100, split equally)
curl -X POST "$BASE_URL/groups/$GROUP_ID/expenses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -d '{
    "title": "Groceries",
    "totalAmount": 10000,
    "splitType": "equal",
    "payers": [{"userId":"<alice-uuid>","amount":10000}],
    "splits": [{"userId":"<alice-uuid>"},{"userId":"<bob-uuid>"}]
  }'

# 6. View balances (Bob owes Alice ₹50)
curl "$BASE_URL/groups/$GROUP_ID/balances" \
  -H "Authorization: Bearer $TOKEN_ALICE"

# 7. View settlement suggestions
curl "$BASE_URL/groups/$GROUP_ID/settlements/suggestions" \
  -H "Authorization: Bearer $TOKEN_ALICE"

# 8. Record Bob's payment to Alice
curl -X POST "$BASE_URL/groups/$GROUP_ID/settlements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -d '{"payerId":"<bob-uuid>","receiverId":"<alice-uuid>","amount":5000}'

# 9. Alice confirms the settlement
curl -X PATCH "$BASE_URL/settlements/<settlement-id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -d '{"status":"completed"}'
```

---

## License

Private — The Opusol © 2026
