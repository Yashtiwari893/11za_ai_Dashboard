# Role-Based Access Control (RBAC) System Documentation

## Overview

This document describes the complete implementation of a production-grade Role-Based Access Control (RBAC) system with two roles: **ADMIN** and **USER**.

---

## Architecture Overview

### Security Layers

```
┌──────────────────────────────────────────────────┐
│  1. FRONTEND ROUTING                             │
│  - Middleware checks session                     │
│  - /admin/* and /user/* routes protected        │
│  - Role-specific dashboards                     │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  2. API AUTHORIZATION MIDDLEWARE                 │
│  - getAuthContext() validates JWT                │
│  - requireAuth() checks active status            │
│  - requireAdmin() enforces admin-only access    │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  3. DATABASE ROW LEVEL SECURITY (RLS)            │
│  - Policies prevent unauthorized data access    │
│  - Admins see all data, users see their own      │
│  - Audit trails logged for all admin actions    │
└──────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### 1. `user_roles`
Stores available roles in the system.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  role_name TEXT UNIQUE,          -- 'admin', 'user'
  description TEXT,
  created_at TIMESTAMP
);
```

#### 2. `user_profiles`
Extended user information with role management.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,            -- Foreign key to auth.users
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT,                      -- 'admin' or 'user'
  phone_number TEXT,
  is_active BOOLEAN,              -- Admin can deactivate users
  is_verified_email BOOLEAN,
  last_login TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 3. `user_audit_log`
Audit trail for all admin actions.

```sql
CREATE TABLE user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID,                  -- Who performed the action
  target_user_id UUID,            -- Who was affected
  action TEXT,                    -- 'activate', 'deactivate', 'role_change', 'data_edit'
  old_values JSONB,               -- Before values
  new_values JSONB,               -- After values
  reason TEXT,                    -- Why the action was taken
  created_at TIMESTAMP
);
```

### Migration File

Run this migration to set up the RBAC schema:

```bash
psql -U postgres -d your_db < migrations/add_rbac_schema.sql
```

---

## API Endpoints

### Admin Endpoints

#### GET `/api/admin/users`
Fetch all users with pagination and filters.

**Access:** Admin only

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `role` (string): Filter by role ('admin' or 'user')
- `isActive` (string): Filter by status ('true' or 'false')
- `search` (string): Search by email or name

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "role": "user",
        "phone_number": "+1234567890",
        "is_active": true,
        "created_at": "2026-01-29T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

#### GET `/api/admin/users/:userId`
Get a specific user's details.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "phone_number": "+1234567890",
    "is_active": true,
    "created_at": "2026-01-29T10:00:00Z"
  }
}
```

---

#### POST `/api/admin/users/:userId`
Update a user's information.

**Access:** Admin only

**Request Body:**
```json
{
  "full_name": "Jane Doe",
  "phone_number": "+1234567890",
  "role": "admin",
  "is_active": false,
  "reason": "Account suspension - violates terms of service"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User updated successfully",
    "user": { /* updated user object */ }
  }
}
```

---

#### GET `/api/admin/stats`
Fetch system statistics.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalUsers": 150,
      "activeUsers": 145,
      "inactiveUsers": 5
    },
    "roleDistribution": {
      "admin": 3,
      "user": 147
    },
    "activitySummary": {
      "activate": 10,
      "deactivate": 5,
      "role_change": 2,
      "data_edit": 45
    },
    "lastUpdated": "2026-01-29T14:30:00Z"
  }
}
```

---

### User Endpoints

#### GET `/api/user/profile`
Get current user's profile.

**Access:** Authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "phone_number": "+1234567890",
    "is_active": true,
    "created_at": "2026-01-29T10:00:00Z"
  }
}
```

---

#### POST `/api/user/profile`
Update current user's profile.

**Access:** Authenticated users

**Request Body:**
```json
{
  "full_name": "Jane Doe",
  "phone_number": "+1987654321"
}
```

**Restrictions:**
- Users CANNOT change: email, role, is_active status
- Only admin can change these fields

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "profile": { /* updated profile */ }
  }
}
```

---

## Frontend Routes

### Protected Routes

#### `/admin`
Admin dashboard for managing users, viewing statistics, and audit trails.

**Access:** Admin users only

**Features:**
- View all users (paginated, searchable)
- Edit user information
- Activate/deactivate users
- Change user roles
- View system statistics
- Filter users by role and status
- Audit trail of all actions

---

#### `/user`
User dashboard for viewing and managing own profile.

**Access:** All authenticated users

**Features:**
- View own profile information
- Edit name and phone number
- Cannot edit: email, role, account status
- View account creation date
- View last login timestamp

---

## Authentication & Authorization Flow

### Step 1: Login
1. User enters email and password at `/login`
2. Supabase authenticates and returns JWT token
3. Token stored in HTTP-only cookie

### Step 2: Session Retrieval
1. Middleware checks for valid session on each request
2. If invalid or missing, user redirected to `/login`

### Step 3: Role Determination
1. Login page fetches user's role from `user_profiles` table
2. Based on role, user redirected to:
   - **Admin users** → `/admin`
   - **Regular users** → `/user`

### Step 4: API Authorization
1. Each API request includes Supabase JWT in Authorization header
2. `getAuthContext()` validates token and retrieves role
3. `requireAuth()` checks user is active
4. `requireAdmin()` checks user has admin role
5. Database RLS policies enforce final layer of security

---

## Security Best Practices Implemented

### 1. **Multi-Layer Authorization**
```typescript
// API endpoints use progressive checks
const auth = await requireAuth();      // Check: authenticated + active
requireAdmin(auth);                     // Check: has admin role
// Database RLS policies apply final check
```

### 2. **Data Isolation**
- Users can only access their own data
- Admins can access all data
- Database RLS enforces at SQL level

### 3. **Audit Trail**
- All admin actions logged with:
  - Who performed the action (admin_id)
  - Who was affected (target_user_id)
  - What changed (old_values, new_values)
  - Why (reason field)
  - When (timestamp)

### 4. **Password Security**
- Passwords never stored in application
- Supabase handles password hashing and validation
- Only JWT tokens used for authorization

### 5. **Active Status Check**
```typescript
// Deactivated users cannot access system
if (!auth.isActive) {
  throw new Error('FORBIDDEN: User account is inactive');
}
```

### 6. **Role-Based Field Restrictions**
```typescript
// Users cannot modify sensitive fields
if ('role' in body || 'is_active' in body) {
  return error('You cannot modify these fields');
}
```

### 7. **HTTP-Only Cookies**
- Session stored in HTTP-only cookie
- Prevents XSS attacks from reading token
- Automatically sent with requests

### 8. **CSRF Protection**
- Supabase handles CSRF tokens automatically
- Middleware refreshes tokens as needed

---

## Usage Examples

### Creating an Admin User

```bash
# 1. Create user via Supabase Auth UI or API
# 2. User is automatically added to user_profiles with role='user'
# 3. Admin updates role via API:

POST /api/admin/users/:userId
{
  "role": "admin",
  "reason": "Promoted to admin by system"
}
```

### Deactivating a User

```bash
POST /api/admin/users/:userId
{
  "is_active": false,
  "reason": "Violation of terms of service"
}
```

The deactivated user will:
- Cannot login
- Existing sessions are invalidated
- API calls return 403 Forbidden

### Viewing Audit Trail

```bash
# Admins can query audit logs via:
GET /api/admin/stats

# Returns activity summary for last 7 days
# Shows: activate, deactivate, role_change, data_edit counts
```

---

## Testing the RBAC System

### Test Case 1: User Cannot Access Admin Dashboard
```
1. Login as regular user
2. Try to access /admin
3. Expected: Redirected to /user dashboard
4. API calls to /api/admin/* return 403 Forbidden
```

### Test Case 2: Admin Can Access All Users
```
1. Login as admin
2. Visit /admin
3. See list of all users
4. Can edit any user's information
5. Expected: Full access with proper UI controls
```

### Test Case 3: User Cannot Edit Another User's Data
```
1. User fetches /api/user/profile
2. Tries to fetch /api/user/profile?userId=other_user_id
3. Expected: Only own profile returned (no such query param)
4. Attempting /api/admin/users returns 403 Forbidden
```

### Test Case 4: Deactivated User Cannot Login
```
1. Admin deactivates user
2. User tries to login
3. Expected: "Account deactivated" message
4. User immediately logged out
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "timestamp": "2026-01-29T14:30:00Z"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Admin access required",
  "timestamp": "2026-01-29T14:30:00Z"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found",
  "timestamp": "2026-01-29T14:30:00Z"
}
```

---

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── page.tsx              # Admin Dashboard UI
│   ├── user/
│   │   └── page.tsx              # User Dashboard UI
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Login with role-based redirect
│   └── api/
│       ├── admin/
│       │   ├── users/
│       │   │   ├── route.ts      # GET all users
│       │   │   └── [userId]/
│       │   │       └── route.ts  # GET/POST specific user
│       │   └── stats/
│       │       └── route.ts      # GET system statistics
│       └── user/
│           └── profile/
│               └── route.ts      # GET/POST user's own profile
├── lib/
│   └── auth/
│       ├── rbac.ts               # RBAC utilities and middleware
│       └── navigation.ts          # Navigation helpers
└── middleware.ts                  # Next.js request middleware

migrations/
└── add_rbac_schema.sql            # Database schema migration
```

---

## Environment Variables

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Deployment Checklist

- [ ] Run migration `migrations/add_rbac_schema.sql`
- [ ] Set all required environment variables
- [ ] Test login and role-based routing
- [ ] Verify admin endpoints accessible to admins only
- [ ] Verify user endpoints accessible to all authenticated users
- [ ] Test user profile isolation
- [ ] Test audit trail logging
- [ ] Test deactivation of users
- [ ] Monitor error logs for authorization failures

---

## Future Enhancements

1. **Fine-grained Permissions**
   - Implement more granular permissions (e.g., view-only, edit, delete)
   - Resource-level permissions instead of role-level

2. **Role-Specific Data Filtering**
   - Admins see different dashboard metrics
   - Users see only relevant data

3. **Session Management**
   - Admin can revoke user sessions
   - Timeout-based session invalidation

4. **Two-Factor Authentication (2FA)**
   - Optional 2FA for admin accounts
   - Passwordless authentication options

5. **Activity Timeline**
   - User login history
   - User action timeline
   - System-wide activity feed

---

## Support & Troubleshooting

### User Sees 403 When Accessing Their Dashboard
- Check: Is user account active? (`is_active = true`)
- Check: User has correct role in database
- Check: Session token is valid

### Admin Cannot See Users List
- Check: User role is 'admin' in database
- Check: `/api/admin/users` returns 403
- Check: User session is still valid

### Role Change Not Taking Effect
- New role visible on next page reload
- Clear browser cache if needed
- Check audit log for confirmation

---

## Contact & Documentation

For more information, refer to:
- Supabase Auth: https://supabase.com/docs/guides/auth
- Next.js Middleware: https://nextjs.org/docs/advanced-features/middleware
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

---

**Last Updated:** January 29, 2026  
**Version:** 1.0.0  
**Status:** Production-Ready
